const router  = require("express").Router();
const path    = require("path");
const multer  = require("multer");
const User    = require("../models/User");
const auth    = require("../middleware/auth");

// wahi uploads folder jo index.js /uploads par serve karta hai
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => cb(null, "avatar-" + Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/", auth, async (req, res) => {
  const users = await User.find({ username: { $ne: req.user.username } })
    .select("-password")
    .sort({ username: 1 });
  res.json(users);
});

router.get("/me", auth, async (req, res) => {
  const me = await User.findOne({ username: req.user.username }).select("-password");
  res.json(me);
});

router.get("/search", auth, async (req, res) => {
  const { q } = req.query;
  const users = await User.find({
    username: { $regex: q, $options: "i", $ne: req.user.username }
  }).select("-password").limit(10);
  res.json(users);
});

// ---------- BLOCK USER ----------
router.get("/blocked", auth, async (req, res) => {
  const me = await User.findOne({ username: req.user.username }).select("blockedUsers");
  res.json(me?.blockedUsers || []);
});

router.post("/block/:username", auth, async (req, res) => {
  const target = req.params.username;
  if (target === req.user.username) return res.status(400).json({ message: "You cannot block yourself" });
  if (!await User.exists({ username: target })) return res.status(404).json({ message: "User not found" });
  await User.updateOne({ username: req.user.username }, { $addToSet: { blockedUsers: target } });
  res.json({ ok: true });
});

router.delete("/block/:username", auth, async (req, res) => {
  await User.updateOne({ username: req.user.username }, { $pull: { blockedUsers: req.params.username } });
  res.json({ ok: true });
});

// ---------- AVATAR ----------
router.post("/avatar", auth, upload.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const avatarUrl = `/uploads/${req.file.filename}`;
  await User.findOneAndUpdate({ username: req.user.username }, { avatarUrl });
  res.json({ avatarUrl });
});

router.delete("/avatar", auth, async (req, res) => {
  await User.findOneAndUpdate({ username: req.user.username }, { avatarUrl: null });
  res.json({ ok: true });
});

module.exports = router;