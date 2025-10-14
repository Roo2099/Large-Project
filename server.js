require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const apiRoutes = require('./api');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Mount API routes
app.use('/api', apiRoutes);

// Serve frontend build
app.use(express.static(path.join(__dirname, 'frontend/frontend-skillswap/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/frontend-skillswap/dist', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
