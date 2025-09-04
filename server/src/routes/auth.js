const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');

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
      const token = jwt.sign(
        { studentId: student._id, rfid_uid: student.rfid_uid, name: student.name, email: student.email, role: 'student' },
        process.env.JWT_SECRET || 'dev',
        { expiresIn: '7d' }
      );
      return res.json({ token, user: { id: student._id, name: student.name, role: 'student', email: student.email, rfid_uid: student.rfid_uid } });
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
