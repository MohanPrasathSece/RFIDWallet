const router = require('express').Router();
const { auth, requireRoles } = require('../middleware/auth');
const { resolveStudent, getCommerceHistory } = require('../services/commerce');
const Transaction = require('../models/Transaction');

// Admin/staff: purchase history for store module
router.get('/history', auth(), requireRoles('admin'), async (req, res) => {
  try {
    const { student: studentId, rfidNumber } = req.query;
    const student = await resolveStudent({ studentId, rfidNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const txs = await getCommerceHistory('store', student._id);
    // Map to include essential fields
    const payload = txs.map(tx => ({
      _id: tx._id,
      createdAt: tx.createdAt,
      action: tx.action,
      status: tx.status,
      item: tx.item ? { _id: tx.item._id, name: tx.item.name } : null,
      student: tx.student ? { _id: tx.student._id, name: tx.student.name, rfid: tx.student.RFIDNumber } : null,
      notes: tx.notes || ''
    }));
    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// All scans for store (module-wide)
router.get('/history-all', auth(), requireRoles('admin'), async (req, res) => {
  try {
    const txs = await Transaction.find({ module: 'store' })
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
      student: tx.student ? { _id: tx.student._id, name: tx.student.name, rfid: tx.student.RFIDNumber } : null,
      notes: tx.notes || ''
    }));
    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;

