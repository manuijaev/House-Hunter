const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Firebase Admin SDK setup
const serviceAccount = require('./firebase-service-account.json'); // You'll need to create this

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Add your Firebase project config here
});

const db = getFirestore();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"]
  }
});

// Store active users and their socket connections
const activeUsers = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication and setup
  socket.on('authenticate', (userData) => {
    const { userId, userType } = userData;
    activeUsers.set(userId, { socketId: socket.id, userType });
    userSockets.set(socket.id, userId);
    console.log(`User ${userId} (${userType}) authenticated`);
  });

  // Handle joining chat rooms
  socket.on('join_chat', (data) => {
    const { chatId } = data;
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat: ${chatId}`);
  });

  // Handle leaving chat rooms
  socket.on('leave_chat', (data) => {
    const { chatId } = data;
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat: ${chatId}`);
  });

  // Handle sending messages
  socket.on('send_message', async (messageData) => {
    try {
      // Save message to Firestore
      const messageRef = await addDoc(collection(db, 'messages'), {
        ...messageData,
        timestamp: serverTimestamp(),
        id: Date.now().toString() // Generate a unique ID
      });

      // Get the saved message with Firestore-generated ID
      const savedMessage = {
        ...messageData,
        id: messageRef.id,
        timestamp: new Date()
      };

      // Emit to all users in the chat room (including sender)
      io.to(messageData.chatId).emit('receive_message', savedMessage);

      console.log(`Message sent in chat ${messageData.chatId}: ${messageData.content.substring(0, 50)}...`);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userId = userSockets.get(socket.id);
    if (userId) {
      activeUsers.delete(userId);
      userSockets.delete(socket.id);
      console.log(`User ${userId} disconnected`);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});