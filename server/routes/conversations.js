const router       = require("express").Router();
const Conversation = require("../models/Conversation");
const Message      = require("../models/Message");
const User         = require("../models/User");
const auth         = require("../middleware/auth");

router.get("/", auth, async (req, res) => {
  const me = req.user.username;
  const convs = await Conversation.find({
    members: me,
    hiddenFor: { $ne: me },
  }).sort({ lastMessageTime: -1 });

  const result = await Promise.all(convs.map(async (c) => {
    const other = c.members.find(m => m !== me);
    const otherUserDoc = other ? await User.findOne({ username: other }).select("username avatarUrl lastSeen") : null;
    return {
      ...c.toObject(),
      unreadCount: c.unreadCount?.[me] || 0,
      otherUserInfo: otherUserDoc
        ? { username: otherUserDoc.username, avatarUrl: otherUserDoc.avatarUrl, lastSeen: otherUserDoc.lastSeen }
        : null,
    };
  }));

  res.json(result);
});

router.post("/", auth, async (req, res) => {
  const { otherUser } = req.body;
  const me = req.user.username;
  let conv = await Conversation.findOne({ members: { $all: [me, otherUser] }, isGroup: { $ne: true } });
  if (!conv) {
    conv = await Conversation.create({ members: [me, otherUser] });
  } else if (conv.hiddenFor.includes(me)) {
    conv.hiddenFor = conv.hiddenFor.filter(u => u !== me);
    await conv.save();
  }
  res.json({ ...conv.toObject(), unreadCount: conv.unreadCount?.[me] || 0 });
});

// ---------- MESSAGES (pagination) ----------
// GET /:convId/messages?limit=30&before=<createdAt ISO>
// Response: { messages: [...purane->naye], hasMore: true/false, pinned: msg|null }
router.get("/:convId/messages", auth, async (req, res) => {
  try {
    const me = req.user.username;
    const conv = await Conversation.findById(req.params.convId);
    if (!conv || !conv.members.includes(me)) return res.status(403).json({ message: "Not allowed" });

    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const clearedAt = conv.clearedAt?.[me] ? new Date(conv.clearedAt[me]) : null;

    const createdAt = {};
    if (clearedAt) createdAt.$gt = clearedAt;
    if (req.query.before) {
      const b = new Date(req.query.before);
      if (!isNaN(b)) createdAt.$lt = b;
    }

    const query = { conversationId: req.params.convId, deletedFor: { $ne: me } };
    if (Object.keys(createdAt).length) query.createdAt = createdAt;

    const fmt = (m) => ({
      ...m.toObject(),
      content: m.deletedForEveryone ? "This message was deleted" : m.content,
    });

    const docs    = await Message.find(query).sort({ createdAt: -1 }).limit(limit + 1);
    const hasMore = docs.length > limit;
    const messages = docs.slice(0, limit).reverse().map(fmt);

    // pehli load par pinned message bhi bhejo (chahe wo purana ho)
    let pinned = null;
    if (!req.query.before) {
      const pq = { conversationId: req.params.convId, pinned: true, deletedForEveryone: false, deletedFor: { $ne: me } };
      if (clearedAt) pq.createdAt = { $gt: clearedAt };
      const p = await Message.findOne(pq);
      if (p) pinned = fmt(p);
    }

    res.json({ messages, hasMore, pinned });
  } catch (err) {
    console.error("get messages error:", err);
    res.status(500).json({ message: "Could not load messages" });
  }
});

router.delete("/:convId", auth, async (req, res) => {
  const me = req.user.username;
  const conv = await Conversation.findById(req.params.convId);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });

  if (!conv.hiddenFor.includes(me)) conv.hiddenFor.push(me);
  if (!conv.clearedAt) conv.clearedAt = {};
  conv.clearedAt[me] = new Date();
  conv.markModified("clearedAt");
  await conv.save();

  res.json({ ok: true });
});

module.exports = router;