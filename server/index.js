const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const express    = require("express");
const http       = require("http");
const path       = require("path");
const fs         = require("fs");
const multer     = require("multer");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const cors       = require("cors");
require("dotenv").config();

const Message      = require("./models/Message");
const Conversation = require("./models/Conversation");
const User         = require("./models/User");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// ---------- FILE UPLOAD SETUP ----------
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}`, fileName: req.file.originalname });
});
// ---------- END FILE UPLOAD SETUP ----------

app.use("/api/auth",          require("./routes/auth"));
app.use("/api/users",         require("./routes/users"));
app.use("/api/conversations", require("./routes/conversations"));

const onlineUsers = {};
const activeConv  = {};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("user_online", async (username) => {
    onlineUsers[username] = socket.id;
    io.emit("online_users", Object.keys(onlineUsers));

    try {
      const users = await User.find({}, "username lastSeen");
      const map = {};
      users.forEach(u => { if (u.lastSeen) map[u.username] = u.lastSeen; });
      socket.emit("initial_last_seen", map);
    } catch (err) { console.error("initial_last_seen error:", err); }
  });

  socket.on("join_conversation", ({ convId, username }) => {
  socket.join(convId);
  activeConv[username] = convId;
});

socket.on("leave_conversation", ({ convId, username }) => {
  socket.leave(convId);
  if (activeConv[username] === convId) delete activeConv[username];
});

  socket.on("send_message", async ({ convId, sender, content, type, fileUrl, fileName, duration, replyTo }) => {
    const conv = await Conversation.findById(convId);
    if (!conv) return;

    const recipients   = conv.members.filter(m => m !== sender);
    const deliveredNow = recipients.some(m => onlineUsers[m]);

    const msg = await Message.create({
      conversationId: convId,
      sender,
      content: content || "",
      type: type || "text",
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      duration: duration || null,
      delivered: deliveredNow,
      replyTo: replyTo || undefined,
    });

    conv.hiddenFor = conv.hiddenFor.filter(u => !recipients.includes(u));
    conv.markModified("hiddenFor");

    recipients.forEach(m => {
      if (activeConv[m] === convId) return;
      const current = conv.unreadCount[m] || 0;
      conv.unreadCount[m] = current + 1;
    });
    conv.markModified("unreadCount");
    conv.lastMessage     = type === "image" ? "📷 Photo" : type === "file" ? "📄 File" : type === "voice" ? "🎤 Voice message" : content;
    conv.lastMessageTime = new Date();
    await conv.save();

    io.to(convId).emit("receive_message", {
      _id: msg._id,
      conversationId: convId,
      convId,
      sender,
      content,
      type: msg.type,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      duration: msg.duration,
      createdAt: msg.createdAt,
      seen: false,
      delivered: msg.delivered,
      edited: false,
      replyTo: msg.replyTo,
    });

    io.emit("conversation_updated", {
      convId,
      sender,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      unreadCount: conv.unreadCount,
    });
  });

  socket.on("edit_message", async ({ messageId, convId, newContent, username }) => {
    const msg = await Message.findById(messageId);
    if (!msg || msg.sender !== username || msg.deletedForEveryone || msg.type !== "text") return;
    msg.content = newContent;
    msg.edited = true;
    await msg.save();
    io.to(convId).emit("message_edited", { messageId, content: msg.content, edited: true });
  });

  socket.on("typing", ({ convId, sender, receiver }) => {
    const targetSocketId = onlineUsers[receiver];
    if (targetSocketId) io.to(targetSocketId).emit("user_typing", { convId, sender });
  });

  socket.on("stop_typing", ({ convId, sender, receiver }) => {
    const targetSocketId = onlineUsers[receiver];
    if (targetSocketId) io.to(targetSocketId).emit("user_stop_typing", { convId, sender });
  });

  socket.on("seen_conversation", async ({ convId, username }) => {
    const conv = await Conversation.findById(convId);
    if (!conv) return;
    conv.unreadCount[username] = 0;
    conv.markModified("unreadCount");
    await conv.save();
    io.emit("conversation_updated", {
      convId,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      unreadCount: conv.unreadCount,
    });
  });

  socket.on("delete_message", async ({ messageId, convId, username, forEveryone }) => {
    const msg = await Message.findById(messageId);
    if (!msg) return;
    if (forEveryone) {
      if (msg.sender !== username) return;
      msg.deletedForEveryone = true;
      msg.content = "";
      msg.fileUrl = null;
      msg.fileName = null;
      await msg.save();
      io.to(convId).emit("message_deleted", { messageId, forEveryone: true });
    } else {
      if (!msg.deletedFor.includes(username)) {
        msg.deletedFor.push(username);
        await msg.save();
      }
      socket.emit("message_deleted", { messageId, forEveryone: false });
    }
  });

  socket.on("markAsSeen", async ({ conversationId, userId }) => {
    await Message.updateMany(
      { conversationId, sender: { $ne: userId }, seen: false },
      { $set: { seen: true, delivered: true } }
    );
    io.emit("messagesSeen", { conversationId, viewer: userId });
  });

  socket.on("disconnect", async () => {
    for (const [username, id] of Object.entries(onlineUsers)) {
      if (id === socket.id) {
        delete onlineUsers[username];
        delete activeConv[username];
        const now = new Date();
        try { await User.findOneAndUpdate({ username }, { lastSeen: now }); }
        catch (err) { console.error("lastSeen save error:", err); }
        io.emit("user_last_seen", { username, lastSeen: now });
        break;
      }
    }
    io.emit("online_users", Object.keys(onlineUsers));
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(process.env.PORT || 5000, () =>
      console.log("Server running on port " + (process.env.PORT || 5000))
    );
  })
  .catch(err => console.error("DB connection error:", err));