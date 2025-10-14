const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  SkillName: String,
  UserId: Number,
  Category: String,
  Description: String
});

module.exports = mongoose.model('Skill', skillSchema);
