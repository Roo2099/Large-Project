require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const apiRoutes = require('./api');

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== MongoDB connection =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ===== API routes =====
app.use('/api', apiRoutes);

// ===== Serve frontend (production) =====
const frontendPath = '/var/www/skillswap';
app.use(express.static(frontendPath));
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// ===== Create HTTP + WebSocket Server =====
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // allow all for now; can tighten later
    methods: ['GET', 'POST', 'DELETE']
  }
});

// ===== Socket.IO setup =====
io.on('connection', (socket) => {
  console.log(`🟢 New socket connected: ${socket.id}`);

  // Example: handle a message event
  socket.on('send_message', (data) => {
    console.log('📩 Message received:', data);
    // Broadcast to recipient (if connected)
    io.emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Socket disconnected: ${socket.id}`);
  });
});

// ===== Start server =====
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
