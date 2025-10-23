// models/friendRequest.js
const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  fromUserId: { type: Number, required: true },
  toUserId: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'declined'], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
