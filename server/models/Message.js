const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  sender: { type: String, required: true },
  content: { type: String, default: "" },
  type: { type: String, enum: ["text", "image", "file", "voice"], default: "text" },   // 👈 "voice" added
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  duration: { type: Number, default: null },      // 👈 NEW — voice note length in seconds
  seen: { type: Boolean, default: false },
  delivered: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  replyTo: {
    messageId: { type: String, default: null },
    sender:    { type: String, default: null },
    content:   { type: String, default: null },
    type:      { type: String, default: null },
  },
  deletedFor: { type: [String], default: [] },
  deletedForEveryone: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);