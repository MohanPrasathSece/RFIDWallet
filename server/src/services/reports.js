const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');
const WalletTransaction = require('../models/WalletTransaction');
const Student = require('../models/Student');
const { sendEmail } = require('./email');

const TZ = 'Asia/Kolkata';

function monthRange(year, month /* 1-12 */) {
  const start = moment.tz({ year, month: month - 1, day: 1, hour: 0, minute: 0, second: 0 }, TZ);
  const end = start.clone().add(1, 'month');
  return { start: start.toDate(), end: end.toDate(), label: start.format('MMMM YYYY') };
}

async function fetchStudentMonthDebits(studentId, start, end) {
  const rows = await WalletTransaction.find({
    studentId,
    type: 'debit',
    createdAt: { $gte: start, $lt: end },
    module: { $in: ['food', 'store'] },
  }).sort({ createdAt: 1 }).lean();
  const food = rows.filter(r => r.module === 'food');
  const store = rows.filter(r => r.module === 'store');
  return { food, store };
}

function money(n) { return `₹ ${Number(n || 0).toFixed(2)}`; }

async function buildStudentMonthlyPdf({ student, monthLabel, periodStart, periodEnd, food, store, includeReceipts = true }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Header
    doc
      .fontSize(16).fillColor('#14532d').text('Sri Eshwar College of Engineering', { align: 'center' })
      .moveDown(0.3)
      .fontSize(12).fillColor('#0f766e').text('Monthly Expense Report', { align: 'center' })
      .moveDown(0.2)
      .fontSize(10).fillColor('#334155').text(monthLabel, { align: 'center' })
      .moveDown(0.8);

    // Student meta
    const idLast = (student?.rfid_uid || '').slice(-4) || '—';
    doc.fontSize(10).fillColor('#111827');
    doc.text(`Student: ${student?.name || '—'}`);
    doc.text(`Roll No: ${student?.rollNo || '—'}`);
    doc.text(`RFID: ****${idLast}`);
    doc.text(`Email: ${student?.email || '—'}`);
    doc.moveDown(0.5);

    const drawTable = (title, rows) => {
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#0f172a').text(title);
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#334155');
      // Header row
      const headers = includeReceipts ? ['Date/Time', 'Item', 'Receipt', 'Amount'] : ['Date/Time', 'Item', 'Amount'];
      doc.text(headers.join('    '));
      doc.moveDown(0.2);
      doc.fillColor('#64748b').text(''.padEnd(90, '—'));

      let total = 0;
      doc.fillColor('#111827');
      rows.forEach(r => {
        const dt = moment(r.createdAt).tz(TZ).format('DD MMM YYYY, HH:mm');
        const cols = includeReceipts ? [dt, r.itemName || '—', r.receiptId || '—', money(r.amount)] : [dt, r.itemName || '—', money(r.amount)];
        doc.text(cols.join('    '));
        total += Number(r.amount || 0);
      });

      doc.moveDown(0.2).fillColor('#64748b').text(''.padEnd(90, '—'));
      doc.moveDown(0.1).fillColor('#111827').text(`Total ${title.split(' ')[0]}: ${money(total)}`);
      return total;
    };

    const foodTotal = drawTable('Food Purchases', food);
    doc.addPage();
    const storeTotal = drawTable('Store Purchases', store);

    // Summary
    const grand = foodTotal + storeTotal;
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#0f172a').text('Summary');
    doc.fontSize(10).fillColor('#111827');
    doc.text(`Food: ${money(foodTotal)}`);
    doc.text(`Store: ${money(storeTotal)}`);
    doc.text(`Grand Total: ${money(grand)}`);

    // Footer
    doc.moveDown(1);
    doc.fillColor('#64748b').fontSize(9).text(`Generated on ${moment().tz(TZ).format('DD MMM YYYY, HH:mm z')} • SECE Cashless Campus`, { align: 'center' });

    doc.end();
  });
}

async function emailStudentMonthlyReport({ student, buffer, monthLabel, foodTotal, storeTotal }) {
  if (!student?.email) return false;
  const subject = `SECE Monthly Report – ${monthLabel}`;
  const html = `
    <p>Hello ${student.name || 'Student'},</p>
    <p>Please find attached your monthly Food and Store expense report for <b>${monthLabel}</b>.</p>
    <ul>
      <li>Food total: <b>${money(foodTotal)}</b></li>
      <li>Store total: <b>${money(storeTotal)}</b></li>
    </ul>
    <p>Regards,<br/>SECE Cashless Campus</p>
  `;
  const filenameSafeName = (student.name || 'Student').replace(/[^a-z0-9\-_ ]/gi, '_');
  const attachName = `SECE_Report_${monthLabel.replace(/\s+/g, '_')}_${filenameSafeName}.pdf`;
  await sendEmail({
    to: student.email,
    subject,
    html,
    text: `Monthly report for ${monthLabel}`,
    attachments: [{ filename: attachName, content: buffer, contentType: 'application/pdf' }],
  });
  return true;
}

async function generateAndSendStudentMonth(studentId, year, month, { includeReceipts = true, sendEmail: doEmail = true } = {}) {
  const { start, end, label } = monthRange(year, month);
  const student = await Student.findById(studentId).lean();
  if (!student) throw new Error('Student not found');
  const { food, store } = await fetchStudentMonthDebits(studentId, start, end);
  const foodTotal = food.reduce((s, x) => s + Number(x.amount || 0), 0);
  const storeTotal = store.reduce((s, x) => s + Number(x.amount || 0), 0);
  const buffer = await buildStudentMonthlyPdf({ student, monthLabel: label, periodStart: start, periodEnd: end, food, store, includeReceipts });
  if (doEmail) {
    await emailStudentMonthlyReport({ student, buffer, monthLabel: label, foodTotal, storeTotal });
  }
  return { buffer, label, foodTotal, storeTotal };
}

async function sendReportsForMonth(year, month, { includeReceipts = true } = {}) {
  const { start, end, label } = monthRange(year, month);
  // All distinct students with any food/store debit that month
  const ids = await WalletTransaction.distinct('studentId', {
    type: 'debit',
    createdAt: { $gte: start, $lt: end },
    module: { $in: ['food', 'store'] },
  });
  for (const sid of ids) {
    try {
      await generateAndSendStudentMonth(sid, year, month, { includeReceipts, sendEmail: true });
    } catch (e) {
      // continue to next student
    }
  }
  return { count: ids.length, label };
}

module.exports = {
  monthRange,
  generateAndSendStudentMonth,
  sendReportsForMonth,
};
