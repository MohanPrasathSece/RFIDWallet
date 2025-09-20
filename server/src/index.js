const path = require('path');
const fs = require('fs');

// Robustly find and load .env from server/ or project root
const serverEnvPath = path.resolve(__dirname, '../.env');
const rootEnvPath = path.resolve(__dirname, '../../.env');

let envPath;
if (fs.existsSync(serverEnvPath)) {
  envPath = serverEnvPath;
} else if (fs.existsSync(rootEnvPath)) {
  envPath = rootEnvPath;
}

if (envPath) {
  console.log(`Loading environment variables from: ${envPath}`);
  // Ensure .env values override any pre-existing env vars (e.g., OS-level)
  require('dotenv').config({ path: envPath, override: true });
} else {
  console.warn('Warning: No .env file found in server/ or project root. Application may not be configured correctly.');
}
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const { initTelegram } = require('./services/telegram');
const Item = require('./models/Item');
const Student = require('./models/Student');
const { runLibraryDueReminders } = require('./services/library');
const { sendReportsForMonth } = require('./services/reports');
const moment = require('moment-timezone');
const ESP32SerialService = require('./services/esp32Serial');
const ESP32Uploader = require('./services/esp32Uploader');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const txRoutes = require('./routes/transactions');
const rfidRoutes = require('./routes/rfid');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const libraryRoutes = require('./routes/library');
const foodRoutes = require('./routes/food');
const storeRoutes = require('./routes/store');
const { router: walletRoutes, webhookHandler } = require('./routes/wallet');
const studentRoutes = require('./routes/students');
const reportsRoutes = require('./routes/reports');
const esp32Routes = require('./routes/esp32');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Startup config checks (non-fatal warnings)
(() => {
  const rawId = process.env.RAZORPAY_KEY_ID || '';
  const rawSecret = process.env.RAZORPAY_KEY_SECRET || '';
  const webhook = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  const id = rawId.trim();
  const secret = rawSecret.trim();

  const hasWhitespaceId = rawId !== id;
  const hasWhitespaceSecret = rawSecret !== secret;
  const quotedId = /^['"].*['"]$/.test(rawId);
  const quotedSecret = /^['"].*['"]$/.test(rawSecret);

  if (!id || !secret) {
    console.warn('[Razorpay] Warning: RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not set. Wallet top-ups will be disabled until configured.');
  }
  if (!webhook) {
    console.warn('[Razorpay] Warning: RAZORPAY_WEBHOOK_SECRET not set. Payment confirmations will not be verified.');
  }
  if (id && secret) {
    const kind = id.startsWith('rzp_test_') ? 'TEST' : (id.startsWith('rzp_live_') ? 'LIVE' : 'UNKNOWN');
    const mask = id.length > 8 ? `${id.slice(0, 8)}…${id.slice(-2)}` : '****';
    console.log(`[Razorpay] Keys loaded (${kind}). key_id: ${mask}`);
    if (hasWhitespaceId || hasWhitespaceSecret || quotedId || quotedSecret) {
      console.warn('[Razorpay] Notice: Detected potential formatting issues in .env values', {
        hasWhitespaceId,
        hasWhitespaceSecret,
        quotedId,
        quotedSecret,
      });
    }
  }
})();

// Simple Socket.IO hookup
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected', socket.id));
});
app.set('io', io);

// Middleware
const allowedOrigin = process.env.CLIENT_URL || '*';
app.use(cors({ origin: allowedOrigin, credentials: true }));
// Razorpay webhook needs raw body to verify signature
app.post('/api/wallet/webhook', express.raw({ type: '*/*' }), webhookHandler);
app.use(express.json());
app.use(cookieParser());

// DB
connectDB();

// Seed default food items only after mongoose connects
mongoose.connection.once('connected', async () => {
  try {
    // Attempt to drop legacy non-sparse index causing E11000 on nulls
    try {
      const indexes = await mongoose.connection.db.collection('students').indexes();
      const hasLegacy = indexes.some(ix => ix.name === 'RFIDNumber_1');
      if (hasLegacy) {
        await mongoose.connection.db.collection('students').dropIndex('RFIDNumber_1');
        console.log('Dropped legacy index RFIDNumber_1');
      }
    } catch (e) {
      console.warn('Index cleanup skipped:', e.message);
    }

    // Ensure indexes match the schema (adds sparse unique on legacy RFIDNumber)
    try {
      await Student.syncIndexes();
      console.log('Student indexes synced');
    } catch (e) {
      console.warn('Student syncIndexes failed:', e.message);
    }

    const count = await Item.countDocuments({ type: 'food' });
    if (count === 0) {
      const defaults = [
        { type: 'food', name: 'Veg Sandwich', price: 40, quantity: 100 },
        { type: 'food', name: 'Chicken Sandwich', price: 60, quantity: 100 },
        { type: 'food', name: 'Veg Burger', price: 70, quantity: 80 },
        { type: 'food', name: 'Chicken Burger', price: 90, quantity: 80 },
        { type: 'food', name: 'Samosa', price: 15, quantity: 200 },
        { type: 'food', name: 'Masala Dosa', price: 50, quantity: 60 },
        { type: 'food', name: 'Idli (2 pcs)', price: 25, quantity: 120 },
        { type: 'food', name: 'Tea', price: 10, quantity: 300 },
        { type: 'food', name: 'Coffee', price: 20, quantity: 300 },
        { type: 'food', name: 'Fruit Juice', price: 35, quantity: 100 },
      ];
      await Item.insertMany(defaults);
      console.log('Seeded default food items');
    }

    // Seed 20 best books into library if empty
    try {
      const libCount = await Item.countDocuments({ type: 'library' });
      if (libCount === 0) {
        const libraryDefaults = [
          { type: 'library', name: 'To Kill a Mockingbird', author: 'Harper Lee', year: 1960, topics: ['Fiction', 'Classic'], quantity: 8 },
          { type: 'library', name: '1984', author: 'George Orwell', year: 1949, topics: ['Dystopia', 'Politics'], quantity: 8 },
          { type: 'library', name: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, topics: ['Classic'], quantity: 6 },
          { type: 'library', name: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, topics: ['Romance', 'Classic'], quantity: 6 },
          { type: 'library', name: 'The Catcher in the Rye', author: 'J.D. Salinger', year: 1951, topics: ['Fiction'], quantity: 6 },
          { type: 'library', name: 'The Hobbit', author: 'J.R.R. Tolkien', year: 1937, topics: ['Fantasy'], quantity: 6 },
          { type: 'library', name: 'Fahrenheit 451', author: 'Ray Bradbury', year: 1953, topics: ['Dystopia'], quantity: 6 },
          { type: 'library', name: 'Jane Eyre', author: 'Charlotte Brontë', year: 1847, topics: ['Gothic', 'Classic'], quantity: 5 },
          { type: 'library', name: 'Brave New World', author: 'Aldous Huxley', year: 1932, topics: ['Dystopia'], quantity: 5 },
          { type: 'library', name: 'The Alchemist', author: 'Paulo Coelho', year: 1988, topics: ['Philosophy', 'Fiction'], quantity: 8 },
          { type: 'library', name: 'Sapiens', author: 'Yuval Noah Harari', year: 2011, topics: ['History', 'Anthropology'], quantity: 5 },
          { type: 'library', name: 'Atomic Habits', author: 'James Clear', year: 2018, topics: ['Self-help', 'Productivity'], quantity: 10 },
          { type: 'library', name: 'Deep Work', author: 'Cal Newport', year: 2016, topics: ['Productivity'], quantity: 6 },
          { type: 'library', name: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', year: 2011, topics: ['Psychology'], quantity: 6 },
          { type: 'library', name: 'The Pragmatic Programmer', author: 'Andrew Hunt, David Thomas', year: 1999, topics: ['Software'], quantity: 6 },
          { type: 'library', name: 'Clean Code', author: 'Robert C. Martin', year: 2008, topics: ['Software'], quantity: 6 },
          { type: 'library', name: 'Introduction to Algorithms', author: 'Cormen et al.', year: 2009, topics: ['CS', 'Algorithms'], quantity: 4 },
          { type: 'library', name: 'The Art of Computer Programming', author: 'Donald Knuth', year: 1968, topics: ['CS'], quantity: 3 },
          { type: 'library', name: 'Cracking the Coding Interview', author: 'Gayle Laakmann McDowell', year: 2015, topics: ['Interviews', 'CS'], quantity: 6 },
          { type: 'library', name: 'The Lean Startup', author: 'Eric Ries', year: 2011, topics: ['Business', 'Startups'], quantity: 6 },
        ];
        await Item.insertMany(libraryDefaults);
        console.log('Seeded default library books (20)');
      }
    } catch (e) {
      console.warn('Library seed skipped:', e.message);
    }

    // Seed basic supermarket items for store if empty
    try {
      const storeCount = await Item.countDocuments({ type: 'store' });
      if (storeCount === 0) {
        const storeDefaults = [
          { type: 'store', name: 'Notebook (200 pages)', price: 60, quantity: 120 },
          { type: 'store', name: 'Ball Pen (Blue)', price: 10, quantity: 500 },
          { type: 'store', name: 'Ball Pen (Black)', price: 10, quantity: 400 },
          { type: 'store', name: 'Pencil HB', price: 8, quantity: 300 },
          { type: 'store', name: 'Eraser', price: 5, quantity: 250 },
          { type: 'store', name: 'Sharpener', price: 7, quantity: 200 },
          { type: 'store', name: 'Highlighter', price: 25, quantity: 150 },
          { type: 'store', name: 'A4 Paper (100 sheets)', price: 120, quantity: 80 },
          { type: 'store', name: 'Ruler 30cm', price: 15, quantity: 180 },
          { type: 'store', name: 'Glue Stick', price: 20, quantity: 140 },
          { type: 'store', name: 'Stapler', price: 90, quantity: 60 },
          { type: 'store', name: 'Staples (Box)', price: 30, quantity: 100 },
          { type: 'store', name: 'Calculator (Scientific)', price: 650, quantity: 25 },
          { type: 'store', name: 'USB Drive 32GB', price: 450, quantity: 40 },
          { type: 'store', name: 'Water Bottle 1L', price: 120, quantity: 70 },
          { type: 'store', name: 'Instant Noodles', price: 30, quantity: 200 },
          { type: 'store', name: 'Chocolate Bar', price: 25, quantity: 180 },
          { type: 'store', name: 'Biscuits Pack', price: 20, quantity: 220 },
          { type: 'store', name: 'Biscuit Cream Pack', price: 25, quantity: 200 },
          { type: 'store', name: 'Chips Packet', price: 20, quantity: 220 },
        ];
        await Item.insertMany(storeDefaults);
        console.log('Seeded default store items');
      }
    } catch (e) {
      console.warn('Store seed skipped:', e.message);
    }
  } catch (e) {
    console.warn('Food seed skipped:', e.message);
  }
  // Start periodic library due reminders (runs every hour)
  try {
    setInterval(() => {
      runLibraryDueReminders().catch(() => {});
    }, 60 * 60 * 1000);
    // Kick off once on startup (non-blocking)
    setTimeout(() => { runLibraryDueReminders().catch(() => {}); }, 10_000);
  } catch (_) {}

  // Monthly reports scheduler: 1st of month at 08:00 IST for previous month
  try {
    let lastReportRunKey = null; // e.g., '2025-09'
    setInterval(async () => {
      const now = moment.tz('Asia/Kolkata');
      const day = now.date();
      const hour = now.hour();
      if (day !== 1 || hour !== 8) return;
      const prev = now.clone().subtract(1, 'month');
      const key = prev.format('YYYY-MM');
      if (lastReportRunKey === key) return; // already sent this month
      lastReportRunKey = key;
      try {
        const yr = Number(prev.format('YYYY'));
        const mo = Number(prev.format('M'));
        const out = await sendReportsForMonth(yr, mo, { includeReceipts: true });
        console.log(`[Reports] Sent monthly reports for ${key}:`, out);
      } catch (e) {
        console.error('[Reports] Monthly send failed:', e.message);
      }
    }, 15 * 60 * 1000); // check every 15 minutes
  } catch (_) {}
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const webhookConfigured = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
  
  // Enhanced diagnostics
  const rawId = process.env.RAZORPAY_KEY_ID || '';
  const rawSecret = process.env.RAZORPAY_KEY_SECRET || '';
  const keyId = rawId.trim();
  const keySecret = rawSecret.trim();
  
  const diagnostics = {
    razorpayKeyId: keyId ? `${keyId.slice(0, 8)}...${keyId.slice(-2)}` : 'not set',
    razorpayKeySecret: keySecret ? `${keySecret.slice(0, 3)}...${keySecret.slice(-3)}` : 'not set',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ? 'configured' : 'not set',
    mode: keyId.includes('_test_') ? 'TEST' : keyId.includes('_live_') ? 'LIVE' : 'UNKNOWN',
    hasWhitespaceId: rawId !== keyId,
    hasWhitespaceSecret: rawSecret !== keySecret,
    quotedId: (rawId.startsWith('"') && rawId.endsWith('"')) || (rawId.startsWith("'") && rawId.endsWith("'")),
    quotedSecret: (rawSecret.startsWith('"') && rawSecret.endsWith('"')) || (rawSecret.startsWith("'") && rawSecret.endsWith("'")),
    envPath: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    // Show full key for debugging (remove after fixing)
    fullKeyId: process.env.RAZORPAY_KEY_ID,
    fullKeySecret: process.env.RAZORPAY_KEY_SECRET,
  };

  res.json({
    status: 'ok',
    razorpayConfigured,
    webhookConfigured,
    mode: diagnostics.mode,
    keyIdMasked: diagnostics.razorpayKeyId,
    diagnostics,
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/transactions', txRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/esp32', esp32Routes);

// Initialize Telegram bot integration (webhook or polling)
initTelegram(app, io);

// Initialize ESP32 Auto-Upload and Serial Service
let esp32Service = null;
if (process.env.ENABLE_ESP32_SERIAL !== 'false') {
  esp32Service = new ESP32SerialService({
    portPath: process.env.SERIAL_PORT || 'COM5',
    baudRate: parseInt(process.env.SERIAL_BAUD || '115200'),
    serverUrl: `http://localhost:${process.env.PORT || 5000}`,
    deviceKey: process.env.DEVICE_API_KEY || 'dev-local-1',
    io: io
  });
  
  // Make ESP32 service available to routes
  app.set('esp32Service', esp32Service);
  
  // Auto-upload firmware on server startup
  setTimeout(async () => {
    console.log('[ESP32] 🚀 Starting ESP32 auto-upload and service initialization...');
    
    try {
      // Create uploader instance
      const uploader = new ESP32Uploader({
        portPath: process.env.SERIAL_PORT || 'COM5',
        esp32Service: esp32Service
      });
      
      // Check if auto-upload is enabled
      if (process.env.ESP32_AUTO_UPLOAD !== 'false') {
        console.log('[ESP32] 📤 Auto-uploading firmware on startup...');
        await uploader.uploadFirmware();
        console.log('[ESP32] ✅ Auto-upload completed successfully!');
      } else {
        console.log('[ESP32] ⏭️  Auto-upload disabled, connecting to existing firmware...');
        
        // Try to clean up port first
        console.log('[ESP32] 🧹 Cleaning up COM port before connection...');
        await uploader.killPortProcesses();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        esp32Service.connect().catch(() => {
          console.log('[ESP32] Initial connection failed, will retry automatically');
        });
      }
    } catch (error) {
      console.log('[ESP32] ❌ Auto-upload failed:', error.message);
      console.log('[ESP32] 🔄 Attempting to connect to existing firmware...');
      esp32Service.connect().catch(() => {
        console.log('[ESP32] Initial connection failed, will retry automatically');
      });
    }
  }, 3000);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  if (esp32Service) {
    await esp32Service.disconnect();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (esp32Service) {
    console.log('[ESP32] Serial service will attempt to connect to', process.env.SERIAL_PORT || 'COM5');
  }
});
