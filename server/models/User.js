const mongoose = require('mongoose');

module.exports = mongoose.model('User', new mongoose.Schema({
  username:  { type: String, required: true, unique: true, trim: true },
  email:     { type: String, unique: true, sparse: true, lowercase: true, trim: true }, // purane users ke paas nahi hoga
  password:  { type: String, required: true },
  avatarUrl: { type: String, default: null },
  lastSeen:  { type: Date, default: null },

  // Block user
  blockedUsers: { type: [String], default: [] },

  // Forgot password OTP (select:false => kabhi API response mein nahi jayega)
  resetOtpHash:     { type: String, select: false },
  resetOtpExpires:  { type: Date,   select: false },
  resetOtpAttempts: { type: Number, default: 0, select: false },
}, { timestamps: true }));