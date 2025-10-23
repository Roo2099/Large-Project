const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  SkillName: String,
  UserId: Number,
  Category: String,
  Description: String,
  Type: { type: String, enum: ['offer', 'need'], default: 'offer' } // 👈 NEW FIELD
});

module.exports = mongoose.model('Skill', skillSchema);
