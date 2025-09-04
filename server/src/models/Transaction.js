const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    module: { type: String, enum: ['library', 'food', 'store'], required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    action: { type: String, enum: ['borrow', 'return', 'purchase', 'approve'], required: true },
    amount: Number,
    status: { type: String, enum: ['approved', 'rejected', 'pending'], default: 'approved' },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
