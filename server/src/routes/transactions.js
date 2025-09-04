const router = require('express').Router();
const Transaction = require('../models/Transaction');
const Student = require('../models/Student');
const Item = require('../models/Item');
const WalletTransaction = require('../models/WalletTransaction');
const { auth, requireRoles } = require('../middleware/auth');

// Create transaction (public for local use)
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    // For purchases in food/store, enforce wallet deduction and compute amount from Item.price if missing
    if (body.action === 'purchase' && (body.module === 'food' || body.module === 'store')) {
      if (!body.student) return res.status(400).json({ message: 'student is required' });
      if (!body.item) return res.status(400).json({ message: 'item is required' });

      const item = await Item.findById(body.item);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      const amount = Number(body.amount ?? item.price ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

      // Atomically deduct wallet if sufficient
      const student = await Student.findOneAndUpdate(
        { _id: body.student, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true }
      );
      if (!student) return res.status(400).json({ message: 'Insufficient wallet balance' });

      // Decrement item quantity if applicable (best-effort)
      await Item.findOneAndUpdate({ _id: item._id, quantity: { $gte: 1 } }, { $inc: { quantity: -1 } });

      const tx = await Transaction.create({
        ...body,
        amount,
        status: body.status || 'approved',
      });
      // Record wallet debit
      try {
        await WalletTransaction.create({
          studentId: student._id,
          rfid_uid: student.rfid_uid || '',
          amount,
          type: 'debit',
        });
      } catch {}
      // Emit wallet update
      try { req.app.get('io').emit('wallet:updated', { studentId: student._id, balance: student.walletBalance }); } catch {}
      req.app.get('io').emit('transaction:new', tx);
      return res.status(201).json(tx);
    }

    // Default path: create as-is
    const tx = await Transaction.create(body);
    req.app.get('io').emit('transaction:new', tx);
    return res.status(201).json(tx);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// List transactions with filters: ?module=&user=&status=&from=&to= (public)
router.get('/', async (req, res) => {
  const { module, user, status, from, to } = req.query;
  const filter = {};
  if (module) filter.module = module;
  if (user) filter.user = user;
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const txs = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .populate('user')
    .populate('student')
    .populate('item');
  return res.json(txs);
});

// Get one
router.get('/:id', auth(), async (req, res) => {
  const tx = await Transaction.findById(req.params.id)
    .populate('user')
    .populate('student')
    .populate('item');
  if (!tx) return res.status(404).json({ message: 'Not found' });
  return res.json(tx);
});

// Update status/notes (public for local use)
router.put('/:id', async (req, res) => {
  try {
    const before = await Transaction.findById(req.params.id).select('status');
    const tx = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!tx) return res.status(404).json({ message: 'Not found' });
    req.app.get('io').emit('transaction:update', tx);
    if (before && req.body.status && before.status !== req.body.status) {
      const { onTransactionStatusChange } = require('../services/approvals');
      await onTransactionStatusChange(tx._id, before.status, req.body.status);
    }
    return res.json(tx);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Delete
router.delete('/:id', auth(), requireRoles('admin'), async (req, res) => {
  const tx = await Transaction.findByIdAndDelete(req.params.id);
  if (!tx) return res.status(404).json({ message: 'Not found' });
  req.app.get('io').emit('transaction:delete', { id: req.params.id });
  return res.json({ ok: true });
});

module.exports = router;
