require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment.');
      process.exit(1);
    }

    await connectDB();

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`No admin found with email: ${email}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    await user.save();
    console.log(`Admin password reset for: ${email}`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to reset admin password:', e.message);
    process.exit(1);
  }
})();
