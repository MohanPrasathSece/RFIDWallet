const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const Student = require('../models/Student');
const { sendPlainMessage } = require('./telegram');

// Notify students when a new library item is added/updated with topics
// Strategy: find students who have approved 'borrow' transactions for items
// that share at least one topic with the new item.
async function notifyLibraryNewItem(item) {
  try {
    if (!item || item.type !== 'library' || !Array.isArray(item.topics) || item.topics.length === 0) return;

    // Find items that share topics
    const relatedItems = await Item.find({ type: 'library', topics: { $in: item.topics } }).select('_id');
    const relatedIds = relatedItems.map(i => i._id);
    if (relatedIds.length === 0) return;

    // Find students who borrowed related items
    const borrows = await Transaction.find({
      module: 'library',
      action: 'borrow',
      status: 'approved',
      item: { $in: relatedIds },
    }).select('student').populate('student');

    const notified = new Set();
    for (const b of borrows) {
      const st = b.student;
      if (!st || !st.telegramUserID) continue;
      if (notified.has(st.telegramUserID)) continue;
      notified.add(st.telegramUserID);
      const text = `New library item added: ${item.name}. Topics: ${(item.topics || []).join(', ')}. Check it out!`;
      try { await sendPlainMessage(st.telegramUserID, text); } catch (_) {}
    }
  } catch (e) {
    console.error('notifyLibraryNewItem error:', e.message);
  }
}

// Get a student's library history (approved transactions)
async function getLibraryHistoryByStudent(studentId) {
  const txs = await Transaction.find({
    module: 'library',
    student: studentId,
    status: 'approved',
  }).sort({ createdAt: -1 }).populate('item').populate('student');
  return txs;
}

// Compute currently borrowed items for a student (borrows - returns)
async function getActiveBorrowsByStudent(studentId) {
  const txs = await Transaction.find({ module: 'library', student: studentId, status: 'approved' }).select('action item createdAt dueDate').populate('item');
  const counts = new Map();
  for (const tx of txs) {
    const key = String(tx.item?._id || 'none');
    if (!counts.has(key)) counts.set(key, { item: tx.item, count: 0, last: tx.createdAt, dueDate: undefined });
    const rec = counts.get(key);
    if (tx.action === 'borrow') rec.count += 1;
    if (tx.action === 'return') rec.count -= 1;
    if (!rec.last || tx.createdAt > rec.last) rec.last = tx.createdAt;
    if (tx.action === 'borrow' && tx.dueDate) rec.dueDate = tx.dueDate;
  }
  const active = [];
  for (const { item, count, last, dueDate } of counts.values()) {
    if (count > 0) active.push({ item, count, last, dueDate });
  }
  // newest first
  active.sort((a, b) => b.last - a.last);
  return active;
}

// Helper: resolve student by RFIDNumber or id
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

module.exports = {
  notifyLibraryNewItem,
  getLibraryHistoryByStudent,
  getActiveBorrowsByStudent,
  resolveStudent,
};
