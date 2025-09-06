const router = require('express').Router();
let Razorpay;
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Student = require('../models/Student');
const WalletTransaction = require('../models/WalletTransaction');

function getRazorpay() {
  const rawId = process.env.RAZORPAY_KEY_ID || '';
  const rawSecret = process.env.RAZORPAY_KEY_SECRET || '';
  const key_id = rawId.trim();
  const key_secret = rawSecret.trim();
  
  // Enhanced diagnostics
  console.log('[Razorpay] Initializing SDK', {
    mode: key_id.includes('_test_') ? 'TEST' : key_id.includes('_live_') ? 'LIVE' : 'UNKNOWN',
    keyIdMasked: key_id ? `${key_id.slice(0, 8)}...${key_id.slice(-2)}` : 'not set',
    hasWhitespaceId: rawId !== key_id,
    hasWhitespaceSecret: rawSecret !== key_secret,
    quotedId: (rawId.startsWith('"') && rawId.endsWith('"')) || (rawId.startsWith("'") && rawId.endsWith("'")),
    quotedSecret: (rawSecret.startsWith('"') && rawSecret.endsWith('"')) || (rawSecret.startsWith("'") && rawSecret.endsWith("'")),
  });
  
  if (!key_id || !key_secret) {
    throw new Error('Missing Razorpay credentials');
  }
  
  if (!Razorpay) {
    Razorpay = require('razorpay');
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
    const filter = { studentId: req.student._id };
    if (req.query.receiptId) filter.receiptId = req.query.receiptId;
    if (req.query.module) filter.module = req.query.module;
    const list = await WalletTransaction.find(filter).sort({ createdAt: -1 }).lean();
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
    let instance;
    try {
      instance = getRazorpay();
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes('Missing Razorpay credentials')) {
        return res.status(503).json({ message: 'Razorpay not configured on server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
      }
      if (msg.includes('Razorpay SDK not installed')) {
        return res.status(503).json({ message: 'Razorpay SDK not installed on server. Run "npm install razorpay" in server/.' });
      }
      return res.status(500).json({ message: msg });
    }
    console.log('[Razorpay] Creating order', {
      amountPaise: Math.round(amount * 100),
      studentId: String(req.student._id),
      rfid_uid: req.student.rfid_uid,
    });
    let order;
    try {
      order = await instance.orders.create({
        amount: Math.round(amount * 100), // INR paise
        currency: 'INR',
        receipt: `wallet_${req.student._id}_${Date.now()}`,
        notes: { studentId: String(req.student._id), rfid_uid: req.student.rfid_uid },
      });
    } catch (err) {
      // Provide detailed server-side logs for troubleshooting
      const details = {
        message: err?.message,
        status: err?.statusCode || err?.status,
        error: err?.error,
        response: err?.response?.data || err?.response,
      };
      console.error('[Razorpay] Order creation failed', details);

      // Return a clearer client-facing error
      const description = err?.error?.description || err?.response?.data?.error?.description || err?.message || 'Failed to create Razorpay order';
      return res.status(500).json({ message: `Razorpay order error: ${description}` });
    }
    console.log('[Razorpay] Order created', { orderId: order?.id, amount: order?.amount, currency: order?.currency });
    return res.json({ orderId: order.id, key: process.env.RAZORPAY_KEY_ID, amount: order.amount, currency: order.currency });
  } catch (e) {
    return res.status(500).json({ message: e?.response?.data?.message || e.message || 'Internal error' });
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

// POST /api/wallet/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Verifies checkout handler response and credits wallet (idempotent) as a fallback to webhooks
router.post('/verify', auth(), async (req, res) => {
  try {
    if (!req.student) return res.status(401).json({ message: 'Unauthorized' });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay verification fields' });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) return res.status(503).json({ message: 'Razorpay not configured' });

    // Verify signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', key_secret).update(body).digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid Razorpay signature' });
    }

    // Fetch payment to confirm status and retrieve notes
    let instance;
    try { instance = getRazorpay(); } catch (e) {
      return res.status(503).json({ message: 'Razorpay SDK not available' });
    }

    let payment;
    try {
      payment = await instance.payments.fetch(razorpay_payment_id);
    } catch (e) {
      return res.status(500).json({ message: 'Failed to fetch payment from Razorpay' });
    }

    const status = payment?.status; // created, authorized, captured, failed, refunded, etc.
    if (status !== 'captured' && status !== 'authorized') {
      return res.status(400).json({ message: `Payment not successful (status: ${status})` });
    }

    // Determine studentId and rfid from payment notes or order notes
    let studentId = payment?.notes?.studentId;
    let rfid_uid = payment?.notes?.rfid_uid;
    if (!studentId || !rfid_uid) {
      try {
        const order = await instance.orders.fetch(razorpay_order_id);
        studentId = studentId || order?.notes?.studentId;
        rfid_uid = rfid_uid || order?.notes?.rfid_uid;
      } catch (_) {}
    }

    // Fallback: use requester student if notes missing
    if (!studentId) studentId = String(req.student._id);
    if (!rfid_uid) rfid_uid = req.student.rfid_uid;

    const amount = Number(payment?.amount) / 100; // rupees
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    // Idempotent credit: if we already recorded this payment, just return ok
    const existing = await WalletTransaction.findOne({ razorpay_payment_id: razorpay_payment_id });
    if (!existing) {
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
          razorpay_payment_id,
        });
        try { req.app.get('io').emit('wallet:updated', { studentId, balance: student.walletBalance }); } catch {}
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});
