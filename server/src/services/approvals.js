const Item = require('../models/Item');
const Transaction = require('../models/Transaction');

async function applyApprovalEffects(tx) {
  // Only apply for approved
  if (!tx || tx.status !== 'approved') return;
  // Load with item if needed
  const item = tx.item ? await Item.findById(tx.item) : null;
  if (!item) return; // nothing to adjust

  // Module-specific quantity adjustments
  switch (tx.module) {
    case 'library': {
      // borrow -> decrement; return -> increment
      if (tx.action === 'borrow') item.quantity = Math.max(0, (item.quantity || 0) - 1);
      if (tx.action === 'return') item.quantity = (item.quantity || 0) + 1;
      break;
    }
    case 'food':
    case 'store': {
      // purchase -> decrement by 1 (or by amount/price mapping if tracked differently)
      if (tx.action === 'purchase') item.quantity = Math.max(0, (item.quantity || 0) - 1);
      break;
    }
    default:
      break;
  }
  await item.save();
}

async function onTransactionStatusChange(txId, previousStatus, nextStatus) {
  try {
    if (previousStatus === nextStatus) return;
    if (nextStatus !== 'approved') return; // Only apply on approval
    const tx = await Transaction.findById(txId);
    if (!tx) return;
    await applyApprovalEffects(tx);
  } catch (e) {
    console.error('applyApprovalEffects error:', e.message);
  }
}

module.exports = { onTransactionStatusChange, applyApprovalEffects };
