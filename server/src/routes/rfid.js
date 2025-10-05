const router = require('express').Router();
const Student = require('../models/Student');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const { auth, requireRoles, deviceAuth } = require('../middleware/auth');

// RFID scan endpoint (immediate auto-approve, no Telegram)
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

    const finalAction = action || (module === 'library' ? 'borrow' : 'purchase');

    // Apply immediate effects and create approved transaction
    let amount = item ? item.price : undefined;
    if ((module === 'food' || module === 'store') && finalAction === 'purchase') {
      if (!item) return res.status(400).json({ message: 'itemId is required for purchase' });
      amount = Number(item.price || 0);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Invalid item price' });
      // Deduct wallet if sufficient
      const updated = await Student.findOneAndUpdate(
        { _id: student._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true }
      );
      if (!updated) return res.status(400).json({ message: 'Insufficient wallet balance' });
      // Decrement item quantity (best-effort)
      await Item.findOneAndUpdate({ _id: item._id, quantity: { $gte: 1 } }, { $inc: { quantity: -1 } });
      try { req.app.get('io').emit('wallet:updated', { studentId: student._id, balance: updated.walletBalance }); } catch {}
    }

    if (module === 'library') {
      if (finalAction === 'borrow') {
        if (!item) return res.status(400).json({ message: 'itemId is required for borrow' });
        const libItem = await Item.findById(item._id).select('quantity');
        if (!libItem || !Number.isFinite(libItem.quantity) || libItem.quantity <= 0) {
          return res.status(400).json({ message: 'Item unavailable (out of stock)' });
        }
        await Item.findOneAndUpdate({ _id: item._id, quantity: { $gte: 1 } }, { $inc: { quantity: -1 } });
      } else if (finalAction === 'return' && item) {
        await Item.findByIdAndUpdate(item._id, { $inc: { quantity: 1 } });
      }
    }

    const tx = await Transaction.create({
      student: student._id,
      module,
      item: item ? item._id : undefined,
      action: finalAction,
      status: 'approved',
      amount,
      notes: `RFID ${rfidNumber} at ${location}`,
    });

    const full = await Transaction.findById(tx._id).populate('student').populate('item');
    req.app.get('io').emit('transaction:new', full);
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

    const finalAction = action || (module === 'library' ? 'borrow' : 'purchase');
    let amount = item ? item.price : undefined;
    if ((module === 'food' || module === 'store') && finalAction === 'purchase') {
      if (!item) return res.status(400).json({ message: 'itemId is required for purchase' });
      amount = Number(item.price || 0);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Invalid item price' });
      const updated = await Student.findOneAndUpdate(
        { _id: student._id, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true }
      );
      if (!updated) return res.status(400).json({ message: 'Insufficient wallet balance' });
      await Item.findOneAndUpdate({ _id: item._id, quantity: { $gte: 1 } }, { $inc: { quantity: -1 } });
      try { req.app.get('io').emit('wallet:updated', { studentId: student._id, balance: updated.walletBalance }); } catch {}
    }

    if (module === 'library') {
      if (finalAction === 'borrow') {
        if (!item) return res.status(400).json({ message: 'itemId is required for borrow' });
        const libItem = await Item.findById(item._id).select('quantity');
        if (!libItem || !Number.isFinite(libItem.quantity) || libItem.quantity <= 0) {
          return res.status(400).json({ message: 'Item unavailable (out of stock)' });
        }
        await Item.findOneAndUpdate({ _id: item._id, quantity: { $gte: 1 } }, { $inc: { quantity: -1 } });
      } else if (finalAction === 'return' && item) {
        await Item.findByIdAndUpdate(item._id, { $inc: { quantity: 1 } });
      }
    }

    const tx = await Transaction.create({
      student: student._id,
      module,
      item: item ? item._id : undefined,
      action: finalAction,
      status: 'approved',
      amount,
      notes: `RFID ${rfidNumber} at ${location} (esp32)`,
    });

    const full = await Transaction.findById(tx._id).populate('student').populate('item');
    req.app.get('io').emit('transaction:new', full);
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
