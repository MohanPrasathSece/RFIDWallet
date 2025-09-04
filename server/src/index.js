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
