const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Authentication settings (can be overridden by environment variables)
const CALL_PASSWORD = process.env.CALL_PASSWORD || 'voice2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'BumbleBiscuit$55';

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Store connected users and rooms
const users = new Map();
const rooms = new Map();

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // User joins with username and authentication
    socket.on('join-call', (data) => {
        const { username, isAdmin, callPassword, adminPassword } = data;
        
        // Validate call password
        if (callPassword !== CALL_PASSWORD) {
            socket.emit('auth-failed', { message: 'Invalid call password' });
            return;
        }
        
        // Validate admin password if user is trying to join as admin
        if (isAdmin && adminPassword !== ADMIN_PASSWORD) {
            socket.emit('auth-failed', { message: 'Invalid admin password' });
            return;
        }
        
        // Store user information
        users.set(socket.id, {
            username,
            isAdmin,
            socketId: socket.id,
            room: 'main-call'
        });

        // Join the main call room
        socket.join('main-call');

        // Add to room participants
        if (!rooms.has('main-call')) {
            rooms.set('main-call', new Set());
        }
        rooms.get('main-call').add(socket.id);

        console.log(`${username} joined the call (Admin: ${isAdmin})`);

        // Notify all participants
        socket.to('main-call').emit('user-joined', {
            userId: socket.id,
            username,
            isAdmin
        });

        // Send current participants to the new user
        const participants = [];
        rooms.get('main-call').forEach(userId => {
            if (userId !== socket.id && users.has(userId)) {
                const user = users.get(userId);
                participants.push({
                    userId: user.socketId,
                    username: user.username,
                    isAdmin: user.isAdmin
                });
            }
        });

        socket.emit('existing-participants', participants);
        
        // Send confirmation
        socket.emit('join-success', { message: 'Successfully joined the call' });
    });

    // WebRTC signaling
    socket.on('webrtc-offer', (data) => {
        console.log(`WebRTC offer from ${socket.id} to ${data.targetId}`);
        socket.to(data.targetId).emit('webrtc-offer', {
            offer: data.offer,
            senderId: socket.id,
            senderUsername: users.get(socket.id)?.username
        });
    });

    socket.on('webrtc-answer', (data) => {
        console.log(`WebRTC answer from ${socket.id} to ${data.targetId}`);
        socket.to(data.targetId).emit('webrtc-answer', {
            answer: data.answer,
            senderId: socket.id
        });
    });

    socket.on('webrtc-ice-candidate', (data) => {
        socket.to(data.targetId).emit('webrtc-ice-candidate', {
            candidate: data.candidate,
            senderId: socket.id
        });
    });

    // Admin-specific events
    socket.on('admin-mute-user', (data) => {
        const user = users.get(socket.id);
        if (user && user.isAdmin) {
            socket.to(data.targetId).emit('admin-mute', {
                adminId: socket.id,
                adminName: user.username
            });
            console.log(`Admin ${user.username} muted user ${data.targetId}`);
        }
    });

    socket.on('admin-unmute-user', (data) => {
        const user = users.get(socket.id);
        if (user && user.isAdmin) {
            socket.to(data.targetId).emit('admin-unmute', {
                adminId: socket.id,
                adminName: user.username
            });
            console.log(`Admin ${user.username} unmuted user ${data.targetId}`);
        }
    });

    socket.on('admin-mute-all', () => {
        const user = users.get(socket.id);
        if (user && user.isAdmin) {
            socket.to('main-call').emit('admin-mute-all', {
                adminId: socket.id,
                adminName: user.username
            });
            console.log(`Admin ${user.username} muted all users`);
        }
    });

    socket.on('admin-unmute-all', () => {
        const user = users.get(socket.id);
        if (user && user.isAdmin) {
            socket.to('main-call').emit('admin-unmute-all', {
                adminId: socket.id,
                adminName: user.username
            });
            console.log(`Admin ${user.username} unmuted all users`);
        }
    });

    // Channel assignment for admin
    socket.on('admin-assign-channel', (data) => {
        const user = users.get(socket.id);
        if (user && user.isAdmin) {
            socket.to(data.targetId).emit('channel-assignment', {
                channel: data.channel,
                adminId: socket.id
            });
            console.log(`Admin assigned channel ${data.channel} to user ${data.targetId}`);
        }
    });

    // Handle user mute/unmute
    socket.on('user-muted', (data) => {
        const user = users.get(socket.id);
        if (user) {
            socket.to('main-call').emit('participant-muted', {
                userId: socket.id,
                username: user.username,
                isMuted: data.isMuted
            });
        }
    });

    // Handle disconnection
    socket.on('leave-call', () => {
        handleDisconnect(socket);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    function handleDisconnect(socket) {
        const user = users.get(socket.id);
        if (user) {
            console.log(`${user.username} left the call`);
            
            // Remove from room
            if (rooms.has('main-call')) {
                rooms.get('main-call').delete(socket.id);
            }
            
            // Notify other participants
            socket.to('main-call').emit('user-left', {
                userId: socket.id,
                username: user.username
            });
            
            // Remove user data
            users.delete(socket.id);
        }
    }
});

// API endpoints
app.get('/api/stats', (req, res) => {
    const stats = {
        totalUsers: users.size,
        rooms: rooms.size,
        users: Array.from(users.entries()).map(([id, user]) => ({
            id,
            username: user.username,
            isAdmin: user.isAdmin,
            room: user.room
        }))
    };
    res.json(stats);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => {
    console.log(`Voice Call Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to access the application`);
    console.log('='.repeat(50));
    console.log('🔐 Authentication Info:');
    console.log(`Call Password: ${CALL_PASSWORD}`);
    console.log(`Admin Password: ${ADMIN_PASSWORD}`);
    console.log('='.repeat(50));
});