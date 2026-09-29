const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express    = require("express");
const http       = require("http");
const path       = require("path");
const fs         = require("fs");
const multer     = require("multer");
const rateLimit  = require("express-rate-limit");
const jwt        = require("jsonwebtoken");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const cors       = require("cors");
require("dotenv").config();

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
process.on("uncaughtException",  (err) => console.error("Uncaught exception:", err));

const Message      = require("./models/Message");
const Conversation = require("./models/Conversation");
const User         = require("./models/User");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ---------- SOCKET AUTH MIDDLEWARE ----------
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.username = decoded.username; // ab ye trusted hai, client se nahi aaya
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
});

app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// ---------- GENERAL RATE LIMIT ----------
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, slow down." },
}));

// ---------- FILE UPLOAD SETUP ----------
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads, slow down." },
});

app.post("/api/upload", uploadLimiter, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 25MB)" : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ url: `/uploads/${req.file.filename}`, fileName: req.file.originalname });
  });
});
// ---------- END FILE UPLOAD SETUP ----------

app.use("/api/auth",          require("./routes/auth"));
app.use("/api/users",         require("./routes/users"));
app.use("/api/conversations", require("./routes/conversations"));

app.use((err, req, res, next) => {
  console.error("Express error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: "Something went wrong" });
});

const onlineUsers = {};
const activeConv  = {};

const safe = (name, fn) => async (...args) => {
  try { await fn(...args); }
  catch (err) { console.error(`${name} error:`, err); }
};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id, "user:", socket.username);

  socket.on("user_online", safe("user_online", async () => {
    const username = socket.username;
    onlineUsers[username] = socket.id;
    io.emit("online_users", Object.keys(onlineUsers));

    const users = await User.find({}, "username lastSeen");
    const map = {};
    users.forEach(u => { if (u.lastSeen) map[u.username] = u.lastSeen; });
    socket.emit("initial_last_seen", map);
  }));

  socket.on("join_conversation", safe("join_conversation", ({ convId }) => {
    const username = socket.username;
    if (!convId) return;
    socket.join(String(convId));
    activeConv[username] = String(convId);
  }));

  socket.on("leave_conversation", safe("leave_conversation", ({ convId }) => {
    const username = socket.username;
    if (!convId) return;
    socket.leave(String(convId));
    if (activeConv[username] === String(convId)) delete activeConv[username];
  }));

  socket.on("send_message", safe("send_message", async ({ convId, content, type, fileUrl, fileName, duration, replyTo }) => {
    const sender  = socket.username; // client se nahi le rahe
    const msgType = type || "text";
    const text    = typeof content === "string" ? content : "";

    if (msgType === "text") {
      if (!text.trim()) return;
      if (text.length > 5000) {
        socket.emit("message_blocked", { convId, reason: "Message is too long (max 5000 characters)." });
        return;
      }
    } else if (!fileUrl) {
      return;
    }

    const conv = await Conversation.findById(convId);
    if (!conv || !conv.members.includes(sender)) return;

    const recipients = conv.members.filter(m => m !== sender);

    // ---------- BLOCK CHECK ----------
    if (!conv.isGroup && recipients.length === 1) {
      const other = recipients[0];
      const [meDoc, otherDoc] = await Promise.all([
        User.findOne({ username: sender }).select("blockedUsers"),
        User.findOne({ username: other }).select("blockedUsers"),
      ]);
      if (meDoc?.blockedUsers?.includes(other)) {
        socket.emit("message_blocked", { convId, reason: "You blocked this user. Unblock to send messages." });
        return;
      }
      if (otherDoc?.blockedUsers?.includes(sender)) {
        socket.emit("message_blocked", { convId, reason: "Message could not be delivered." });
        return;
      }
    }

    const deliveredNow = recipients.some(m => onlineUsers[m]);

    const msg = await Message.create({
      conversationId: convId,
      sender,
      content: text,
      type: msgType,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      duration: duration || null,
      delivered: deliveredNow,
      replyTo: replyTo || undefined,
    });

    conv.hiddenFor = (conv.hiddenFor || []).filter(u => !recipients.includes(u));
    conv.markModified("hiddenFor");

    if (!conv.unreadCount) conv.unreadCount = {};
    recipients.forEach(m => {
      if (activeConv[m] === String(convId)) return;
      const current = conv.unreadCount[m] || 0;
      conv.unreadCount[m] = current + 1;
    });
    conv.markModified("unreadCount");
    conv.lastMessage =
      msgType === "image" ? "📷 Photo" :
      msgType === "file"  ? "📄 File" :
      msgType === "voice" ? "🎤 Voice message" : text;
    conv.lastMessageTime = new Date();
    await conv.save();

    io.to(String(convId)).emit("receive_message", {
      _id: msg._id,
      conversationId: convId,
      convId,
      sender,
      content: msg.content,
      type: msg.type,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      duration: msg.duration,
      createdAt: msg.createdAt,
      seen: false,
      delivered: msg.delivered,
      edited: false,
      pinned: false,
      replyTo: msg.replyTo,
    });

    io.emit("conversation_updated", {
      convId,
      sender,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      unreadCount: conv.unreadCount,
    });
  }));

  socket.on("edit_message", safe("edit_message", async ({ messageId, convId, newContent }) => {
    const username = socket.username;
    if (typeof newContent !== "string" || !newContent.trim() || newContent.length > 5000) return;
    const msg = await Message.findById(messageId);
    if (!msg || msg.sender !== username || msg.deletedForEveryone || msg.type !== "text") return;
    msg.content = newContent;
    msg.edited = true;
    await msg.save();
    io.to(String(convId)).emit("message_edited", { messageId, content: msg.content, edited: true });
  }));

  // ---------- PIN MESSAGE (ek conversation mein ek hi pin) ----------
  socket.on("pin_message", safe("pin_message", async ({ messageId, convId, pin }) => {
    const username = socket.username;
    const conv = await Conversation.findById(convId);
    if (!conv || !conv.members.includes(username)) return;
    const msg = await Message.findById(messageId);
    if (!msg || String(msg.conversationId) !== String(convId) || msg.deletedForEveryone) return;

    if (pin) {
      await Message.updateMany({ conversationId: convId, pinned: true }, { $set: { pinned: false } });
      msg.pinned = true;
      await msg.save();
      io.to(String(convId)).emit("pins_updated", { convId, pinned: msg.toObject() });
    } else {
      msg.pinned = false;
      await msg.save();
      io.to(String(convId)).emit("pins_updated", { convId, pinned: null });
    }
  }));

  socket.on("typing", safe("typing", ({ convId, receiver }) => {
    const sender = socket.username;
    const targetSocketId = onlineUsers[receiver];
    if (targetSocketId) io.to(targetSocketId).emit("user_typing", { convId, sender });
  }));

  socket.on("stop_typing", safe("stop_typing", ({ convId, receiver }) => {
    const sender = socket.username;
    const targetSocketId = onlineUsers[receiver];
    if (targetSocketId) io.to(targetSocketId).emit("user_stop_typing", { convId, sender });
  }));

  socket.on("seen_conversation", safe("seen_conversation", async ({ convId }) => {
    const username = socket.username;
    const conv = await Conversation.findById(convId);
    if (!conv) return;
    if (!conv.unreadCount) conv.unreadCount = {};
    conv.unreadCount[username] = 0;
    conv.markModified("unreadCount");
    await conv.save();
    io.emit("conversation_updated", {
      convId,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      unreadCount: conv.unreadCount,
    });
  }));

  socket.on("delete_message", safe("delete_message", async ({ messageId, convId, forEveryone }) => {
    const username = socket.username;
    const msg = await Message.findById(messageId);
    if (!msg) return;

    if (forEveryone) {
      if (msg.sender !== username) return;
      const wasPinned = msg.pinned;
      msg.deletedForEveryone = true;
      msg.pinned = false;
      msg.content = "";
      msg.fileUrl = null;
      msg.fileName = null;
      await msg.save();
      io.to(String(convId)).emit("message_deleted", { messageId, forEveryone: true });
      if (wasPinned) io.to(String(convId)).emit("pins_updated", { convId, pinned: null });
    } else {
      if (!msg.deletedFor.includes(username)) {
        msg.deletedFor.push(username);
        await msg.save();
      }
      socket.emit("message_deleted", { messageId, forEveryone: false });
    }
  }));

  socket.on("markAsSeen", safe("markAsSeen", async ({ conversationId, userId }) => {
    await Message.updateMany(
      { conversationId, sender: { $ne: userId }, seen: false },
      { $set: { seen: true, delivered: true } }
    );
    io.emit("messagesSeen", { conversationId, viewer: userId });
  }));

  socket.on("disconnect", safe("disconnect", async () => {
    const username = socket.username;
    if (onlineUsers[username] === socket.id) {
      delete onlineUsers[username];
      delete activeConv[username];
      const now = new Date();
      await User.findOneAndUpdate({ username }, { lastSeen: now });
      io.emit("user_last_seen", { username, lastSeen: now });
    }
    io.emit("online_users", Object.keys(onlineUsers));
  }));
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(process.env.PORT || 5000, () =>
      console.log("Server running on port " + (process.env.PORT || 5000))
    );
  })
  .catch(err => console.error("DB connection error:", err));