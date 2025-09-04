require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Administrator';

    if (!email || !password) {
      console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment.');
      process.exit(1);
    }

    await connectDB();

    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Admin already exists: ${email}`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ name, email, passwordHash, role: 'admin' });
    console.log(`Seeded admin: ${email}`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to seed admin:', e.message);
    process.exit(1);
  }
})();
