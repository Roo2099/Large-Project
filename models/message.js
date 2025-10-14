const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from: Number,
  to: Number,
  body: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
