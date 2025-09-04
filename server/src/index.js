require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const { initTelegram } = require('./services/telegram');
const Item = require('./models/Item');

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
const Student = require('./models/Student');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

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
  } catch (e) {
    console.warn('Food seed skipped:', e.message);
  }
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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

// Initialize Telegram bot integration (webhook or polling)
initTelegram(app, io);

// TODO: add routes for library, food, store, admin, rfid, items, transactions

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
