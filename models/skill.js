const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  SkillName: { type: String, required: true },
  UserID: { type: Number, required: true }, // 👈 FIXED name
  Category: String,
  Description: String,
  Type: { type: String, enum: ['offer', 'need'], default: 'offer' }
});

module.exports = mongoose.model('Skill', skillSchema);
