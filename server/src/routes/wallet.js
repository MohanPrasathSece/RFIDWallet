const router = require('express').Router();
let Razorpay;
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Student = require('../models/Student');
const WalletTransaction = require('../models/WalletTransaction');

function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error('Missing Razorpay credentials');
  if (!Razorpay) {
    try {
      // Lazy-load to avoid server crash when package isn't installed yet
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      Razorpay = require('razorpay');
    } catch (e) {
      throw new Error('Razorpay SDK not installed. Run "npm install razorpay" in server/ directory.');
    }
  }
  return new Razorpay({ key_id, key_secret });
}

// GET /api/wallet/balance
router.get('/balance', auth(), async (req, res) => {
  try {
    if (!req.student) return res.status(401).json({ message: 'Unauthorized' });
    const student = await Student.findById(req.student._id).lean();
    return res.json({ balance: student.walletBalance || 0, rfid_uid: student.rfid_uid, name: student.name });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// GET /api/wallet/history
router.get('/history', auth(), async (req, res) => {
  try {
    if (!req.student) return res.status(401).json({ message: 'Unauthorized' });
    const list = await WalletTransaction.find({ studentId: req.student._id }).sort({ createdAt: -1 }).lean();
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// POST /api/wallet/add { amount }
router.post('/add', auth(), async (req, res) => {
  try {
    if (!req.student) return res.status(401).json({ message: 'Unauthorized' });
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    const instance = getRazorpay();
    const order = await instance.orders.create({
      amount: Math.round(amount * 100), // INR paise
      currency: 'INR',
      receipt: `wallet_${req.student._id}_${Date.now()}`,
      notes: { studentId: String(req.student._id), rfid_uid: req.student.rfid_uid },
    });
    return res.json({ orderId: order.id, key: process.env.RAZORPAY_KEY_ID, amount: order.amount, currency: order.currency });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Webhook handler (must be mounted with raw body in index.js)
async function webhookHandler(req, res) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body; // raw buffer provided by express.raw
    const computed = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    if (!signature || signature !== computed) return res.status(400).json({ message: 'Invalid signature' });

    const event = JSON.parse(body.toString());
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload.payment?.entity || {};
      const notes = payment.notes || {};
      const amount = Number(payment.amount) / 100; // back to rupees
      const rfid_uid = notes.rfid_uid;
      const studentId = notes.studentId;

      if (!studentId || !rfid_uid || !Number.isFinite(amount) || amount <= 0) {
        return res.status(200).json({ ok: true }); // ignore malformed
      }

      // Atomically increment balance
      const student = await Student.findOneAndUpdate(
        { _id: studentId, rfid_uid },
        { $inc: { walletBalance: amount } },
        { new: true }
      );
      if (student) {
        await WalletTransaction.create({
          studentId: student._id,
          rfid_uid,
          amount,
          type: 'credit',
          razorpay_payment_id: payment.id,
        });
      }

      // Emit socket update
      try { req.app.get('io').emit('wallet:updated', { studentId, balance: student?.walletBalance }); } catch {}
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

module.exports = { router, webhookHandler };
