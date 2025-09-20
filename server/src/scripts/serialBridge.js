// USB Serial -> HTTP Bridge for ESP32 RFID
// Reads lines from a serial COM port and forwards RFID UID scans to the server
// Endpoint used: POST /api/rfid/esp32-scan with header X-Device-Key

// Usage:
// 1) Ensure you have installed deps in server/: npm i serialport @serialport/parser-readline axios
// 2) Set environment variables (in server/.env):
//    SERVER_BASE=http://localhost:3000
//    DEVICE_API_KEY=your_device_key
//    SERIAL_PORT=COM5            # e.g., on Windows: COM5, on Linux: /dev/ttyUSB0, on macOS: /dev/tty.usbserial-xxxxx
//    SERIAL_BAUD=115200
//    MODULE=store                # one of: store | food | library
//    LOCATION=POS-1
// 3) Start the bridge: npm run bridge:serial
// 4) On ESP32, print a single UID per line (e.g., "Tag: 0A1B2C3D" or just "0A1B2C3D").

require('dotenv').config();
const axios = require('axios');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Normalize env vars (trim to remove accidental trailing spaces from Windows cmd `set`)
const SERVER_BASE = (process.env.SERVER_BASE || 'http://localhost:5000').trim();
const DEVICE_API_KEY = (process.env.DEVICE_API_KEY || '').trim();
let PORT_PATH = (process.env.SERIAL_PORT || '').trim();
const BAUD = Number((process.env.SERIAL_BAUD || 115200).toString().trim());
const MODULE = (process.env.MODULE || 'food').trim();
const LOCATION = (process.env.LOCATION || 'Food Court').trim();

// Windows COM10+ support: require \\ \\ . \\COM10 format in some contexts
if (/^COM(\d+)$/.test(PORT_PATH)) {
  const n = Number(RegExp.$1);
  if (n >= 10) {
    PORT_PATH = `\\\\.\\${PORT_PATH}`;
  }
}

if (!DEVICE_API_KEY) {
  console.error('[serialBridge] Missing DEVICE_API_KEY in environment.');
  process.exit(1);
}
if (!PORT_PATH) {
  console.error('[serialBridge] Missing SERIAL_PORT in environment (e.g., COM5).');
  process.exit(1);
}

console.log('[serialBridge] Starting bridge with config:', { SERVER_BASE, PORT_PATH, BAUD, MODULE, LOCATION });

function parseUid(line) {
  // Accept formats like: "Tag: 0A1B2C3D" or "0A1B2C3D" or "0a1b2c3d"
  const m = String(line).toUpperCase().match(/([0-9A-F]{8,20})/);
  return m ? m[1] : null;
}

let lastUid = '';
let lastAt = 0;
const dedupeMs = 2000;

async function postUid(uid) {
  try {
    const url = `${SERVER_BASE}/api/rfid/esp32-scan`;
    const payload = { rfidNumber: uid, module: MODULE, location: LOCATION };
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': DEVICE_API_KEY },
      timeout: 8000,
    });
    console.log('[serialBridge] POST ok', { status: res.status, uid });
  } catch (err) {
    const status = err?.response?.status;
    const msg = err?.response?.data || err?.message;
    console.error('[serialBridge] POST failed', { status, uid, msg });
  }
}

function start() {
  const port = new SerialPort({ path: PORT_PATH, baudRate: BAUD, autoOpen: false });
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  let lastDataAt = Date.now();

  port.on('open', () => {
    console.log('[serialBridge] ✅ Serial port opened successfully');
    console.log(`[serialBridge] 📡 Listening on ${PORT_PATH} at ${BAUD} baud`);
    console.log('[serialBridge] 🎯 Ready for RFID scanning at Food Court');
  });
  port.on('error', (e) => {
    console.error('[serialBridge] Serial error:', e.message);
    try { if (port.isOpen) port.close(); } catch (_) {}
    console.warn('[serialBridge] Attempting to reopen in 3s after error...');
    setTimeout(open, 3000);
  });
  port.on('close', () => {
    console.warn('[serialBridge] Serial closed. Reconnecting in 3s...');
    setTimeout(open, 3000);
  });

  parser.on('data', async (line) => {
    lastDataAt = Date.now();
    if (process.env.DEBUG_SERIAL === '1') {
      console.log('[serialBridge] RAW', JSON.stringify(String(line)));
    }
    const uid = parseUid(line);
    if (!uid) return;
    // Skip placeholder/no-card UIDs commonly emitted by some readers
    if (uid === 'FFFFFFFF' || uid === '00000000') return;

    const now = Date.now();
    if (uid === lastUid && now - lastAt < dedupeMs) {
      return; // ignore duplicate within window
    }
    lastUid = uid;
    lastAt = now;

    console.log('[serialBridge] UID', uid);
    await postUid(uid);
  });

  function open() {
    console.log(`[serialBridge] 🔄 Attempting to open ${PORT_PATH}...`);
    port.open((err) => {
      if (err) {
        console.error('[serialBridge] ❌ Failed to open serial port:', err.message);
        
        // Provide specific error guidance
        if (err.message.includes('Access denied') || err.message.includes('Permission denied')) {
          console.error('[serialBridge] 💡 Port is busy. Please:');
          console.error('[serialBridge]    • Close Arduino Serial Monitor');
          console.error('[serialBridge]    • Stop any other serial applications');
          console.error('[serialBridge]    • Check if ESP32 is being flashed');
        } else if (err.message.includes('No such file or directory') || err.message.includes('cannot find')) {
          console.error('[serialBridge] 💡 Port not found. Please:');
          console.error('[serialBridge]    • Check ESP32 USB connection');
          console.error('[serialBridge]    • Verify COM port in .env file');
          console.error('[serialBridge]    • Check Device Manager (Windows)');
        }
        
        console.log(`[serialBridge] 🔄 Retrying in 3 seconds...`);
        setTimeout(open, 3000);
        return;
      }
    });
  }

  // Heartbeat: report if no data seen for a while (helps detect baud mismatch)
  setInterval(() => {
    const secs = Math.floor((Date.now() - lastDataAt) / 1000);
    if (secs >= 10) {
      console.log(`[serialBridge] No data received for ${secs}s (baud=${BAUD}, port=${PORT_PATH}). Scanning...`);
    }
  }, 5000);

  open();
}

start();
