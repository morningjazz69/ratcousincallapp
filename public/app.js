class VoiceCallApp {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.peers = new Map();
        this.isAdmin = false;
        this.username = '';
        this.isMuted = false;
        this.audioContext = null;
        this.audioChannels = new Map();
        this.channelIndex = 0;
        this.isInCall = false;

        // WebRTC configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
    }

    initializeElements() {
        // DOM elements
        this.usernameInput = document.getElementById('usernameInput');
        this.passwordInput = document.getElementById('passwordInput');
        this.adminPasswordInput = document.getElementById('adminPasswordInput');
        this.joinButton = document.getElementById('joinButton');
        this.adminButton = document.getElementById('adminButton');
        this.callControls = document.getElementById('callControls');
        this.muteButton = document.getElementById('muteButton');
        this.leaveButton = document.getElementById('leaveButton');
        this.participantsList = document.getElementById('participantsList');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusLog = document.getElementById('statusLog');
        this.adminPanel = document.getElementById('adminPanel');
        this.audioChannels = document.getElementById('audioChannels');
        this.muteAllButton = document.getElementById('muteAllButton');
        this.unmuteAllButton = document.getElementById('unmuteAllButton');
        this.outputDeviceSelect = document.getElementById('outputDeviceSelect');
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus('Connected', true);
            this.logMessage('Connected to server', 'success');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('Disconnected', false);
            this.logMessage('Disconnected from server', 'error');
        });

        this.socket.on('join-success', (data) => {
            this.logMessage(data.message, 'success');
            this.showCallControls();
        });

        this.socket.on('auth-failed', (data) => {
            this.logMessage(data.message, 'error');
            this.showAuthError(data.message);
        });

        this.socket.on('existing-participants', async (participants) => {
            // As the new joiner, we always initiate connections to existing participants
            for (const participant of participants) {
                await this.createPeerConnection(participant.userId, participant.username);
                this.addParticipant(participant);
                
                const peer = this.peers.get(participant.userId);
                peer.isOfferer = true;
                
                // Stagger the offers to avoid simultaneous attempts
                const delay = participants.indexOf(participant) * 200;
                setTimeout(() => {
                    this.sendOffer(participant.userId);
                }, delay);
            }
        });

        this.socket.on('user-joined', (data) => {
            this.handleUserJoined(data);
        });

        this.socket.on('user-left', (data) => {
            this.handleUserLeft(data);
        });

        this.socket.on('webrtc-offer', (data) => {
            this.handleWebRTCOffer(data);
        });

        this.socket.on('webrtc-answer', (data) => {
            this.handleWebRTCAnswer(data);
        });

        this.socket.on('webrtc-ice-candidate', (data) => {
            this.handleIceCandidate(data);
        });

        this.socket.on('participant-muted', (data) => {
            this.updateParticipantMuteStatus(data);
        });

        // Admin-specific events
        this.socket.on('admin-mute', (data) => {
            this.handleAdminMute(data);
        });

        this.socket.on('admin-unmute', (data) => {
            this.handleAdminUnmute(data);
        });

        this.socket.on('admin-mute-all', (data) => {
            this.handleAdminMuteAll(data);
        });

        this.socket.on('admin-unmute-all', (data) => {
            this.handleAdminUnmuteAll(data);
        });

        this.socket.on('channel-assignment', (data) => {
            this.logMessage(`Assigned to audio channel ${data.channel}`, 'info');
        });
    }

    setupEventListeners() {
        this.joinButton.addEventListener('click', () => this.joinCall(false));
        this.adminButton.addEventListener('click', () => this.showAdminPasswordField());
        this.muteButton.addEventListener('click', () => this.toggleMute());
        this.leaveButton.addEventListener('click', () => this.leaveCall());
        
        if (this.muteAllButton) {
            this.muteAllButton.addEventListener('click', () => this.adminMuteAll());
        }
        
        if (this.unmuteAllButton) {
            this.unmuteAllButton.addEventListener('click', () => this.adminUnmuteAll());
        }

        // Enter key handlers
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.passwordInput.focus();
            }
        });
        
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinCall(false);
            }
        });
        
        this.adminPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinCall(true);
            }
        });
    }

    showAdminPasswordField() {
        this.adminPasswordInput.style.display = 'block';
        this.adminPasswordInput.focus();
        this.adminButton.textContent = 'Join as Admin';
        this.adminButton.onclick = () => this.joinCall(true);
    }

    async joinCall(isAdmin) {
        const username = this.usernameInput.value.trim();
        const callPassword = this.passwordInput.value.trim();
        const adminPassword = isAdmin ? this.adminPasswordInput.value.trim() : '';
        
        if (!username) {
            this.logMessage('Please enter a username', 'error');
            return;
        }

        if (!callPassword) {
            this.logMessage('Please enter the call password', 'error');
            return;
        }

        if (isAdmin && !adminPassword) {
            this.logMessage('Please enter the admin password', 'error');
            return;
        }

        this.username = username;
        this.isAdmin = isAdmin;

        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            this.logMessage('Microphone access granted', 'success');

            // Initialize Web Audio API for admin
            if (isAdmin) {
                await this.initializeAudioContext();
                this.showAdminPanel();
            }

            // Join the call with authentication
            this.socket.emit('join-call', { 
                username, 
                isAdmin, 
                callPassword,
                adminPassword 
            });
            this.isInCall = true;

        } catch (error) {
            this.logMessage(`Error accessing microphone: ${error.message}`, 'error');
        }
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });

            // Get available audio output devices
            await this.populateOutputDevices();
            
            this.logMessage('Web Audio API initialized for channel separation', 'success');
        } catch (error) {
            this.logMessage(`Error initializing Web Audio API: ${error.message}`, 'error');
        }
    }

    async populateOutputDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
            
            this.outputDeviceSelect.innerHTML = '<option value="">Default Output</option>';
            
            audioOutputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Audio Output ${device.deviceId.substr(0, 8)}`;
                this.outputDeviceSelect.appendChild(option);
            });
        } catch (error) {
            this.logMessage(`Error getting audio devices: ${error.message}`, 'error');
        }
    }

    async handleUserJoined(participant) {
        this.logMessage(`${participant.username} joined the call${participant.isAdmin ? ' (Admin)' : ''}`, 'info');
        this.addParticipant(participant);

        // Only create connection if we're already in the call
        // Use deterministic logic: lower socket ID always initiates
        if (this.isInCall && this.localStream) {
            await this.createPeerConnection(participant.userId, participant.username);
            
            if (this.socket.id < participant.userId) {
                // We initiate the connection
                const peer = this.peers.get(participant.userId);
                peer.isOfferer = true;
                
                // Add small delay to avoid race conditions
                setTimeout(() => {
                    this.sendOffer(participant.userId);
                }, 100);
            } else {
                // They will initiate, we just wait
                this.logMessage(`Waiting for ${participant.username} to initiate connection`, 'info');
            }
        }
    }

    async createPeerConnection(userId, username) {
        const peerConnection = new RTCPeerConnection(this.rtcConfig);
        
        // Add local stream
        this.localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, this.localStream);
        });

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            this.handleRemoteStream(userId, username, event.streams[0]);
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc-ice-candidate', {
                    targetId: userId,
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            this.logMessage(`Connection with ${username}: ${peerConnection.connectionState}`, 'info');
            
            if (peerConnection.connectionState === 'failed') {
                this.logMessage(`Connection failed with ${username}, attempting restart`, 'error');
                setTimeout(() => {
                    this.attemptReconnection(userId, username);
                }, 1000);
            } else if (peerConnection.connectionState === 'disconnected') {
                this.logMessage(`Connection disconnected with ${username}`, 'info');
                // Give it some time to reconnect automatically
                setTimeout(() => {
                    if (peerConnection.connectionState === 'disconnected') {
                        this.attemptReconnection(userId, username);
                    }
                }, 5000);
            }
        };

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            this.logMessage(`ICE connection with ${username}: ${peerConnection.iceConnectionState}`, 'info');
        };

        this.peers.set(userId, {
            connection: peerConnection,
            username: username,
            isOfferer: false,
            iceCandidateQueue: []
        });

        return peerConnection;
    }

    async sendOffer(userId) {
        const peer = this.peers.get(userId);
        if (!peer) return;

        try {
            const offer = await peer.connection.createOffer();
            await peer.connection.setLocalDescription(offer);
            
            this.socket.emit('webrtc-offer', {
                targetId: userId,
                offer: offer
            });
        } catch (error) {
            this.logMessage(`Error creating offer for ${peer.username}: ${error.message}`, 'error');
        }
    }

    async handleWebRTCOffer(data) {
        const { offer, senderId, senderUsername } = data;
        
        if (!this.peers.has(senderId)) {
            await this.createPeerConnection(senderId, senderUsername);
        }

        const peer = this.peers.get(senderId);
        
        try {
            // If we're in have-local-offer state, we need to handle collision
            if (peer.connection.signalingState === 'have-local-offer') {
                // Use socket ID to determine who should back down
                if (this.socket.id > senderId) {
                    // We back down - restart our connection
                    this.logMessage(`Offer collision with ${senderUsername} - restarting connection`, 'info');
                    await this.restartPeerConnection(senderId, senderUsername);
                    return;
                } else {
                    // They should back down, ignore their offer
                    this.logMessage(`Offer collision with ${senderUsername} - ignoring their offer`, 'info');
                    return;
                }
            }
            
            // Normal offer handling
            if (peer.connection.signalingState === 'stable') {
                await peer.connection.setRemoteDescription(offer);
                
                // Process any queued ICE candidates
                for (const candidate of peer.iceCandidateQueue) {
                    try {
                        await peer.connection.addIceCandidate(candidate);
                    } catch (error) {
                        this.logMessage(`Error adding queued ICE candidate: ${error.message}`, 'error');
                    }
                }
                peer.iceCandidateQueue = [];
                
                const answer = await peer.connection.createAnswer();
                await peer.connection.setLocalDescription(answer);
                
                this.socket.emit('webrtc-answer', {
                    targetId: senderId,
                    answer: answer
                });
            } else {
                this.logMessage(`Cannot handle offer from ${senderUsername} - signaling state: ${peer.connection.signalingState}`, 'error');
            }
        } catch (error) {
            this.logMessage(`Error handling offer from ${senderUsername}: ${error.message}`, 'error');
        }
    }

    async restartPeerConnection(userId, username) {
        // Close existing connection
        const existingPeer = this.peers.get(userId);
        if (existingPeer) {
            existingPeer.connection.close();
        }
        
        // Create new connection
        await this.createPeerConnection(userId, username);
        
        // Wait a bit to avoid immediate collision
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Don't send offer - wait for them to send one
        this.logMessage(`Restarted connection with ${username} - waiting for their offer`, 'info');
    }

    async handleWebRTCAnswer(data) {
        const { answer, senderId } = data;
        const peer = this.peers.get(senderId);
        
        if (peer) {
            try {
                // Only set remote description if we're in the correct state
                if (peer.connection.signalingState === 'have-local-offer') {
                    await peer.connection.setRemoteDescription(answer);
                    
                    // Process any queued ICE candidates
                    for (const candidate of peer.iceCandidateQueue) {
                        try {
                            await peer.connection.addIceCandidate(candidate);
                        } catch (error) {
                            this.logMessage(`Error adding queued ICE candidate: ${error.message}`, 'error');
                        }
                    }
                    peer.iceCandidateQueue = [];
                } else {
                    this.logMessage(`Cannot handle answer from ${peer.username} - wrong signaling state: ${peer.connection.signalingState}`, 'error');
                }
            } catch (error) {
                this.logMessage(`Error handling answer from ${peer.username}: ${error.message}`, 'error');
            }
        }
    }

    async handleIceCandidate(data) {
        const { candidate, senderId } = data;
        const peer = this.peers.get(senderId);
        
        if (peer) {
            try {
                // Only add ICE candidate if remote description is set
                if (peer.connection.remoteDescription) {
                    await peer.connection.addIceCandidate(candidate);
                } else {
                    // Queue the candidate for later
                    peer.iceCandidateQueue.push(candidate);
                    this.logMessage(`Queued ICE candidate from ${peer.username}`, 'info');
                }
            } catch (error) {
                this.logMessage(`Error adding ICE candidate from ${peer.username}: ${error.message}`, 'error');
            }
        }
    }

    handleRemoteStream(userId, username, stream) {
        this.logMessage(`Received audio stream from ${username}`, 'success');
        
        if (this.isAdmin && this.audioContext) {
            this.setupAudioChannelSeparation(userId, username, stream);
        } else {
            this.playRemoteAudio(userId, username, stream);
        }
    }

    async attemptReconnection(userId, username) {
        this.logMessage(`Attempting to reconnect to ${username}`, 'info');
        
        // Close and remove existing connection
        if (this.peers.has(userId)) {
            const peer = this.peers.get(userId);
            peer.connection.close();
            this.peers.delete(userId);
        }
        
        // Create new connection
        await this.createPeerConnection(userId, username);
        
        // Use same logic as initial connection
        if (this.socket.id < userId) {
            const peer = this.peers.get(userId);
            peer.isOfferer = true;
            
            setTimeout(() => {
                this.sendOffer(userId);
            }, 500);
        }
    }

    setupAudioChannelSeparation(userId, username, stream) {
        try {
            // Create audio elements and processing nodes
            const audio = document.createElement('audio');
            audio.srcObject = stream;
            audio.autoplay = true;
            audio.muted = true; // Mute the default output
            
            // Create Web Audio API nodes
            const source = this.audioContext.createMediaStreamSource(stream);
            const gainNode = this.audioContext.createGain();
            
            // For multi-channel output (like 16-channel Loopback)
            const channelSplitter = this.audioContext.createChannelSplitter(16);
            const channelMerger = this.audioContext.createChannelMerger(16);
            
            // Assign this user to a specific discrete channel (0-15)
            const discreteChannel = this.channelIndex % 16;
            
            // Connect to discrete channel
            source.connect(gainNode);
            gainNode.connect(channelSplitter);
            
            // Route to specific output channel
            channelSplitter.connect(channelMerger, 0, discreteChannel);
            channelMerger.connect(this.audioContext.destination);
            
            // Store channel info
            this.audioChannels.set(userId, {
                audio: audio,
                source: source,
                gainNode: gainNode,
                channelSplitter: channelSplitter,
                channelMerger: channelMerger,
                username: username,
                channelIndex: this.channelIndex,
                discreteChannel: discreteChannel
            });
            
            this.createChannelControlUI(userId, username, this.channelIndex, discreteChannel);
            this.channelIndex++;
            
            this.logMessage(`${username} assigned to discrete channel ${discreteChannel + 1}`, 'info');
            
        } catch (error) {
            this.logMessage(`Error setting up channel separation for ${username}: ${error.message}`, 'error');
            // Fallback to normal audio
            this.playRemoteAudio(userId, username, stream);
        }
    }

    createChannelControlUI(userId, username, channelIndex, discreteChannel) {
        const channelDiv = document.createElement('div');
        channelDiv.className = 'audio-channel';
        channelDiv.id = `channel-${userId}`;
        
        channelDiv.innerHTML = `
            <div class="channel-info">
                <div class="channel-name">Ch ${discreteChannel + 1}: ${username}</div>
                <div class="channel-status">Discrete Channel ${discreteChannel + 1} | Active</div>
            </div>
            <div class="channel-controls">
                <input type="range" class="volume-control" min="0" max="2" step="0.1" value="1" 
                       id="volume-${userId}" title="Volume (0-200%)">
                <button class="mute-channel-btn" id="mute-${userId}">🔊</button>
                <button class="solo-channel-btn" id="solo-${userId}">Solo</button>
                <select class="channel-select" id="channel-${userId}-select" title="Output Channel">
                    ${this.generateChannelOptions(discreteChannel)}
                </select>
            </div>
        `;
        
        this.audioChannels.appendChild(channelDiv);
        
        // Add event listeners
        document.getElementById(`volume-${userId}`).addEventListener('input', (e) => {
            this.updateChannelVolume(userId, e.target.value);
        });
        
        document.getElementById(`mute-${userId}`).addEventListener('click', () => {
            this.toggleChannelMute(userId);
        });
        
        document.getElementById(`solo-${userId}`).addEventListener('click', () => {
            this.toggleChannelSolo(userId);
        });
        
        document.getElementById(`channel-${userId}-select`).addEventListener('change', (e) => {
            this.reassignChannel(userId, parseInt(e.target.value));
        });
    }

    generateChannelOptions(selectedChannel) {
        let options = '';
        for (let i = 0; i < 16; i++) {
            const selected = i === selectedChannel ? 'selected' : '';
            options += `<option value="${i}" ${selected}>Channel ${i + 1}</option>`;
        }
        return options;
    }

    reassignChannel(userId, newChannel) {
        const channel = this.audioChannels.get(userId);
        if (channel && channel.source) {
            try {
                // Disconnect old routing
                channel.gainNode.disconnect();
                
                // Create new routing to different channel
                const newChannelMerger = this.audioContext.createChannelMerger(16);
                channel.channelSplitter.connect(newChannelMerger, 0, newChannel);
                newChannelMerger.connect(this.audioContext.destination);
                
                // Update stored info
                channel.channelMerger = newChannelMerger;
                channel.discreteChannel = newChannel;
                
                // Update UI
                const statusElement = document.querySelector(`#channel-${userId} .channel-status`);
                if (statusElement) {
                    statusElement.textContent = `Discrete Channel ${newChannel + 1} | Active`;
                }
                
                this.logMessage(`${channel.username} moved to channel ${newChannel + 1}`, 'info');
                
            } catch (error) {
                this.logMessage(`Error reassigning channel: ${error.message}`, 'error');
            }
        }
    }

    updateChannelVolume(userId, volume) {
        const channel = this.audioChannels.get(userId);
        if (channel && channel.gainNode) {
            channel.gainNode.gain.setValueAtTime(parseFloat(volume), this.audioContext.currentTime);
            
            // Update status
            const statusElement = document.querySelector(`#channel-${userId} .channel-status`);
            if (statusElement) {
                const discreteChannel = channel.discreteChannel;
                statusElement.textContent = `Discrete Channel ${discreteChannel + 1} | Volume: ${(volume * 100).toFixed(0)}%`;
            }
        }
    }

    toggleChannelMute(userId) {
        const channel = this.audioChannels.get(userId);
        const muteButton = document.getElementById(`mute-${userId}`);
        
        if (channel && channel.gainNode && muteButton) {
            const currentVolume = channel.gainNode.gain.value;
            if (currentVolume > 0) {
                channel.previousVolume = currentVolume;
                channel.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                muteButton.textContent = '🔇';
                muteButton.style.background = '#f56565';
            } else {
                const restoreVolume = channel.previousVolume || 1;
                channel.gainNode.gain.setValueAtTime(restoreVolume, this.audioContext.currentTime);
                muteButton.textContent = '🔊';
                muteButton.style.background = '#48bb78';
                
                // Update volume slider
                const volumeSlider = document.getElementById(`volume-${userId}`);
                if (volumeSlider) {
                    volumeSlider.value = restoreVolume;
                }
            }
        }
    }

    playRemoteAudio(userId, username, stream) {
        const audio = document.createElement('audio');
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.controls = false;
        
        // Store for cleanup
        this.audioChannels.set(userId, {
            audio: audio,
            username: username
        });
    }

    playRemoteAudio(userId, username, stream) {
        const audio = document.createElement('audio');
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.controls = false;
        
        // Store for cleanup
        this.audioChannels.set(userId, {
            audio: audio,
            username: username
        });
    }

    toggleMute() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            
            this.isMuted = !audioTracks[0].enabled;
            this.updateMuteButton();
            
            // Notify other participants
            this.socket.emit('user-muted', { isMuted: this.isMuted });
            
            this.logMessage(`Microphone ${this.isMuted ? 'muted' : 'unmuted'}`, 'info');
        }
    }

    updateMuteButton() {
        if (this.muteButton) {
            this.muteButton.textContent = this.isMuted ? '🔇 Unmute' : '🎤 Mute';
            this.muteButton.classList.toggle('muted', this.isMuted);
        }
    }

    adminMuteAll() {
        if (this.isAdmin) {
            this.socket.emit('admin-mute-all');
            this.logMessage('Sent mute all command', 'info');
        }
    }

    adminUnmuteAll() {
        if (this.isAdmin) {
            this.socket.emit('admin-unmute-all');
            this.logMessage('Sent unmute all command', 'info');
        }
    }

    handleAdminMute(data) {
        this.logMessage(`Muted by admin: ${data.adminName}`, 'info');
        if (!this.isMuted) {
            this.toggleMute();
        }
    }

    handleAdminUnmute(data) {
        this.logMessage(`Unmuted by admin: ${data.adminName}`, 'info');
        if (this.isMuted) {
            this.toggleMute();
        }
    }

    handleAdminMuteAll(data) {
        this.logMessage(`All participants muted by admin: ${data.adminName}`, 'info');
        if (!this.isMuted) {
            this.toggleMute();
        }
    }

    handleAdminUnmuteAll(data) {
        this.logMessage(`All participants unmuted by admin: ${data.adminName}`, 'info');
        if (this.isMuted) {
            this.toggleMute();
        }
    }

    handleUserLeft(data) {
        this.logMessage(`${data.username} left the call`, 'info');
        
        // Clean up peer connection
        if (this.peers.has(data.userId)) {
            const peer = this.peers.get(data.userId);
            peer.connection.close();
            this.peers.delete(data.userId);
        }
        
        // Clean up audio channel
        if (this.audioChannels.has(data.userId)) {
            const channel = this.audioChannels.get(data.userId);
            if (channel.audio) {
                channel.audio.remove();
            }
            if (channel.source) {
                channel.source.disconnect();
            }
            this.audioChannels.delete(data.userId);
        }
        
        // Remove from UI
        this.removeParticipant(data.userId);
        this.removeChannelControlUI(data.userId);
    }

    removeChannelControlUI(userId) {
        const channelElement = document.getElementById(`channel-${userId}`);
        if (channelElement) {
            channelElement.remove();
        }
    }

    leaveCall() {
        this.socket.emit('leave-call');
        this.cleanup();
        this.hideCallControls();
        this.hideAdminPanel();
        this.logMessage('Left the call', 'info');
    }

    cleanup() {
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Close all peer connections
        this.peers.forEach(peer => {
            peer.connection.close();
        });
        this.peers.clear();
        
        // Clean up audio channels
        this.audioChannels.forEach(channel => {
            if (channel.audio) {
                channel.audio.remove();
            }
            if (channel.source) {
                channel.source.disconnect();
            }
        });
        this.audioChannels.clear();
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.isInCall = false;
        this.channelIndex = 0;
        this.clearParticipants();
        this.clearAudioChannels();
    }

    clearAudioChannels() {
        if (this.audioChannels) {
            this.audioChannels.innerHTML = '';
        }
    }

    // UI Helper Methods
    updateConnectionStatus(status, isConnected) {
        this.connectionStatus.textContent = status;
        this.connectionStatus.className = isConnected ? 'connected' : 'disconnected';
    }

    showCallControls() {
        this.callControls.style.display = 'flex';
        document.querySelector('.user-info').style.display = 'none';
    }

    hideCallControls() {
        this.callControls.style.display = 'none';
        document.querySelector('.user-info').style.display = 'grid';
        this.adminPasswordInput.style.display = 'none';
        this.adminButton.textContent = 'Admin Mode';
        this.adminButton.onclick = () => this.showAdminPasswordField();
    }

    showAuthError(message) {
        // Clear password fields
        this.passwordInput.value = '';
        this.adminPasswordInput.value = '';
        
        // Add visual feedback
        this.passwordInput.style.borderColor = '#f56565';
        if (this.adminPasswordInput.style.display === 'block') {
            this.adminPasswordInput.style.borderColor = '#f56565';
        }
        
        // Reset border colors after 3 seconds
        setTimeout(() => {
            this.passwordInput.style.borderColor = '#e2e8f0';
            this.adminPasswordInput.style.borderColor = '#e2e8f0';
        }, 3000);
    }

    showAdminPanel() {
        this.adminPanel.style.display = 'block';
    }

    hideAdminPanel() {
        this.adminPanel.style.display = 'none';
    }

    addParticipant(participant) {
        const li = document.createElement('li');
        li.id = `participant-${participant.userId}`;
        li.innerHTML = `
            ${participant.username} 
            ${participant.isAdmin ? '<span style="color: #667eea; font-weight: bold;">(Admin)</span>' : ''}
            <span class="mute-status" id="mute-${participant.userId}"></span>
        `;
        this.participantsList.appendChild(li);
    }

    removeParticipant(userId) {
        const element = document.getElementById(`participant-${userId}`);
        if (element) {
            element.remove();
        }
    }

    updateParticipantMuteStatus(data) {
        const muteStatus = document.getElementById(`mute-${data.userId}`);
        if (muteStatus) {
            muteStatus.textContent = data.isMuted ? '🔇' : '';
        }
    }

    clearParticipants() {
        this.participantsList.innerHTML = '';
    }

    logMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.statusLog.appendChild(logEntry);
        this.statusLog.scrollTop = this.statusLog.scrollHeight;
        
        console.log(`[VoiceCall] ${message}`);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.voiceApp = new VoiceCallApp();
});