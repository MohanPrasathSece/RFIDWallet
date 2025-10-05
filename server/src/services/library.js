const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const Student = require('../models/Student');
const { sendEmail } = require('./email');

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

    // Telegram notifications removed
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
  runLibraryDueReminders,
};

// ----------------- Due Reminders -----------------
// Find approved library borrows that are due soon or overdue and notify students via email.

async function runLibraryDueReminders() {
  const now = new Date();
  const soonWindowMs = 24 * 60 * 60 * 1000; // 24h

  // Fetch approved borrows with a dueDate
  const borrows = await Transaction.find({
    module: 'library',
    action: 'borrow',
    status: 'approved',
    dueDate: { $ne: null },
  }).populate('student').populate('item');

  for (const tx of borrows) {
    const due = tx.dueDate ? new Date(tx.dueDate) : null;
    if (!due) continue;
    const msLeft = due.getTime() - now.getTime();

    let kind = null;
    if (msLeft <= 0) kind = 'overdue';
    else if (msLeft <= soonWindowMs) kind = 'due_soon';
    else continue;

    const st = tx.student;
    const item = tx.item;
    const itemName = item?.name || 'Library Item';
    const dueStr = due.toLocaleString();
    const baseMsg = kind === 'overdue'
      ? `Reminder: Your borrowed book "${itemName}" is OVERDUE. Due on ${dueStr}. Please return it as soon as possible.`
      : `Reminder: Your borrowed book "${itemName}" is due soon. Due on ${dueStr}. Please return on time.`;

    // Email (if available and SMTP configured)
    if (st?.email) {
      try {
        await sendEmail({
          to: st.email,
          subject: kind === 'overdue' ? `OVERDUE: ${itemName} library return` : `Reminder: ${itemName} due soon`,
          text: baseMsg,
          html: `<p>${baseMsg}</p>`,
        });
      } catch (_) {}
    }
  }
}
