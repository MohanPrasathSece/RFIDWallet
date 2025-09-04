require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  try {
    const id = process.env.ADMIN_ID || process.env.ADMIN_OBJECT_ID;
    const email = (process.env.ADMIN_EMAIL || '').trim();
    const name = (process.env.ADMIN_NAME || 'Administrator').trim();
    const rawPassword = process.env.ADMIN_PASSWORD; // optional
    const passwordHashEnv = process.env.ADMIN_PASSWORD_HASH; // optional

    if (!id) {
      console.error('Missing ADMIN_ID (or ADMIN_OBJECT_ID) in environment.');
      process.exit(1);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error('ADMIN_ID is not a valid Mongo ObjectId:', id);
      process.exit(1);
    }
    if (!email) {
      console.error('Missing ADMIN_EMAIL in environment.');
      process.exit(1);
    }

    // Determine password hash source
    let passwordHash;
    if (passwordHashEnv) {
      passwordHash = passwordHashEnv;
    } else if (rawPassword) {
      passwordHash = await bcrypt.hash(rawPassword, 10);
    } else {
      console.error('Provide either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in environment.');
      process.exit(1);
    }

    await connectDB();

    const update = {
      name,
      email,
      role: 'admin',
      passwordHash,
    };

    const _id = new mongoose.Types.ObjectId(id);

    const result = await User.findOneAndUpdate(
      { _id },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`Upserted admin with _id=${result._id.toString()} email=${result.email}`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to upsert admin by id:', e.message);
    process.exit(1);
  }
})();
