# Voice Call App with Channel Separation

A real-time voice calling application that allows multiple users to join a call, with a special admin interface that routes each caller's audio to separate channels for professional audio monitoring and mixing.

## 🎯 Key Features

- **Multi-user Voice Calls**: Support for multiple participants in a single call
- **WebRTC P2P Audio**: High-quality peer-to-peer audio streaming
- **Admin Channel Separation**: Route each caller to separate stereo channels/positions
- **Real-time Audio Controls**: Volume, pan, mute, and solo controls for each channel
- **Web Audio API Integration**: Professional-grade audio processing and routing
- **Responsive Interface**: Clean, modern UI that works on desktop and mobile
- **Admin Controls**: Mute all, unmute all, and individual participant management

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Modern web browser with WebRTC support
- Microphone access permissions

### Installation

1. **Clone or download the project**:
   ```bash
   cd voicecallapp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - Open your browser and navigate to `http://localhost:3000`
   - For development with auto-restart: `npm run dev`

## 🎛️ How to Use

### For Regular Users

1. **Join the Call**:
   - Enter your name in the username field
   - Click "Join Call" button
   - Allow microphone access when prompted

2. **Call Controls**:
   - **Mute/Unmute**: Toggle your microphone
   - **Leave Call**: Exit the call

### For Admin (You)

1. **Join as Admin**:
   - Enter your name in the username field
   - Click "Admin Mode" button
   - Allow microphone access when prompted

2. **Admin Features**:
   - **Channel Separation**: Each participant gets assigned to a different audio channel
   - **Individual Controls**: 
     - Volume slider for each participant
     - Pan control (left/right positioning)
     - Mute button for individual channels
     - Solo button to isolate one participant
   - **Global Controls**:
     - Mute All participants
     - Unmute All participants
     - Output device selection

## 🎛️ Loopback Integration (16-Channel Output)

This app is specifically enhanced for use with **Loopback** or other multi-channel audio interfaces:

### Setting Up Loopback
1. **Create a Virtual Device** in Loopback with 16 channels
2. **Set Browser Audio Output** to your Loopback device
3. **Route Channels** in Loopback to your desired destinations (DAW, hardware, etc.)

### Admin Features for Multi-Channel
- **Discrete Channel Assignment**: Each caller gets assigned to channels 1-16
- **Channel Reassignment**: Drag-and-drop or select different output channels
- **Individual Volume Control**: 0-200% gain per channel
- **Real-time Routing**: Move users between channels without reconnection

### Professional Workflow
```
Caller 1 → Browser → Loopback Ch 1 → Your DAW Track 1
Caller 2 → Browser → Loopback Ch 2 → Your DAW Track 2
Caller 3 → Browser → Loopback Ch 3 → Your DAW Track 3
...etc (up to 16 callers)
```

This gives you perfect isolation for:
- **Recording**: Each person on separate tracks
- **Live Mixing**: Individual faders in your mixer
- **Processing**: Different effects per caller
- **Monitoring**: Solo/mute any participant

## 🌐 Network Requirements

### Ports
- **HTTP Server**: Port 3000 (configurable via PORT environment variable)
- **WebRTC**: Uses STUN servers for NAT traversal

### Firewall Considerations
- Ensure port 3000 is accessible for HTTP connections
- WebRTC may require additional firewall configuration for some networks
- For production deployment, consider using TURN servers for better connectivity

## 🛠️ Technical Architecture

### Frontend
- **WebRTC**: Peer-to-peer audio connections
- **Socket.IO**: Real-time signaling for connection establishment
- **Web Audio API**: Advanced audio processing and channel routing
- **Vanilla JavaScript**: No framework dependencies for maximum compatibility

### Backend
- **Node.js**: Server runtime
- **Express**: HTTP server for static files
- **Socket.IO**: WebSocket communication for signaling

## 📁 Project Structure

```
voicecallapp/
├── server.js              # Node.js server with Socket.IO signaling
├── package.json           # Dependencies and scripts
├── README.md              # This file
└── public/                # Client-side files
    ├── index.html         # Main HTML interface
    ├── styles.css         # Responsive CSS styling
    └── app.js             # WebRTC and audio processing logic
```

## 🔍 Troubleshooting

### Common Issues

1. **Microphone Access Denied**:
   - Check browser permissions for microphone access
   - Ensure you're using HTTPS in production (required for getUserMedia)
   - Try refreshing the page and allowing permissions

2. **Can't Hear Other Participants**:
   - Check your system audio output
   - Verify the output device selection in admin mode
   - Ensure participants have allowed microphone access

3. **Connection Issues**:
   - Check the status log for detailed error messages
   - Verify network connectivity
   - Try refreshing all participants

4. **Audio Channel Separation Not Working**:
   - Ensure you're in Admin Mode
   - Check browser console for Web Audio API errors
   - Verify your browser supports Web Audio API

### Browser Support

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Good support (may have some Web Audio API limitations)
- **Mobile Browsers**: Basic support (channel separation may be limited)

## 🚀 Production Deployment

For production use:

1. **Environment Variables**:
   ```bash
   export PORT=3000
   export NODE_ENV=production
   ```

2. **HTTPS Setup**:
   - WebRTC requires HTTPS in production
   - Use a reverse proxy like Nginx with SSL certificates

3. **TURN Servers**:
   - Add TURN servers to the WebRTC configuration for better connectivity
   - Consider services like Twilio, Amazon Kinesis, or self-hosted Coturn

4. **Process Management**:
   - Use PM2 or similar for process management
   - Set up monitoring and logging

## 📊 API Endpoints

- `GET /`: Main application interface
- `GET /api/stats`: Server statistics (users, rooms, etc.)
- WebSocket events handled via Socket.IO

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License - see package.json for details

## 🎵 Audio Notes

The channel separation feature is designed for professional audio monitoring. Each participant's audio is:

- Processed through the Web Audio API
- Positioned in the stereo field
- Individually controllable
- Mixed in real-time without affecting other users' experience

This makes it perfect for:
- Podcast recording with multiple guests
- Music collaboration
- Professional conferencing
- Audio monitoring and quality control