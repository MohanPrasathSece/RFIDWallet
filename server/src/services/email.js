const nodemailer = require('nodemailer');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in server/.env');
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS on 587/2525
    auth: { user, pass },
  });
  return transporter;
}

async function sendEmail({ to, subject, html, text, attachments }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const tx = getTransporter();
  const payload = { from, to, subject, html: html || undefined, text: text || undefined };
  if (attachments && Array.isArray(attachments) && attachments.length) {
    payload.attachments = attachments;
  }
  return tx.sendMail(payload);
}

module.exports = { sendEmail };
