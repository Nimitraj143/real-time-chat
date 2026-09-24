const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  members: [{ type: String }],
  isGroup: { type: Boolean, default: false },             // 👈 NEW — Round 2 groups ke liye
  groupName: { type: String, default: null },
  groupAdmin: { type: String, default: null },
  lastMessage: { type: String, default: "" },
  lastMessageTime: { type: Date, default: Date.now },
  unreadCount: { type: mongoose.Schema.Types.Mixed, default: {} },
  hiddenFor: { type: [String], default: [] },              // 👈 NEW — delete-for-me
  clearedAt: { type: mongoose.Schema.Types.Mixed, default: {} }, // 👈 NEW — username -> Date
}, { timestamps: true });

module.exports = mongoose.model("Conversation", conversationSchema);