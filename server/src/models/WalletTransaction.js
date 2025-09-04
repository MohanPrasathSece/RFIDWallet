const mongoose = require('mongoose');

const walletTxSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    rfid_uid: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    razorpay_payment_id: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletTransaction', walletTxSchema);
