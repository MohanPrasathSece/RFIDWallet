const router = require('express').Router();
const { auth, requireRoles } = require('../middleware/auth');
const { getLibraryHistoryByStudent, getActiveBorrowsByStudent, resolveStudent } = require('../services/library');
const Transaction = require('../models/Transaction');

// Get library history for a student (by studentId or rfidNumber)
router.get('/history', auth(), requireRoles('admin'), async (req, res) => {
  try {
    const { student: studentId, rfidNumber } = req.query;
    const student = await resolveStudent({ studentId, rfidNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const txs = await getLibraryHistoryByStudent(student._id);
    return res.json(txs);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Get active borrows for the currently authenticated student
router.get('/my-active', auth(), async (req, res) => {
  try {
    if (!req.student?._id) return res.status(401).json({ message: 'Unauthorized' });
    const active = await getActiveBorrowsByStudent(req.student._id);
    return res.json(active);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Get active borrows for a student (by studentId or rfidNumber)
router.get('/active', auth(), requireRoles('admin'), async (req, res) => {
  try {
    const { student: studentId, rfidNumber } = req.query;
    const student = await resolveStudent({ studentId, rfidNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const active = await getActiveBorrowsByStudent(student._id);
    return res.json(active);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// All scans for library (module-wide) - public endpoint (no auth)
router.get('/history-all', async (req, res) => {
  try {
    const txs = await Transaction.find({ module: 'library' })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('item')
      .populate('student');
    const payload = txs.map(tx => ({
      _id: tx._id,
      createdAt: tx.createdAt,
      action: tx.action,
      status: tx.status,
      item: tx.item ? { _id: tx.item._id, name: tx.item.name } : null,
      student: tx.student ? { _id: tx.student._id, name: tx.student.name, rfid: (tx.student.rfid_uid || tx.student.RFIDNumber || tx.student.rfid || '') } : null,
      notes: tx.notes || ''
    }));
    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;

