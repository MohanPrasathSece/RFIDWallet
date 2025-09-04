const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const Student = require('../models/Student');
const { sendPlainMessage } = require('./telegram');

// Notify students when a new food/store item is added
// Strategy: find students who have approved 'purchase' transactions in the same module (food/store)
async function notifyNewCommerceItem(item) {
  try {
    if (!item || (item.type !== 'food' && item.type !== 'store')) return;

    // Find students who purchased in this module before
    const txs = await Transaction.find({ module: item.type, action: 'purchase', status: 'approved' })
      .select('student')
      .populate('student');

    const notified = new Set();
    for (const t of txs) {
      const st = t.student;
      if (!st || !st.telegramUserID) continue;
      if (notified.has(st.telegramUserID)) continue;
      notified.add(st.telegramUserID);
      const text = `New ${item.type === 'food' ? 'menu' : 'store'} item: ${item.name}.`;
      try { await sendPlainMessage(st.telegramUserID, text); } catch (_) {}
    }
  } catch (e) {
    console.error('notifyNewCommerceItem error:', e.message);
  }
}

// Helper to resolve student
async function resolveStudent({ studentId, rfidNumber }) {
  if (studentId) {
    const s = await Student.findById(studentId);
    return s || null;
  }
  if (rfidNumber) {
    const s = await Student.findOne({ RFIDNumber: rfidNumber });
    return s || null;
  }
  return null;
}

// Get purchase history for food/store
async function getCommerceHistory(moduleName, studentId) {
  const txs = await Transaction.find({ module: moduleName, student: studentId, status: 'approved' })
    .sort({ createdAt: -1 })
    .populate('student')
    .populate('item');
  return txs;
}

module.exports = { notifyNewCommerceItem, resolveStudent, getCommerceHistory };
