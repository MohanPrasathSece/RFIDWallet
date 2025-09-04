const TelegramBot = require('node-telegram-bot-api');
const Transaction = require('../models/Transaction');
const { onTransactionStatusChange } = require('./approvals');

let bot = null;
let ioRef = null;

function initTelegram(app, io) {
  ioRef = io;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not set. Telegram integration disabled.');
    return { enabled: false };
  }

  const base = process.env.PUBLIC_BASE_URL; // e.g., https://your-domain
  if (base) {
    bot = new TelegramBot(token, { webHook: true });
    const path = '/api/telegram/webhook';
    const url = `${base}${path}`;
    bot.setWebHook(url).then(() => console.log('Telegram webhook set:', url)).catch(console.error);

    app.post(path, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
  } else {
    bot = new TelegramBot(token, { polling: true });
    console.log('Telegram bot started in polling mode');
  }

  // Handle callback queries for Approve/Deny
  bot.on('callback_query', async (query) => {
    try {
      const data = query.data || '';
      // format: appr|<txId>|approve OR appr|<txId>|deny
      if (!data.startsWith('appr|')) return;
      const [, txId, decision] = data.split('|');
      const status = decision === 'approve' ? 'approved' : 'rejected';
      const before = await Transaction.findById(txId).select('status');
      const tx = await Transaction.findByIdAndUpdate(txId, { status }, { new: true })
        .populate('user')
        .populate('student')
        .populate('item');
      if (tx && ioRef) ioRef.emit('transaction:update', tx);
      if (before && before.status !== status) await onTransactionStatusChange(txId, before.status, status);

      // Acknowledge to user
      bot.answerCallbackQuery(query.id, { text: `You ${status === 'approved' ? 'approved' : 'denied'} the request.` }).catch(()=>{});
      // Edit original message to reflect decision
      if (query.message) {
        bot.editMessageText(`Approval ${status === 'approved' ? 'Approved ✅' : 'Denied ❌'}`, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id
        }).catch(()=>{});
      }
    } catch (e) {
      console.error('Callback handling error:', e.message);
    }
  });

  return { enabled: true };
}

async function sendApprovalRequest({ chatId, location, txId }) {
  if (!bot) throw new Error('Telegram not initialized');
  const text = `Approval Request – Your RFID card was scanned at ${location}. Approve or Deny?`;
  const opts = {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Approve ✅', callback_data: `appr|${txId}|approve` },
        { text: 'Deny ❌', callback_data: `appr|${txId}|deny` }
      ]]
    }
  };
  return bot.sendMessage(chatId, text, opts);
}

// Simple plain text message sender (for notifications)
async function sendPlainMessage(chatId, text) {
  if (!bot) throw new Error('Telegram not initialized');
  return bot.sendMessage(chatId, text);
}

module.exports = { initTelegram, sendApprovalRequest, sendPlainMessage };
