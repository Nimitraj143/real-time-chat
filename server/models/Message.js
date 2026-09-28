const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  sender: { type: String, required: true },
  content: { type: String, default: "" },
  type: { type: String, enum: ["text", "image", "file", "voice"], default: "text" },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  duration: { type: Number, default: null },
  seen: { type: Boolean, default: false },
  delivered: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },      // 👈 NEW — pin message
  replyTo: {
    messageId: { type: String, default: null },
    sender:    { type: String, default: null },
    content:   { type: String, default: null },
    type:      { type: String, default: null },
  },
  deletedFor: { type: [String], default: [] },
  deletedForEveryone: { type: Boolean, default: false },
}, { timestamps: true });

// 👈 NEW — pagination fast rakhne ke liye
messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);