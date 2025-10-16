import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { FiBook, FiCoffee, FiShoppingCart, FiSettings } from 'react-icons/fi';
import { api } from './api.js';
import BrandLogo from '../components/BrandLogo.jsx';
import { useAuth } from './AuthContext.jsx';
import ThemeToggle from './ui/ThemeToggle.jsx';

const links = [
  { to: '/library', label: 'Library', icon: <FiBook size={18} /> },
  { to: '/food', label: 'Food Court', icon: <FiCoffee size={18} /> },
  { to: '/store', label: 'Store', icon: <FiShoppingCart size={18} /> },
  { to: '/admin', label: 'Admin', icon: <FiSettings size={18} /> },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth() || {};
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialStatus, setSerialStatus] = useState('Not connected');
  const [serialPort, setSerialPort] = useState(null);
  const [reader, setReader] = useState(null);
  const reconnectingRef = useRef(false);
  const socketRef = useRef(null);

  // Socket available globally for logging/broadcast
  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || (window.location.origin.replace(/\/$/, ''));
    const socket = io(url, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    try { window.socket = socket; } catch {}
    return () => { try { socket.disconnect(); } catch {} };
  }, []);

  const connectESP32 = async () => {
    if (!('serial' in navigator)) {
      setSerialStatus('Web Serial not supported');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'unsupported' }); } catch {}
      return;
    }
    try {
      try { socketRef.current?.emit('esp32:web-serial', { event: 'request-port' }); } catch {}
      const port = await navigator.serial.requestPort();
      setSerialStatus('Opening (115200)...');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'opening', extra: { baudRate: 115200 } }); } catch {}
      await openSelectedPort(port);
    } catch (err) {
      setSerialStatus('Connect failed');
      setSerialConnected(false);
      try { socketRef.current?.emit('esp32:web-serial', { event: 'connect-failed', message: err.message }); } catch {}
    }
  };

  // Helper to open a granted port and start streaming; used for manual connect and auto-reconnect
  const openSelectedPort = async (port) => {
    try {
      await port.open({ baudRate: 115200 });
    } catch (e) {
      // If already open, ignore InvalidStateError
      const msg = String(e?.message || '');
      if (!/InvalidStateError|already open/i.test(msg)) throw e;
    }
    setSerialPort(port);
    setSerialConnected(true);
    setSerialStatus('Connected');
    try { socketRef.current?.emit('esp32:web-serial', { event: 'connected' }); } catch {}

    const textDecoder = new TextDecoderStream();
    port.readable?.pipeTo(textDecoder.writable).catch(() => {});
    const r = textDecoder.readable.getReader();
    setReader(r);
    let buffer = '';
    (async () => {
      try {
        while (true) {
          const { value, done } = await r.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const raw of lines) {
            const line = String(raw).trim();
            if (!line) continue;
            // Filter boot noise
            if (line.includes('clk_drv') || line.includes('load:') || line.includes('entry') || line.includes('esp_image') || line.includes('boot:') || line.includes('ets ') || line.includes('rst:') || line.includes('configsip') || line.includes('mode:DIO')) {
              continue;
            }
            try { socketRef.current?.emit('esp32:web-serial', { event: 'data', message: line }); } catch {}
            if (line === 'ESP32_BOOT_OK') {
              setSerialStatus('ESP32 booted');
            } else if (line === 'RFID_READY') {
              setSerialStatus('RFID ready');
            } else if (line === 'RC522_ERROR') {
              setSerialStatus('RC522 error');
            }
            // Prefer RFID:<UID>; fallback to "Card UID: xx xx ..."
            let uid = null;
            if (line.startsWith('RFID:')) {
              uid = line.substring(5).trim();
            } else if (/^Card UID:/i.test(line)) {
              const hex = (line.match(/([0-9A-Fa-f]{2}\s+){3,}\b/) || [])[0] || '';
              if (hex) uid = hex.replace(/\s+/g, '').toUpperCase();
            }
            if (uid) {
              try {
                // Fetch full student to fill all fields across modules
                const { data } = await api.get('/students/find', { params: { rfid_uid: uid } });
                if (data && data._id) {
                  // Include rollNo and rfid in payload explicitly for convenience
                  const payload = {
                    uid,
                    student: data,
                    rollNo: data.rollNo,
                    rfid: data.RFIDNumber || data.rfid_uid || uid,
                    name: data.name,
                    walletBalance: data.walletBalance,
                    department: data.department,
                    source: 'sidebar'
                  };
                  try { socketRef.current?.emit('ui:rfid-scan', payload); } catch {}
                  // Cache last student globally for pages to restore state after actions/nav
                  try { localStorage.setItem('last_student', JSON.stringify(payload)); } catch {}
                } else {
                  try { socketRef.current?.emit('ui:rfid-scan', { uid, source: 'sidebar' }); } catch {}
                }
              } catch (_) {
                try { socketRef.current?.emit('ui:rfid-scan', { uid, source: 'sidebar' }); } catch {}
              }
            }
          }
        }
      } catch (e) {
        setSerialStatus('Read error, retrying…');
        try { socketRef.current?.emit('esp32:web-serial', { event: 'read-error', message: e.message }); } catch {}
        // Attempt auto-reconnect if permission persists
        if (!reconnectingRef.current) {
          reconnectingRef.current = true;
          setTimeout(async () => {
            try { await openSelectedPort(port); } catch { setSerialStatus('Reconnect failed'); }
            reconnectingRef.current = false;
          }, 1200);
        }
      }
    })();
  };

  const disconnectESP32 = async () => {
    try {
      if (reader) { await reader.cancel(); setReader(null); }
      if (serialPort) { await serialPort.close(); setSerialPort(null); }
      setSerialConnected(false);
      setSerialStatus('Disconnected');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'disconnected' }); } catch {}
    } catch (err) {
      try { socketRef.current?.emit('esp32:web-serial', { event: 'disconnect-error', message: err.message }); } catch {}
    }
  };

  // Auto-reconnect if permission was previously granted (no prompt)
  useEffect(() => {
    if (!('serial' in navigator)) return;
    let mounted = true;
    (async () => {
      try {
        const ports = await navigator.serial.getPorts();
        if (mounted && !serialConnected && ports && ports.length > 0) {
          setSerialStatus('Reconnecting…');
          try { await openSelectedPort(ports[0]); } catch (e) { setSerialStatus('Reconnect failed'); }
        }
      } catch {}
    })();
    // Listen to OS-level connect/disconnect events
    const onConnect = async (e) => {
      try { if (!serialConnected) await openSelectedPort(e.port); } catch {}
    };
    const onDisconnect = () => {
      setSerialConnected(false);
      setSerialStatus('Disconnected');
    };
    try { navigator.serial.addEventListener('connect', onConnect); } catch {}
    try { navigator.serial.addEventListener('disconnect', onDisconnect); } catch {}
    return () => {
      try { navigator.serial.removeEventListener('connect', onConnect); } catch {}
      try { navigator.serial.removeEventListener('disconnect', onDisconnect); } catch {}
    };
  }, [serialConnected]);

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex flex-col min-h-screen p-4 border-r border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <BrandLogo size={38} />
          <div className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-200">CamCards</div>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex-grow space-y-2">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              pathname === l.to
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
            }`}>
            <span className="w-6 text-center">{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      {pathname.startsWith('/admin') && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full ${serialConnected ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
              {serialStatus}
            </span>
            {!serialConnected ? (
              <button
                onClick={connectESP32}
                title="Connect ESP32"
                className="px-4 py-1.5 text-xs font-semibold bg-gray-800 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500 text-white rounded-lg shadow-md transition-colors">
                Connect
              </button>
            ) : (
              <button
                onClick={disconnectESP32}
                title="Disconnect ESP32"
                className="px-4 py-1.5 text-xs font-semibold bg-gray-800 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500 text-white rounded-lg shadow-md transition-colors">
                Disconnect
              </button>
            )}
          </div>
          <button
            onClick={() => { try { logout?.(); } catch {} navigate('/'); }}
            className="mt-4 w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}
