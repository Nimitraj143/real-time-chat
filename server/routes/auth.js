const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (await User.findOne({ username })) return res.status(400).json({ message: 'Username already taken' });
    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ username, password: hashed });
    const token  = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username, avatarUrl: user.avatarUrl });   // 👈 avatarUrl added
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (!await bcrypt.compare(password, user.password)) return res.status(400).json({ message: 'Wrong password' });
    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username, avatarUrl: user.avatarUrl });               // 👈 avatarUrl added
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;