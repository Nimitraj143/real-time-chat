const mongoose = require('mongoose');

module.exports = mongoose.model('User', new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true },
  password:  { type: String, required: true },
  avatarUrl: { type: String, default: null },
  lastSeen:  { type: Date, default: null },
}, { timestamps: true }));