const router = require('express').Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { auth, requireRoles } = require('../middleware/auth');

router.get('/quick', async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0);
  const [users, today, pending] = await Promise.all([
    User.countDocuments(),
    Transaction.countDocuments({ createdAt: { $gte: startOfDay } }),
    Transaction.countDocuments({ status: 'pending' })
  ]);
  // Placeholder notifications
  const notifications = 0;
  res.json({ users, today, pending, notifications });
});

router.get('/usage', auth(), requireRoles('admin', 'staff'), async (req, res) => {
  // Simple last 7 days counts per day
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 6);
  from.setHours(0,0,0,0);

  const data = await Transaction.aggregate([
    { $match: { createdAt: { $gte: from } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  res.json({ range: 'last7', points: data });
});

module.exports = router;
