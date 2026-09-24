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
    conv.hiddenFor = conv.hiddenFor.filter(u => u !== me);   // wapas dikhao, history clearedAt se filter hogi
    await conv.save();
  }
  res.json({ ...conv.toObject(), unreadCount: conv.unreadCount?.[me] || 0 });
});

router.get("/:convId/messages", auth, async (req, res) => {
  const me = req.user.username;
  const conv = await Conversation.findById(req.params.convId);
  const clearedAt = conv?.clearedAt?.[me] ? new Date(conv.clearedAt[me]) : null;

  const query = { conversationId: req.params.convId };
  if (clearedAt) query.createdAt = { $gt: clearedAt };

  const messages = await Message.find(query).sort({ createdAt: 1 }).limit(200);

  const result = messages
    .filter(m => !m.deletedFor.includes(me))
    .map(m => ({
      ...m.toObject(),
      content: m.deletedForEveryone ? "This message was deleted" : m.content,
    }));

  res.json(result);
});

router.delete("/:convId", auth, async (req, res) => {               // 👈 NEW — delete for me
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