const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const User      = require('../models/User');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- RATE LIMITERS ----------
const limiterOpts = (windowMs, limit, message, extra = {}) => rateLimit({
  windowMs, limit, standardHeaders: true, legacyHeaders: false,
  message: { message }, ...extra,
});

// login: 10 min mein sirf 5 GALAT attempts (sahi login count nahi hota)
const loginLimiter    = limiterOpts(10 * 60 * 1000, 5,  'Too many failed login attempts. Try again after 10 minutes.', { skipSuccessfulRequests: true });
const registerLimiter = limiterOpts(60 * 60 * 1000, 10, 'Too many accounts created from this network. Try again later.');
const forgotLimiter   = limiterOpts(15 * 60 * 1000, 5,  'Too many OTP requests. Try again after 15 minutes.');
const resetLimiter    = limiterOpts(15 * 60 * 1000, 10, 'Too many attempts. Try again after 15 minutes.');

// ---------- EMAIL (Brevo HTTP API) ----------
async function sendOtpEmail(to, otp) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Real Time Chat', email: process.env.EMAIL_FROM },
      to: [{ email: to }],
      subject: 'Your password reset OTP',
      htmlContent: `<p>Your OTP to reset your password is:</p>
        <h2 style="letter-spacing:4px">${otp}</h2>
        <p>It is valid for 10 minutes. If you did not request this, ignore this email.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Email API ${res.status}: ${await res.text()}`);
}

const makeToken = (user) =>
  jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ---------- REGISTER ----------
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const username = (req.body.username || '').trim();
    const email    = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password;

    if (!username) return res.status(400).json({ message: 'Username is required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    if (!password || password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (password.length > 64)
      return res.status(400).json({ message: 'Password must be at most 64 characters' });

    if (await User.findOne({ username })) return res.status(400).json({ message: 'Username already taken' });
    if (await User.findOne({ email }))    return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ username, email, password: hashed });
    res.status(201).json({ token: makeToken(user), username: user.username, avatarUrl: user.avatarUrl });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ---------- LOGIN (username ya email dono se) ----------
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const id       = String(req.body.username || '').trim();
    const password = req.body.password;

    if (!id || !password) return res.status(400).json({ message: 'Username/email and password are required' });

    const user = await User.findOne({
      $or: [{ username: id }, { email: id.toLowerCase() }],
    });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (!await bcrypt.compare(String(password), user.password))
      return res.status(400).json({ message: 'Wrong password' });

    res.json({ token: makeToken(user), username: user.username, avatarUrl: user.avatarUrl });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ---------- FORGOT PASSWORD: OTP bhejo ----------
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });

    const user = await User.findOne({ email });
    if (user) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      user.resetOtpHash     = await bcrypt.hash(otp, 10);
      user.resetOtpExpires  = new Date(Date.now() + 10 * 60 * 1000);
      user.resetOtpAttempts = 0;
      await user.save();
      await sendOtpEmail(email, otp);
    }
    res.json({ message: 'If this email is registered, an OTP has been sent.' });
  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ message: 'Could not send OTP. Try again later.' });
  }
});

// ---------- RESET PASSWORD: OTP verify + naya password ----------
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const email       = (req.body.email || '').trim().toLowerCase();
    const otp         = String(req.body.otp || '').trim();
    const newPassword = req.body.newPassword;

    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (newPassword.length > 64)
      return res.status(400).json({ message: 'Password must be at most 64 characters' });

    const user = await User.findOne({ email }).select('+resetOtpHash +resetOtpExpires +resetOtpAttempts');
    if (!user || !user.resetOtpHash || !user.resetOtpExpires || user.resetOtpExpires < new Date())
      return res.status(400).json({ message: 'OTP expired or invalid. Request a new one.' });

    if (user.resetOtpAttempts >= 5) {
      user.resetOtpHash = undefined; user.resetOtpExpires = undefined; user.resetOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ message: 'Too many wrong OTP attempts. Request a new OTP.' });
    }

    if (!await bcrypt.compare(otp, user.resetOtpHash)) {
      user.resetOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Wrong OTP' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtpHash = undefined; user.resetOtpExpires = undefined; user.resetOtpAttempts = 0;
    await user.save();
    res.json({ message: 'Password reset successful. Please login.' });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

module.exports = router;