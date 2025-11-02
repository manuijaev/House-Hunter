# House Hunter Socket.IO Server

This is the Socket.IO server for real-time messaging in the House Hunter application.

## Setup

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Firebase Admin SDK Setup:**
   - Go to your Firebase Console
   - Navigate to Project Settings > Service Accounts
   - Generate a new private key and download the JSON file
   - Rename it to `firebase-service-account.json` and place it in the `server/` directory

3. **Environment Variables:**
   Create a `.env` file in the server directory with:
   ```
   PORT=3001
   ```

4. **Start the server:**
   ```bash
   npm run dev  # For development with nodemon
   # or
   npm start    # For production
   ```

## Features

- **Real-time messaging** between tenants and landlords
- **Room-based chat** for private conversations
- **Firebase integration** for message persistence
- **User authentication** and authorization
- **Connection management** with automatic cleanup

## API

### Socket Events

#### Client → Server
- `authenticate` - Authenticate user with server
- `join_chat` - Join a chat room
- `leave_chat` - Leave a chat room
- `send_message` - Send a message

#### Server → Client
- `receive_message` - Receive a new message
- `message_error` - Error sending message

## Architecture

The server uses Socket.IO for real-time communication and Firebase Admin SDK for database operations. Messages are stored in Firestore and broadcast to connected clients in real-time.