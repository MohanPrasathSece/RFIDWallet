const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['library', 'food', 'store'], required: true },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed },
    // Library-specific fields (optional)
    topics: [{ type: String }],
    author: { type: String },
    isbn: { type: String },
    publisher: { type: String },
    year: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
