const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const cors       = require("cors");
require("dotenv").config();

const Message      = require("./models/Message");
const Conversation = require("./models/Conversation");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

app.use("/api/auth",          require("./routes/auth"));
app.use("/api/users",         require("./routes/users"));
app.use("/api/conversations", require("./routes/conversations"));

const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("user_online", (username) => {
    onlineUsers[username] = socket.id;
    io.emit("online_users", Object.keys(onlineUsers));
  });

  socket.on("join_conversation", (convId) => {
    socket.join(convId);
  });

  socket.on("leave_conversation", (convId) => {
    socket.leave(convId);
  });

  socket.on("send_message", async ({ convId, sender, content }) => {
  const msg = await Message.create({ conversationId: convId, sender, content });

  const conv = await Conversation.findById(convId);

  // safety: agar unreadCount Map nahi hai to naya Map bana do
  if (!(conv.unreadCount instanceof Map)) {
    conv.unreadCount = new Map(Object.entries(conv.unreadCount || {}));
  }

  conv.members.forEach(m => {
    if (m !== sender) {
      const current = conv.unreadCount.get(m) || 0;
      conv.unreadCount.set(m, current + 1);
    }
  });
  conv.lastMessage     = content;
  conv.lastMessageTime = new Date();
  await conv.save();

  io.to(convId).emit("receive_message", {
    _id: msg._id, conversationId: convId, sender, content, createdAt: msg.createdAt, seen: false,
  });

  io.emit("conversation_updated", {
    convId,
    lastMessage: content,
    lastMessageTime: conv.lastMessageTime,
    unreadCount: Object.fromEntries(conv.unreadCount),
  });
});

  socket.on("typing", ({ convId, username }) => {
    socket.to(convId).emit("user_typing", { username, convId });
  });

  socket.on("stop_typing", ({ convId, username }) => {
    socket.to(convId).emit("user_stop_typing", { username, convId });
  });

  socket.on("seen_conversation", async ({ convId, username }) => {
  const conv = await Conversation.findById(convId);
  if (!conv) return;

  if (!(conv.unreadCount instanceof Map)) {
    conv.unreadCount = new Map(Object.entries(conv.unreadCount || {}));
  }

  conv.unreadCount.set(username, 0);
  await conv.save();

  await Message.updateMany(
    { conversationId: convId, sender: { $ne: username }, seen: false },
    { $set: { seen: true } }
  );

  io.to(convId).emit("messages_seen", { convId });
  io.emit("conversation_updated", {
    convId,
    lastMessage: conv.lastMessage,
    lastMessageTime: conv.lastMessageTime,
    unreadCount: Object.fromEntries(conv.unreadCount),
  });
});

  socket.on("disconnect", () => {
    for (const [username, id] of Object.entries(onlineUsers)) {
      if (id === socket.id) {
        delete onlineUsers[username];
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