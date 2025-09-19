const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const { auth } = require('../middleware/auth');

// Disable public signup: students must be created by admin; admins/users seeded by ops.
router.post('/signup', async (_req, res) => {
  return res.status(404).json({ message: 'Signup is disabled. Contact admin to create an account.' });
});

// Student change password
router.post('/change-password', require('../middleware/auth').auth(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!req.student) return res.status(401).json({ message: 'Unauthorized' });
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    const student = await Student.findById(req.student._id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const ok = await bcrypt.compare(currentPassword, student.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    const ph = await bcrypt.hash(newPassword, 10);
    student.passwordHash = ph;
    await student.save();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Update student profile (self) — allows name, email, mobileNumber
router.post('/update-profile', auth(), async (req, res) => {
  try {
    if (!req.student) return res.status(401).json({ message: 'Unauthorized' });
    const { name, email, mobileNumber } = req.body || {};

    const update = {};
    if (typeof name === 'string') update.name = name.trim();
    if (typeof email === 'string') update.email = email.trim();
    if (typeof mobileNumber === 'string') {
      const phone = mobileNumber.trim();
      // basic validation: digits with optional '+' and 7-15 digits total
      const ok = /^\+?\d{7,15}$/.test(phone);
      if (!ok) return res.status(400).json({ message: 'Invalid mobile number format' });
      update.mobileNumber = phone;
    }

    if (!Object.keys(update).length) return res.status(400).json({ message: 'No valid fields to update' });

    // apply updates and ensure email uniqueness handled by schema
    const student = await require('../models/Student').findByIdAndUpdate(
      req.student._id,
      { $set: update },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });

    return res.json({
      ok: true,
      user: {
        id: student._id,
        name: student.name,
        role: 'student',
        email: student.email,
        rfid_uid: student.rfid_uid,
        mobileNumber: student.mobileNumber,
      }
    });
  } catch (e) {
    // Handle duplicate email errors cleanly
    if (e?.code === 11000 && e?.keyPattern?.email) {
      return res.status(400).json({ message: 'Email is already in use' });
    }
    return res.status(500).json({ message: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, as, rollNo, identifier } = req.body;

    if (as === 'student') {
      // identifier can be email or rollNo. Fallback: use email field
      const idValue = identifier || rollNo || email;
      const student = await Student.findOne({ $or: [ { email: idValue }, { rollNo: idValue } ] });
      if (!student) return res.status(401).json({ message: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, student.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
      const jwtSecret = process.env.JWT_SECRET || 'dev';
      console.log('[Login] Creating student token:', {
        studentId: student._id,
        studentName: student.name,
        studentEmail: student.email,
        jwtSecret: jwtSecret === 'dev' ? 'using default "dev"' : `${jwtSecret.slice(0, 3)}...${jwtSecret.slice(-3)}`,
      });
      
      const token = jwt.sign(
        { studentId: student._id, rfid_uid: student.rfid_uid, name: student.name, email: student.email, role: 'student' },
        jwtSecret,
        { expiresIn: '7d' }
      );
      
      console.log('[Login] Token created successfully:', {
        tokenLength: token.length,
        tokenPrefix: token.slice(0, 20) + '...',
      });
      
      return res.json({ token, user: { id: student._id, name: student.name, role: 'student', email: student.email, rfid_uid: student.rfid_uid, mobileNumber: student.mobileNumber } });
    }

    // Default: regular user login
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET || 'dev',
      { expiresIn: '7d' }
    );
    return res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;

// Return currently authenticated user (student or admin)
router.get('/me', auth(), async (req, res) => {
  try {
    if (req.student) {
      return res.json({
        user: {
          id: req.student._id,
          name: req.student.name,
          role: 'student',
          email: req.student.email,
          rfid_uid: req.student.rfid_uid,
          mobileNumber: req.student.mobileNumber,
        },
      });
    }

    const payload = req.user || {};
    if (payload?.id) {
      const user = await User.findById(payload.id).lean();
      if (!user) return res.status(401).json({ message: 'Unauthorized' });
      return res.json({
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          email: user.email,
        },
      });
    }

    return res.status(401).json({ message: 'Unauthorized' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});
