const router  = require('express').Router();
const Message = require('../models/Message');
const auth    = require('../middleware/auth');

router.get('/:room', auth, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room }).sort({ createdAt: 1 }).limit(50);
    res.json(messages);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
// unread count nikalne wala route
router.get("/unread/:userId", async (req, res) => {
  const { userId } = req.params;
  const unreadCounts = await Message.aggregate([
    { $match: { seen: false, sender: { $ne: userId }, conversationId: { $regex: userId } } },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);
  const result = {};
  unreadCounts.forEach((item) => { result[item._id] = item.count; });
  res.json(result);
});

// seen mark karne wala route
router.put("/seen/:conversationId/:userId", async (req, res) => {
  const { conversationId, userId } = req.params;
  await Message.updateMany(
    { conversationId, sender: { $ne: userId }, seen: false },
    { $set: { seen: true } }
  );
  res.json({ success: true });
});