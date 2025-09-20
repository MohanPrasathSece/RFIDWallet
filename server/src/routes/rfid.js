const router = require('express').Router();
const Student = require('../models/Student');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const { auth, requireRoles, deviceAuth } = require('../middleware/auth');
const { sendApprovalRequest } = require('../services/telegram');

// RFID scan endpoint integrated with Telegram approval
// body: { rfidNumber: string, module: 'library'|'food'|'store', itemId?: string, location?: string, action?: string }
router.post('/scan', auth(), requireRoles('admin', 'staff'), async (req, res) => {
  try {
    const { rfidNumber, module, itemId, location = 'Unknown', action } = req.body;
    if (!rfidNumber || !module) return res.status(400).json({ message: 'rfidNumber and module are required' });

    const rfid = String(rfidNumber).trim().toUpperCase();
    const student = await Student.findOne({
      $or: [
        { rfid_uid: rfid },
        { RFIDNumber: rfid },
      ],
    });
    if (!student) return res.status(404).json({ message: 'Student not found for RFID' });

    let item = null;
    if (itemId) item = await Item.findById(itemId);

    // Create pending transaction
    const tx = await Transaction.create({
      student: student._id,
      module,
      item: item ? item._id : undefined,
      action: action || (module === 'library' ? 'borrow' : 'purchase'),
      status: 'pending',
      amount: item ? item.price : undefined,
      notes: `RFID ${rfidNumber} at ${location}`,
    });

    const full = await Transaction.findById(tx._id).populate('student').populate('item');

    // Emit pending event so dashboard shows awaiting approval
    req.app.get('io').emit('rfid:pending', full);

    // Send Telegram approval if configured
    if (student.telegramUserID) {
      try {
        await sendApprovalRequest({ chatId: student.telegramUserID, location, txId: tx._id.toString() });
      } catch (err) {
        console.warn('Telegram send failed:', err.message);
      }
    }

    return res.status(201).json(full);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// ESP32-friendly endpoint using API key auth (no JWT). Same behavior as /scan.
// Header: X-Device-Key: <DEVICE_API_KEY>
// body: { rfidNumber: string, module: 'library'|'food'|'store', itemId?: string, location?: string, action?: string }
router.post('/esp32-scan', deviceAuth(), async (req, res) => {
  try {
    const { rfidNumber, module, itemId, location = 'Unknown', action } = req.body;
    if (!rfidNumber || !module) return res.status(400).json({ message: 'rfidNumber and module are required' });

    const rfid = String(rfidNumber).trim().toUpperCase();
    // Ignore placeholder/no-card UIDs
    if (rfid === 'FFFFFFFF' || rfid === '00000000') {
      return res.status(400).json({ message: 'Invalid RFID' });
    }
    const student = await Student.findOne({
      $or: [
        { rfid_uid: rfid },
        { RFIDNumber: rfid },
      ],
    });
    if (!student) return res.status(404).json({ message: 'Student not found for RFID' });

    let item = null;
    if (itemId) item = await Item.findById(itemId);

    const tx = await Transaction.create({
      student: student._id,
      module,
      item: item ? item._id : undefined,
      action: action || (module === 'library' ? 'borrow' : 'purchase'),
      status: 'pending',
      amount: item ? item.price : undefined,
      notes: `RFID ${rfidNumber} at ${location} (esp32)`,
    });

    const full = await Transaction.findById(tx._id).populate('student').populate('item');
    req.app.get('io').emit('rfid:pending', full);

    if (student.telegramUserID) {
      try {
        await sendApprovalRequest({ chatId: student.telegramUserID, location, txId: tx._id.toString() });
      } catch (err) {
        console.warn('Telegram send failed:', err.message);
      }
    }

    return res.status(201).json(full);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Resolve endpoint to map RFID to student without creating a transaction (public for local use)
// GET /api/rfid/resolve/:rfidNumber
router.get('/resolve/:rfidNumber', async (req, res) => {
  try {
    const { rfidNumber } = req.params;
    const rfid = String(rfidNumber).trim().toUpperCase();
    const student = await Student.findOne({
      $or: [
        { rfid_uid: rfid },
        { RFIDNumber: rfid },
      ],
    });
    if (!student) return res.status(404).json({ message: 'Student not found for RFID' });
    return res.json({ _id: student._id, name: student.name, RFIDNumber: student.RFIDNumber || student.rfid_uid, modules: student.modules, walletBalance: student.walletBalance });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;
