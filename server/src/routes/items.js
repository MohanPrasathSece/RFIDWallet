const router = require('express').Router();
const Item = require('../models/Item');
const { auth, requireRoles } = require('../middleware/auth');
// Notifications disabled: no imports

// Create item (public for local use)
router.post('/', async (req, res) => {
  try {
    const item = await Item.create(req.body);
    // Notifications disabled
    return res.status(201).json(item);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// List items, optional ?type=library|food|store & search by name
router.get('/', auth(false), async (req, res) => {
  const { type, q } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (q) filter.name = { $regex: q, $options: 'i' };
  const items = await Item.find(filter).sort({ createdAt: -1 });
  return res.json(items);
});

// Read one
router.get('/:id', auth(false), async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  return res.json(item);
});

// Update
router.put('/:id', auth(), requireRoles('admin'), async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    // Notifications disabled
    return res.json(item);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Delete
router.delete('/:id', auth(), requireRoles('admin'), async (req, res) => {
  const item = await Item.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  return res.json({ ok: true });
});

module.exports = router;
