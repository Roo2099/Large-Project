const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const Skill = require('./models/skill');
const Message = require('./models/message');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ===== JWT Middleware =====
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log("🔍 Raw Authorization header:", authHeader); // <-- add this
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("✅ Decoded payload:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Token verification error:", err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ===== Registration (Send Verification Email) =====
router.post('/register', async (req, res) => {
  const { firstName, lastName, login, password } = req.body;

  try {
    const existing = await User.findOne({ Login: login });
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const count = await User.countDocuments();
    const token = crypto.randomBytes(32).toString('hex');

    const newUser = new User({
      UserID: count + 1,
      FirstName: firstName,
      LastName: lastName,
      Login: login,
      Password: password,
      verificationToken: token,
      verified: false
    });

    await newUser.save();

    // --- Send verification email via SendGrid ---
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const verifyURL = `${process.env.BASE_URL}/confirm-email/${token}`;

    const msg = {
  to: login,
  from: { email: 'noreply@poosd24.live', name: 'SkillSwap' },
  subject: 'Verify your SkillSwap account',
  html: `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; background:#f9f9f9; padding:20px; color:#222;">
    <div style="max-width:520px; margin:auto; padding:25px; background:#ffffff; border-radius:8px; 
                box-shadow:0 0 8px rgba(0,0,0,0.1); color:#222 !important;">
      <h2 style="color:#007BFF !important; font-weight:600; margin-bottom:10px;">
        <span style="color:#007BFF !important;">Welcome to SkillSwap!</span>
      </h2>

      <p style="color:#222 !important; margin:10px 0;">Hi ${firstName},</p>
      <p style="color:#222 !important; margin:10px 0;">
        Click the button below to verify your account:
      </p>

      <p style="text-align:center;">
        <a href="${verifyURL}"
           style="display:inline-block; padding:12px 24px; background-color:#007BFF; color:#ffffff !important; 
                  text-decoration:none; font-weight:600; border-radius:5px; font-size:15px;">
          Verify My Account
        </a>
      </p>

      <p style="color:#222 !important; margin:10px 0;">
        If the button doesn’t work, copy and paste this link into your browser:
      </p>

      <p style="word-break:break-all; color:#007BFF !important; margin:5px 0;">
        <a href="${verifyURL}" style="color:#007BFF !important; text-decoration:none;">${verifyURL}</a>
      </p>

      <hr style="border:none; border-top:1px solid #ddd; margin:25px 0;">
      <p style="font-size:13px; color:#555 !important;">
        This email was sent by <strong>SkillSwap</strong>. If you didn’t sign up for an account, please ignore this message.
      </p>
    </div>
  </body>
</html>
`
};


    try {
      await sgMail.send(msg);
      console.log('Verification email sent to', login);
      res.status(200).json({
        message: 'Verification email sent. Please verify before logging in.'
      });
    } catch (error) {
      console.error('SendGrid error:', error.response?.body || error);
      res.status(500).json({ error: 'Failed to send verification email.' });
    }

  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Verify Email =====
router.get('/verify/:token', async (req, res) => {
  console.log("🟢 /verify hit with token:", req.params.token);
  try {
    const user = await Promise.race([
      User.findOne({ verificationToken: req.params.token }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 8000))
    ]);

    console.log("🟠 Query complete. User:", user ? user.Login : 'null');

    if (!user) {
      console.log("🔴 Invalid or expired token");
      return res
        .status(400)
        .send('<h2 style="color:red;">❌ Invalid or expired verification link.</h2>');
    }

    if (!user.verified) {
      user.verified = true;
      user.verificationToken = undefined;
      await user.save();
      console.log("🟢 User verified and saved");
    }

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:10%;">
        <h2 style="color:green;">✅ Email verified successfully!</h2>
        <p>You can now log in to SkillSwap.</p>
        <a href="/" style="color:white;background:#4CAF50;padding:10px 20px;border-radius:5px;text-decoration:none;">Go to Login</a>
      </body></html>
    `);
    console.log("🟩 Success response sent");
  } catch (e) {
    console.error("❌ Verification error:", e);
    res.status(500).send('<h2>⚠️ Something went wrong verifying your email.</h2>');
  }
});

// ===== Login =====
router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  try {
    const user = await User.findOne({ Login: login });
    if (!user || user.Password !== password)
      return res.status(400).json({ error: 'Invalid username or password' });

    if (!user.verified)
      return res.status(403).json({ error: 'Please verify your email before logging in.' });

    const token = jwt.sign(
      { userId: user.UserID, firstName: user.FirstName, lastName: user.LastName },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      id: user.UserID,
      firstName: user.FirstName,
      lastName: user.LastName,
      token,
      error: ''
    });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Password Reset (Request Email) =====
router.post('/request-reset', async (req, res) => {
  const { login } = req.body;
  try {
    const user = await User.findOne({ Login: login });
    if (!user) return res.status(400).json({ error: 'No user found with that email' });

    // generate token + expiry
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 1000 * 60 * 10; // valid 10 minutes
    await user.save();

    // send email via SendGrid
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const resetURL = `${process.env.BASE_URL}/reset-password/${resetToken}`;

    const msg = {
      to: login,
      from: { email: 'noreply@poosd24.live', name: 'SkillSwap' },
      subject: 'Reset your SkillSwap password',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height:1.6;">
            <h2>Password Reset Request</h2>
            <p>Click below to reset your password:</p>
            <a href="${resetURL}" style="background-color:#4CAF50;color:white;
              padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a>
            <p>If the button doesn’t work, copy this link into your browser:</p>
            <p><a href="${resetURL}">${resetURL}</a></p>
            <p>This link expires in 10 minutes.</p>
          </body>
        </html>`
    };

    await sgMail.send(msg);
    res.status(200).json({ message: 'Password reset email sent successfully' });
  } catch (err) {
    console.error('Reset request error:', err);
    res.status(500).json({ error: 'Error sending reset email' });
  }
});

// ===== Password Reset (Submit New Password) =====
router.post('/reset-password/:token', async (req, res) => {
  const { password } = req.body;
  try {
    const user = await User.findOne({
      resetToken: req.params.token,
      resetTokenExpires: { $gt: Date.now() } // not expired
    });

    if (!user) return res.status(400).send('<h2>Invalid or expired reset link</h2>');

    user.Password = password;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif;text-align:center;margin-top:10%;">
          <h2>✅ Password reset successful!</h2>
          <p>You can now log in with your new password.</p>
        </body>
      </html>`);
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).send('<h2>Error resetting password. Try again.</h2>');
  }
});

// ===== Add Skill =====
router.post('/addskill', verifyToken, async (req, res) => {
  const { card, type } = req.body; // 👈 type now included
  const userId = req.user.userId;

  try {
    await Skill.create({
      SkillName: card,
      UserId: userId,
      Type: type || 'offer' // default to offer
    });
    res.status(200).json({ message: 'Skill added successfully' });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Browse Skills =====
router.get('/browseskills', async (req, res) => {
  try {
    const skills = await Skill.find();
    res.status(200).json({ skills });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ===== My Skills =====
router.get('/myskills', verifyToken, async (req, res) => {
  try {
    const mySkills = await Skill.find({ UserId: req.user.userId });
    res.status(200).json({ mySkills });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

router.get('/matchskills', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const mySkills = await Skill.find({ UserId: userId });
    const offered = mySkills.filter(s => s.Type === 'offer').map(s => s.SkillName);
    const needed = mySkills.filter(s => s.Type === 'need').map(s => s.SkillName);

    // 🧩 Prevent empty or undefined arrays
    if (!offered.length && !needed.length) {
      return res.status(200).json({ matches: [] });
    }

    const matches = await Skill.aggregate([
      {
        $match: {
          $or: [
            ...(needed.length ? [{ SkillName: { $in: needed }, Type: 'offer' }] : []),
            ...(offered.length ? [{ SkillName: { $in: offered }, Type: 'need' }] : [])
          ],
          UserId: { $ne: userId }
        }
      },
      { $group: { _id: '$UserId', skills: { $push: '$SkillName' } } }
    ]);

    res.status(200).json({ matches });
  } catch (e) {
    console.error('❌ Matchmaking error:', e);
    res.status(500).json({ error: e.toString() });
  }
});


// ===== Delete Skill =====
router.delete('/deleteskill/:skillName', verifyToken, async (req, res) => {
  try {
    await Skill.deleteOne({ SkillName: req.params.skillName, UserId: req.user.userId });
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Search Skills =====
router.post('/searchskills', async (req, res) => {
  const { search } = req.body;
  try {
    const results = await Skill.find({
      SkillName: { $regex: search + '.*', $options: 'i' }
    });
    res.status(200).json({ results, error: '' });
  } catch (e) {
    res.status(500).json({ results: [], error: e.toString() });
  }
});

// ===== Messaging System =====

// Send Message
router.post('/messages', verifyToken, async (req, res) => {
  const { to, body } = req.body;
  const from = req.user.userId;

  try {
    await Message.create({ from, to, body, createdAt: new Date() });
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// Get Messages for current user
router.get('/messages', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }]
    }).sort({ createdAt: -1 });

    res.status(200).json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

const FriendRequest = require('./models/friendRequest');

// ===== Send Friend Request =====
router.post('/friend-request/:toUserId', verifyToken, async (req, res) => {
  try {
    const fromUserId = req.user.userId;
    const toUserId = parseInt(req.params.toUserId);

    if (fromUserId === toUserId)
      return res.status(400).json({ error: "Can't send friend request to yourself" });

    // Check for duplicates
    const existing = await FriendRequest.findOne({
      $or: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId }
      ]
    });

    if (existing) return res.status(400).json({ error: 'Request already exists' });

    await FriendRequest.create({ fromUserId, toUserId });
    res.status(200).json({ message: 'Friend request sent' });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ===== View Incoming Friend Requests =====
router.get('/friend-requests', verifyToken, async (req, res) => {
  try {
    const toUserId = req.user.userId;
    const requests = await FriendRequest.find({ toUserId, status: 'pending' });
    res.status(200).json({ requests });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Accept or Decline Request =====
router.post('/friend-request/:id/respond', verifyToken, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'decline'
    const requestId = req.params.id;
    const toUserId = req.user.userId;

    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.toUserId !== toUserId)
      return res.status(403).json({ error: 'Not authorized to modify this request' });

    if (action === 'accept') {
      request.status = 'accepted';
    } else if (action === 'decline') {
      request.status = 'declined';
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await request.save();
    res.status(200).json({ message: `Request ${request.status}` });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

module.exports = router;
