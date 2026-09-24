const mongoose = require('mongoose');
module.exports = mongoose.model('Room', new mongoose.Schema({
  name:      { type: String, required: true, unique: true },
  createdBy: { type: String, required: true },
}, { timestamps: true }));