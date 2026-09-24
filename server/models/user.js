const mongoose = require('mongoose');
module.exports = mongoose.model('User', new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },
  avatarUrl: { type: String, default: null },   // 👈 NEW
  lastSeen:  { type: Date, default: null },     // 👈 NEW — null jab tak pehli baar offline na ho
}, { timestamps: true }));