const router = require('express').Router();
const Room   = require('../models/Room');
const auth   = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 });
  res.json(rooms);
});

router.post('/', auth, async (req, res) => {
  try {
    const room = await Room.create({ name: req.body.name, createdBy: req.user.username });
    res.status(201).json(room);
  } catch { res.status(400).json({ message: 'Room name already exists' }); }
});

module.exports = router;