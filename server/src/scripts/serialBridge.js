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

const SERVER_BASE = process.env.SERVER_BASE || 'http://localhost:3000';
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || '';
const PORT_PATH = process.env.SERIAL_PORT || '';
const BAUD = Number(process.env.SERIAL_BAUD || 115200);
const MODULE = process.env.MODULE || 'store';
const LOCATION = process.env.LOCATION || 'POS-1';

if (!DEVICE_API_KEY) {
  console.error('[serialBridge] Missing DEVICE_API_KEY in environment.');
  process.exit(1);
}
if (!PORT_PATH) {
  console.error('[serialBridge] Missing SERIAL_PORT in environment (e.g., COM5).');
  process.exit(1);
}

console.log('[serialBridge] Starting bridge with config:', {
  SERVER_BASE,
  PORT_PATH,
  BAUD,
  MODULE,
  LOCATION,
});

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
  const parser = port.pipe(new ReadlineParser({ delimiter: /\r?\n/ }));

  port.on('error', (e) => console.error('[serialBridge] Serial error:', e.message));
  port.on('close', () => console.warn('[serialBridge] Serial closed. Reconnecting in 3s...'));

  parser.on('data', async (line) => {
    const uid = parseUid(line);
    if (!uid) return;

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
    port.open((err) => {
      if (err) {
        console.error('[serialBridge] Open failed:', err.message);
        setTimeout(open, 3000);
        return;
      }
      console.log('[serialBridge] Serial open on', PORT_PATH, 'baud', BAUD);
    });
  }

  open();
}

start();
