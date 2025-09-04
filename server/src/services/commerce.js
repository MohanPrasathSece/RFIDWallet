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

// Helper to resolve student (supports id, rollNo, rfid_uid, and legacy RFIDNumber)
async function resolveStudent({ studentId, rfidNumber, rollNo, rfid_uid }) {
  if (studentId) {
    const s = await Student.findById(studentId);
    if (s) return s;
  }
  if (rollNo) {
    const s = await Student.findOne({ rollNo });
    if (s) return s;
  }
  if (rfid_uid) {
    const s = await Student.findOne({ rfid_uid });
    if (s) return s;
  }
  if (rfidNumber) { // legacy support
    const s = await Student.findOne({ RFIDNumber: rfidNumber });
    if (s) return s;
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
