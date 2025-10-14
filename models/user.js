const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  UserID: Number,
  FirstName: String,
  LastName: String,
  Login: { type: String, required: true, unique: true },
  Password: { type: String, required: true },

  // --- Email Verification ---
  verified: { type: Boolean, default: false },
  verificationToken: { type: String },

  // --- Password Reset ---
  resetToken: { type: String },
  resetTokenExpires: { type: Date }
});

module.exports = mongoose.model('User', userSchema);
