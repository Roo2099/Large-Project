const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const Skill = require('./models/skill');
const Message = require('./models/message');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Counter = require('./models/counter');

// ==== Name normalization helpers (INSERTED after 'const crypto = require("crypto");') ====
// Some records use FirstName/LastName (canonical), others may have lowercase variants,
// and some have neither. We normalize to always return firstName/lastName.

function ssTitleCase(s) {
  if (!s) return '';
  const str = String(s);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function deriveNameFromLogin(login) {
  if (!login) return { firstName: '', lastName: '' };
  const local = String(login).split('@')[0] || '';
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  const firstName = parts[0] ? ssTitleCase(parts[0]) : '';
  const lastName  = parts[1] ? ssTitleCase(parts[1]) : '';
  return { firstName, lastName };
}

function pickNormalizedNames(userDoc) {
  // Prefer canonical caps
  let F = (userDoc?.FirstName ?? '').toString().trim();
  let L = (userDoc?.LastName  ?? '').toString().trim();

  // Fallback to lowercase fields (if present in some legacy docs)
  if (!F && userDoc?.firstName) F = String(userDoc.firstName).trim();
  if (!L && userDoc?.lastName)  L = String(userDoc.lastName).trim();

  // Derive from email local-part if still empty
  if (!F && !L) {
    const derived = deriveNameFromLogin(userDoc?.Login);
    F = derived.firstName;
    L = derived.lastName;
  }

  // Always return keys; may be empty strings, but never undefined
  return { firstName: F || '', lastName: L || '' };
}

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
    // Does an account with this email already exist?
    const existing = await User.findOne({ Login: login });

    // Case A: existing & verified -> block re-register
    if (existing && existing.verified === true) {
      return res.status(400).json({ error: 'An account with this email is already verified. Please log in or reset your password.' });
    }

    // Case B: existing & UNverified -> RE-REGISTER (reuse id & token, update profile/password)
    if (existing && existing.verified !== true) {
      // Reuse original token if present; otherwise (legacy) create and persist one
      let token = existing.verificationToken;
      if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        existing.verificationToken = token;
      }

      // Update mutable fields; preserve Login, UserID, verification token, and verified=false
      existing.FirstName = firstName;
      existing.LastName  = lastName;
      existing.Password  = password;
      await existing.save();

      // Resend the SAME verification link
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
        console.log('Re-sent verification email to (unverified) ', login);
        return res.status(200).json({
          message: 'We found an unverified account for this email. Your verification email has been re-sent.'
        });
      } catch (error) {
        console.error('SendGrid error (re-send):', error.response?.body || error);
        return res.status(500).json({ error: 'Failed to send verification email.' });
      }
    }

    // Case C: brand new email -> create new user and increment counter
    const counter = await Counter.findOneAndUpdate(
      { name: 'userID' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const token = crypto.randomBytes(32).toString('hex');

    const newUser = new User({
      UserID: counter.seq,
      FirstName: firstName,
      LastName: lastName,
      Login: login,
      Password: password,
      verificationToken: token,
      verified: false
    });

    await newUser.save();

    // Send verification email for new registration
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
      return res.status(200).json({
        message: 'Verification email sent. Please verify before logging in.'
      });
    } catch (error) {
      console.error('SendGrid error:', error.response?.body || error);
      return res.status(500).json({ error: 'Failed to send verification email.' });
    }
  } catch (e) {
    console.error('Registration error:', e);
    return res.status(500).json({ error: e.toString() });
  }
});

// ===== Verify Email =====
router.get('/verify/:token', async (req, res) => {
  console.log("🟢 /verify hit with token:", req.params.token);
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link." });
    }

    if (!user.verified) {
      user.verified = true;
      user.verificationToken = undefined;
      await user.save();
      console.log("🟢 User verified and saved");
    }

    const jwtToken = jwt.sign(
      { userId: user.UserID, firstName: user.FirstName, lastName: user.LastName },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    const acceptsHTML = req.headers.accept?.includes("text/html");
    if (acceptsHTML) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:10%;">
          <h2 style="color:green;">Email verified successfully!</h2>
          <p>You can now close this tab and return to the app.</p>
        </body></html>
      `);
    }

    return res.status(200).json({
      message: "Email verified successfully",
      token: jwtToken,
      user: {
        id: user.UserID,
        firstName: user.FirstName,
        lastName: user.LastName,
      },
    });
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).json({ message: "An error occurred while verifying your email." });
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
  try {
    const { SkillName, Type } = req.body;
    const userId = req.user.userId;

    console.log("🟢 AddSkill Triggered:");
    console.log("   Incoming SkillName:", SkillName);
    console.log("   Incoming Type:", Type);
    console.log("   From UserID:", userId);

    // ✅ Normalize type (avoids Offer/Need mismatch)
    const normalizedType = Type?.toLowerCase() === 'offer' ? 'offer' : 'need';
    console.log("   Normalized Type:", normalizedType);

    // ✅ Prevent duplicates
    const existing = await Skill.findOne({ UserID: userId, SkillName, Type: normalizedType });
    if (existing) {
      console.log("⚠️ Duplicate skill detected, skipping save.");
      return res.status(400).json({ message: "You already have this skill added." });
    }

    // ✅ Create new skill
    const newSkill = new Skill({
      SkillName,
      Type: normalizedType,
      UserID: userId,
    });

    console.log("💾 Saving new skill:", newSkill);

    await newSkill.save(); // <- This line *must* succeed

    console.log("✅ Skill saved successfully with _id:", newSkill._id);
    res.status(200).json({ success: true, message: "Skill added successfully." });

  } catch (e) {
    console.error("❌ Error in /addskill:", e);
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
    const mySkills = await Skill.find({ UserID: req.user.userId }); // ✅ fixed
    res.status(200).json({ mySkills });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// --- Matchmaking with complementary Offer/Need logic (verified-only results, excludes users with existing conversations) ---
router.get("/matchskills", verifyToken, async (req, res) => {
  try {
    const me = Number(req.user.userId);

    // 1️⃣ Get the logged-in user's skills
    const mySkills = await Skill.find({ UserID: me });
    if (!mySkills.length) {
      return res.json({ matches: [] });
    }

    // Split own skills into Offer vs Need
    const myOffers = mySkills
      .filter((s) => s.Type?.toLowerCase() === "offer")
      .map((s) => s.SkillName);
    const myNeeds = mySkills
      .filter((s) => s.Type?.toLowerCase() === "need")
      .map((s) => s.SkillName);

    // 2️⃣ Build a set of userIDs that already have a conversation with me
    //    If any message exists in either direction, we treat them as "connected" and exclude them.
    const convMsgs = await Message.find(
      { $or: [{ from: me }, { to: me }] },
      { from: 1, to: 1, _id: 0 }
    ).lean();

    const connectedUserIds = new Set();
    for (const m of convMsgs) {
      if (Number(m.from) !== me) connectedUserIds.add(Number(m.from));
      if (Number(m.to) !== me) connectedUserIds.add(Number(m.to));
    }

    // 3️⃣ Find complementary matches (exclude self, catalog user, and users with existing conversations)
    const complementaryMatches = await Skill.aggregate([
      {
        $match: {
          UserID: { $nin: [me, -1, ...Array.from(connectedUserIds)] },
          $or: [
            { SkillName: { $in: myOffers }, Type: "need" },
            { SkillName: { $in: myNeeds }, Type: "offer" },
          ],
        },
      },
      {
        $group: {
          _id: "$UserID",
          skills: { $addToSet: { SkillName: "$SkillName", Type: "$Type" } },
          overlapCount: { $sum: 1 },
        },
      },
      // Optional guard against mega users with huge overlaps
      { $match: { overlapCount: { $gte: 1, $lte: 20 } } },
      { $sort: { overlapCount: -1 } },
    ]);

    // 4️⃣ Attach names + full skill details; **drop unverified users**
    const matchesWithNames = await Promise.all(
      complementaryMatches.map(async (m) => {
        const user = await User.findOne(
          { UserID: m._id },
          { FirstName: 1, LastName: 1, verified: 1 }
        ).lean();

        if (!user || user.verified !== true) return null;

        const userSkills = await Skill.find(
          { UserID: m._id },
          { SkillName: 1, Type: 1 }
        ).lean();

        return {
          _id: m._id,
          firstName: user.FirstName,
          lastName: user.LastName,
          skills: userSkills.map((s) => ({
            SkillName: s.SkillName,
            Type: s.Type.charAt(0).toUpperCase() + s.Type.slice(1),
          })),
        };
      })
    );

    const validMatches = matchesWithNames.filter(Boolean);
    res.json({ matches: validMatches });
  } catch (err) {
    console.error("Error matching skills:", err);
    res.status(500).json({ error: "Server error while matching skills" });
  }
});

// ===== Delete Skill =====
router.delete('/deleteskill/:skillName', verifyToken, async (req, res) => {
  try {
    await Skill.deleteOne({ SkillName: req.params.skillName, UserID: req.user.userId }); // ✅ fixed
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// DELETE OFFER (same behavior as deleteSkill, but for clarity)
router.delete("/deleteoffer/:SkillName", verifyToken, async (req, res) => {
  const userId = req.user.userId;
  const skillName = decodeURIComponent(req.params.SkillName);

  try {
    const result = await Skill.deleteOne({ UserID: userId, SkillName: skillName });

    if (result.deletedCount > 0) {
      res.json({ success: true, message: "Offer deleted successfully." });
    } else {
      res.status(404).json({ success: false, message: "Offer not found." });
    }
  } catch (err) {
    console.error("Error deleting offer:", err);
    res.status(500).json({ success: false, message: "Server error deleting offer." });
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

// ===== Get Messages with User Names =====
router.get('/messages', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }]
    }).sort({ createdAt: -1 });

    // get all involved users (include both names)
    const userIds = [...new Set(messages.flatMap(m => [m.from, m.to]))];
    const users = await User.find(
      { UserID: { $in: userIds } },
      'UserID FirstName LastName'
    );

    // build name map with both names
    const nameMap = Object.fromEntries(
      users.map(u => [
        u.UserID,
        `${u.FirstName || ''} ${u.LastName || ''}`.trim()
      ])
    );

// attach both names to each message
const messagesWithNames = messages.map(m => ({
  ...m.toObject(),
  fromName: nameMap[m.from] || `User ${m.from}`,
  toName: nameMap[m.to] || `User ${m.to}`
}));

    res.status(200).json({ messages: messagesWithNames });
  } catch (e) {
    console.error('❌ Message fetch error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Delete a Message =====
router.delete('/messages/:id', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // ✅ Only allow delete if user sent OR received the message
    if (message.from !== userId && message.to !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(id);
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('❌ Message delete error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Delete entire conversation (both directions) =====
// INSERT AFTER: router.delete('/messages/:id', verifyToken, async (req, res) => { ... });
router.delete('/conversations/:partnerId', verifyToken, async (req, res) => {
  try {
    const me = req.user.userId;
    const partnerId = parseInt(req.params.partnerId, 10);

    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ error: 'Invalid partner id' });
    }

    // Remove all messages between the two users, regardless of direction
    const result = await Message.deleteMany({
      $or: [
        { from: me, to: partnerId },
        { from: partnerId, to: me }
      ]
    });

    return res.status(200).json({ success: true, deleted: result?.deletedCount ?? 0 });
  } catch (e) {
    console.error('❌ Conversation delete error:', e);
    return res.status(500).json({ error: e.toString() });
  }
});

const FriendRequest = require('./models/friendRequest');

// INSERT AFTER: const FriendRequest = require('./models/friendRequest');

// ===== Offers: Incoming (verified senders only) =====
router.get('/offers/incoming', verifyToken, async (req, res) => {
  try {
    const toUserId = req.user.userId;

    const requests = await FriendRequest
      .find({ toUserId, status: 'pending' })
      .select('_id fromUserId toUserId status createdAt')
      .sort({ createdAt: -1 });

    const offers = await Promise.all(
      requests.map(async (r) => {
        const user = await User.findOne(
          { UserID: r.fromUserId },
          { UserID: 1, FirstName: 1, LastName: 1, verified: 1 }
        );
        if (!user || user.verified !== true) return null; // 🚫 hide unverified sender

        const skills = await Skill.find(
          { UserID: r.fromUserId },
          { SkillName: 1, Type: 1 }
        );

        return {
          id: r._id,
          fromUserId: r.fromUserId,
          toUserId: r.toUserId,
          createdAt: r.createdAt,
          status: r.status,
          other: {
            id: user.UserID,
            firstName: user.FirstName ?? '',
            lastName: user.LastName ?? '',
            skills: skills.map(s => ({ SkillName: s.SkillName, Type: s.Type })),
          },
        };
      })
    );

    res.status(200).json({ offers: offers.filter(Boolean) });
  } catch (e) {
    console.error('❌ /offers/incoming error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Offers: Outgoing (verified recipients only) =====
router.get('/offers/outgoing', verifyToken, async (req, res) => {
  try {
    const fromUserId = req.user.userId;

    const requests = await FriendRequest
      .find({ fromUserId, status: 'pending' })
      .select('_id fromUserId toUserId status createdAt')
      .sort({ createdAt: -1 });

    const offers = await Promise.all(
      requests.map(async (r) => {
        const user = await User.findOne(
          { UserID: r.toUserId },
          { UserID: 1, FirstName: 1, LastName: 1, verified: 1 }
        );
        if (!user || user.verified !== true) return null; // 🚫 hide unverified recipient

        const skills = await Skill.find(
          { UserID: r.toUserId },
          { SkillName: 1, Type: 1 }
        );

        return {
          id: r._id,
          fromUserId: r.fromUserId,
          toUserId: r.toUserId,
          createdAt: r.createdAt,
          status: r.status,
          other: {
            id: user.UserID,
            firstName: user.FirstName ?? '',
            lastName: user.LastName ?? '',
            skills: skills.map(s => ({ SkillName: s.SkillName, Type: s.Type })),
          },
        };
      })
    );

    res.status(200).json({ offers: offers.filter(Boolean) });
  } catch (e) {
    console.error('❌ /offers/outgoing error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Send Friend Request (verified-only target) =====
router.post('/friend-request/:toUserId', verifyToken, async (req, res) => {
  try {
    const fromUserId = req.user.userId;
    const toUserId = parseInt(req.params.toUserId);

    if (fromUserId === toUserId)
      return res.status(400).json({ error: "Can't send friend request to yourself" });

    // 🚫 Must target a verified user
    const toUser = await User.findOne({ UserID: toUserId }, { verified: 1, UserID: 1 });
    if (!toUser) {
      return res.status(404).json({ error: "Target user not found" });
    }
    if (toUser.verified !== true) {
      return res.status(400).json({ error: "Cannot send requests to unverified users" });
    }

    // Check for duplicates (any direction)
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
    console.error('❌ Send friend request error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== View Incoming Friend Requests (verified senders only) =====
router.get('/friend-requests', verifyToken, async (req, res) => {
  try {
    const toUserId = req.user.userId;
    const base = await FriendRequest
      .find({ toUserId, status: 'pending' })
      .select('_id fromUserId toUserId status createdAt')
      .sort({ createdAt: -1 });

    const filtered = [];
    for (const r of base) {
      const sender = await User.findOne({ UserID: r.fromUserId }, { verified: 1 });
      if (sender && sender.verified === true) filtered.push(r);
    }

    res.status(200).json({ requests: filtered });
  } catch (e) {
    console.error('❌ Incoming friend-requests error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== View Outgoing Friend Requests =====
router.get('/friend-requests/outgoing', verifyToken, async (req, res) => {
  try {
    const fromUserId = req.user.userId;
    const requests = await FriendRequest
      .find({ fromUserId, status: 'pending' })
      .select('_id toUserId status createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({ requests });
  } catch (e) {
    console.error('❌ Outgoing friend-requests error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// INSERT AFTER: router.get('/friend-requests/outgoing' ...

// ===== Cancel Outgoing Friend Request (delete pending) =====
router.delete('/friend-request/:id', verifyToken, async (req, res) => {
  try {
    const fromUserId = req.user.userId;
    const { id } = req.params;

    const fr = await FriendRequest.findById(id);
    if (!fr) return res.status(404).json({ error: 'Request not found' });

    if (fr.fromUserId !== fromUserId) {
      return res.status(403).json({ error: 'Not authorized to cancel this request' });
    }

    if (fr.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be canceled' });
    }

    await fr.deleteOne();
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('❌ Cancel outgoing request error:', e);
    res.status(500).json({ error: e.toString() });
  }
});


// REPLACE ENTIRE HANDLER: router.post('/friend-request/:id/respond', ...)

// ===== Accept or Decline Request (remove from lists; on accept, start a message thread) =====
router.post('/friend-request/:id/respond', verifyToken, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'decline'
    const requestId = req.params.id;
    const toUserId = req.user.userId;

    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (request.toUserId !== toUserId) {
      return res.status(403).json({ error: 'Not authorized to modify this request' });
    }

    if (action === 'accept') {
      // Optional: mark accepted (for audit) before deletion
      request.status = 'accepted';
      await request.save();

      // Try to seed a starter message to open a thread; don't fail the accept if this throws
      try {
        await Message.create({
          from: toUserId,
          to: request.fromUserId,
          body: 'Hi! I accepted your offer — let’s connect.',
          createdAt: new Date(),
        });
      } catch (msgErr) {
        console.warn('⚠️ Failed to seed starter message on accept:', msgErr);
      }

      // Remove the request so it disappears from lists
      await request.deleteOne();
      return res.status(200).json({ message: 'Request accepted' });
    }

    if (action === 'decline') {
      // Optional: mark declined (for audit) before deletion
      request.status = 'declined';
      await request.save();

      // Remove the request so it disappears from lists
      await request.deleteOne();
      return res.status(200).json({ message: 'Request declined' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('❌ friend-request respond error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Improved User Search (verified-only results) =====
router.get('/users', async (req, res) => {
  const { name } = req.query;

  try {
    if (!name) {
      const users = await User.find({ verified: true }, 'UserID FirstName LastName');
      return res.json({ users });
    }

    // 🔍 Return *all* matches (verified only)
    const users = await User.find(
      { verified: true, FirstName: { $regex: new RegExp(name, 'i') } },
      'UserID FirstName LastName'
    );

    if (!users || users.length === 0)
      return res.status(404).json({ message: 'No users found' });

    res.json({ users });
  } catch (e) {
    console.error('❌ User lookup error:', e);
    res.status(500).json({ error: e.toString() });
  }
});

// ===== Update Name =====
router.post('/update-name', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First and last name required" });
    }

    await User.updateOne(
      { UserID: req.user.userId },
      { $set: { FirstName: firstName, LastName: lastName } }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Update name error:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// ===== Get User by ID (for profiles, connections, etc.) =====
router.get('/user/:id', verifyToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Project both canonical and potential legacy fields; include Login for fallback
    const user = await User.findOne(
      { UserID: userId },
      { UserID: 1, FirstName: 1, LastName: 1, firstName: 1, lastName: 1, Login: 1 }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Normalize names so firstName/lastName are always present
    const { firstName, lastName } = pickNormalizedNames(user);

    // Fetch skills (same behavior as before)
    const skillsDocs = await Skill.find(
      { UserID: userId },
      { SkillName: 1, Type: 1 }
    );

    // Return a consistent shape for all callers (Dashboard, Offers, etc.)
    res.status(200).json({
      id: user.UserID,
      firstName,              // guaranteed key (may be '')
      lastName,               // guaranteed key (may be '')
      email: user.Login || '',
      skills: skillsDocs.map(s => ({
        SkillName: s.SkillName,
        Type: s.Type // keep server’s casing; frontend already handles Offer/Need display
      })),
    });
  } catch (err) {
    console.error('❌ Fetch user by ID error:', err);
    res.status(500).json({ error: 'Failed to retrieve user info' });
  }
});

module.exports = router;
