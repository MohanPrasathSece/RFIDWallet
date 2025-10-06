
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rollNo: { type: String, required: true, unique: true, index: true },
    email: { type: String, unique: true, sparse: true, index: true },
    passwordHash: { type: String, required: true },
    // Standardize on rfid_uid; keep legacy RFIDNumber for backward compat if present
    rfid_uid: { type: String, required: true, unique: true, index: true },
    RFIDNumber: { type: String, unique: true, sparse: true },
    mobileNumber: { type: String },
    department: { type: String },
    walletBalance: { type: Number, default: 0 },
    // Student can belong to multiple modules; default to all
    modules: { type: [String], enum: ['library', 'food', 'store'], default: ['library', 'food', 'store'] },
    // Soft status flag
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
