const router = require('express').Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { auth, requireRoles } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const WalletTransaction = require('../models/WalletTransaction');

// Public: list students (basic) without auth for local testing
router.get('/students', async (req, res) => {
  const students = await Student.find().sort({ createdAt: -1 });
  return res.json(students);
});

// Update a student's details (admin)
router.put('/students/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, rollNo, email, mobileNumber, department, RFIDNumber, active } = req.body || {};

    // Build update payload; only set provided fields
    const update = {};
    if (typeof name === 'string') update.name = name;
    if (typeof rollNo === 'string') update.rollNo = rollNo;
    if (typeof email === 'string') update.email = email;
    if (typeof department === 'string') update.department = department;
    if (typeof mobileNumber === 'string' || typeof mobileNumber === 'number') update.mobileNumber = String(mobileNumber).trim();
    if (typeof RFIDNumber === 'string') update.rfid_uid = RFIDNumber; // map form field to db field
    if (typeof active === 'boolean') update.active = active;

    // Validate mobile format if provided
    if (update.mobileNumber && !/^\+?\d{7,15}$/.test(update.mobileNumber)) {
      return res.status(400).json({ message: 'Invalid mobileNumber format' });
    }

    // Uniqueness checks (excluding current student)
    const or = [];
    if (update.rollNo) or.push({ rollNo: update.rollNo });
    if (update.rfid_uid) or.push({ rfid_uid: update.rfid_uid });
    if (update.email) or.push({ email: update.email });
    if (or.length) {
      const dup = await Student.findOne({ $and: [ { _id: { $ne: id } }, { $or: or } ] });
      if (dup) {
        let message = 'Duplicate value';
        if (update.rollNo && dup.rollNo === update.rollNo) message = 'Roll No already exists';
        else if (update.rfid_uid && dup.rfid_uid === update.rfid_uid) message = 'RFID Number already exists';
        else if (update.email && dup.email === update.email) message = 'Email already exists';
        return res.status(400).json({ message });
      }
    }

    const updated = await Student.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json(updated);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Get single student (includes walletBalance)
router.get('/students/:id', async (req, res) => {
  try {
    const s = await Student.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Not found' });
    return res.json(s);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// All admin routes require admin role
router.use(auth(), requireRoles('admin'));

// Activate/Deactivate a student (admin only)
router.put('/students/:id/active', async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') return res.status(400).json({ message: 'active must be boolean' });
    const s = await Student.findByIdAndUpdate(req.params.id, { active }, { new: true });
    if (!s) return res.status(404).json({ message: 'Not found' });
    return res.json(s);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Reset a student's password (admin)
router.post('/students/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'newPassword is required' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const s = await Student.findByIdAndUpdate(req.params.id, { passwordHash }, { new: true });
    if (!s) return res.status(404).json({ message: 'Not found' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Create user or staff
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role = 'user', rfidTag } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role, rfidTag });
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// List users
router.get('/users', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

// Update user (role, rfid, name)
router.put('/users/:id', async (req, res) => {
  try {
    const { role, rfidTag, name } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role, rfidTag, name }, { new: true });
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  const u = await User.findByIdAndDelete(req.params.id);
  if (!u) return res.status(404).json({ message: 'Not found' });
  res.json({ ok: true });
});

// Wallet: deposit funds to a student's wallet
router.post('/wallet/deposit', async (req, res) => {
  try {
    const { studentId, amount } = req.body;
    const amt = Number(amount);
    if (!studentId || !Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'studentId and positive amount are required' });
    const student = await Student.findByIdAndUpdate(studentId, { $inc: { walletBalance: amt } }, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    // Record wallet transaction (credit)
    try {
      await WalletTransaction.create({
        studentId: student._id,
        rfid_uid: student.rfid_uid,
        amount: amt,
        type: 'credit',
        itemName: 'Admin deposit',
      });
    } catch (_) {}
    // Emit socket update for real-time UI refresh
    try { req.app.get('io').emit('wallet:updated', { studentId: String(student._id), balance: student.walletBalance }); } catch {}
    return res.json({ ok: true, walletBalance: student.walletBalance });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Wallet: withdraw funds from a student's wallet
router.post('/wallet/withdraw', async (req, res) => {
  try {
    const { studentId, amount } = req.body;
    const amt = Number(amount);
    if (!studentId || !Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'studentId and positive amount are required' });
    const student = await Student.findOneAndUpdate(
      { _id: studentId, walletBalance: { $gte: amt } },
      { $inc: { walletBalance: -amt } },
      { new: true }
    );
    if (!student) return res.status(400).json({ message: 'Insufficient wallet balance or student not found' });
    // Record wallet transaction (debit)
    try {
      await WalletTransaction.create({
        studentId: student._id,
        rfid_uid: student.rfid_uid,
        amount: amt,
        type: 'debit',
        itemName: 'Admin withdrawal',
      });
    } catch (_) {}
    // Emit socket update for real-time UI refresh
    try { req.app.get('io').emit('wallet:updated', { studentId: String(student._id), balance: student.walletBalance }); } catch {}
    return res.json({ ok: true, walletBalance: student.walletBalance });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// View all transactions
router.get('/transactions', async (req, res) => {
  const txs = await Transaction.find().sort({ createdAt: -1 }).populate('user').populate('item');
  res.json(txs);
});

module.exports = router;

// Students: create and list
// Create student with unique rollNo and RFID UID, set initial password
router.post('/students', async (req, res) => {
  try {
    const { name, rollNo, RFIDNumber, password, email, mobileNumber, department } = req.body;

    // Validate required fields
    const required = { name, rollNo, RFIDNumber, password, email, mobileNumber };
    for (const [field, value] of Object.entries(required)) {
      if (!value) {
        return res.status(400).json({ message: `${field} is required.` });
      }
    }

    // Basic mobile validation (+ optional, 7-15 digits)
    const phone = String(mobileNumber).trim();
    if (!/^\+?\d{7,15}$/.test(phone)) {
      return res.status(400).json({ message: 'Invalid mobileNumber format' });
    }

    // Check for duplicates using the correct DB field 'rfid_uid'
    const existingStudent = await Student.findOne({ $or: [{ rollNo }, { rfid_uid: RFIDNumber }, { email }] });
    if (existingStudent) {
      let message = 'already exists.';
      if (existingStudent.rollNo === rollNo) message = `Roll No ${message}`;
      else if (existingStudent.rfid_uid === RFIDNumber) message = `RFID Number ${message}`;
      else if (existingStudent.email === email) message = `Email ${message}`;
      return res.status(400).json({ message });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const student = await Student.create({
      name,
      rollNo,
      email,
      mobileNumber: phone,
      rfid_uid: RFIDNumber, // Map RFIDNumber from form to rfid_uid in DB
      passwordHash,
      department,
    });

    return res.status(201).json(student);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// List students (basic)
router.get('/students', async (req, res) => {
  const students = await Student.find().sort({ createdAt: -1 });
  return res.json(students);
});
