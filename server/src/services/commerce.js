const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const Student = require('../models/Student');

// Notifications removed (Telegram feature removed)
async function notifyNewCommerceItem(_) { return; }

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
