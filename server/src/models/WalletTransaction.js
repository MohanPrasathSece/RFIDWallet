const mongoose = require('mongoose');

const walletTxSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    rfid_uid: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    razorpay_payment_id: { type: String },
    // Optional purchase context (for debits in food/store)
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    itemName: { type: String },
    itemPrice: { type: Number },
    module: { type: String, enum: ['food', 'store', 'library'], default: undefined },
    receiptId: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletTransaction', walletTxSchema);
