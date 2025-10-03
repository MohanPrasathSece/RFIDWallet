const router = require('express').Router();
const { auth, requireRoles } = require('../middleware/auth');
const { generateAndSendStudentMonth, sendReportsForMonth, monthRange } = require('../services/reports');

// All routes here require admin
router.use(auth(), requireRoles('admin'));

// POST /api/reports/student-month
// Body: { studentId, year, month, includeReceipts?: boolean, email?: boolean }
// Returns: application/pdf if email=false, otherwise { ok: true, sent: boolean }
router.post('/student-month', async (req, res) => {
  try {
    const { studentId, year, month, includeReceipts = true, email = false } = req.body || {};
    if (!studentId || !year || !month) return res.status(400).json({ message: 'studentId, year, and month (1-12) are required' });
    const { buffer, label } = await generateAndSendStudentMonth(studentId, Number(year), Number(month), { includeReceipts, sendEmail: !!email });
    if (email) return res.json({ ok: true, month: label });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Wallet_Report_${label.replace(/\s+/g, '_')}.pdf"`);
    return res.send(buffer);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// POST /api/reports/month-run
// Body: { year, month, includeReceipts?: boolean }
// Triggers sending all student reports for the given month
router.post('/month-run', async (req, res) => {
  try {
    const { year, month, includeReceipts = true } = req.body || {};
    if (!year || !month) return res.status(400).json({ message: 'year and month (1-12) are required' });
    const out = await sendReportsForMonth(Number(year), Number(month), { includeReceipts });
    return res.json({ ok: true, ...out });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;
