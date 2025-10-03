import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';
import BrandLogo from '../components/BrandLogo.jsx';

const links = [
  { to: '/library', label: 'Library', icon: '📚' },
  { to: '/food', label: 'Food Court', icon: '🍔' },
  { to: '/store', label: 'Store', icon: '🛍️' },
  { to: '/admin', label: 'Admin', icon: '🛠️' },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialStatus, setSerialStatus] = useState('Not connected');
  const [serialPort, setSerialPort] = useState(null);
  const [reader, setReader] = useState(null);
  const socketRef = useRef(null);

  // Socket available globally for logging/broadcast
  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || (window.location.origin.replace(/\/$/, ''));
    const socket = io(url, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
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
      await port.open({ baudRate: 115200 });
      setSerialPort(port);
      setSerialConnected(true);
      setSerialStatus('Connected');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'connected' }); } catch {}

      // Start continuous line-based reading
      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable).catch(() => {});
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
                  const { data } = await api.get(`/rfid/resolve/${uid}`);
                  if (data) {
                    try { socketRef.current?.emit('ui:rfid-scan', { uid, student: data, source: 'sidebar' }); } catch {}
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
          setSerialStatus('Read error');
          setSerialConnected(false);
          try { socketRef.current?.emit('esp32:web-serial', { event: 'read-error', message: e.message }); } catch {}
        }
      })();
    } catch (err) {
      setSerialStatus('Connect failed');
      setSerialConnected(false);
      try { socketRef.current?.emit('esp32:web-serial', { event: 'connect-failed', message: err.message }); } catch {}
    }
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

  return (
    <>
      {/* Fixed top-right connect controls (non-blocking overlay) */}
      <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 pointer-events-none select-none">
        <span className={`text-[10px] px-2 py-0.5 rounded border shadow-sm ${serialConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{serialStatus}</span>
        {!serialConnected ? (
          <button onClick={connectESP32} title="Connect ESP32" className="px-2.5 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded shadow pointer-events-auto">Connect</button>
        ) : (
          <button onClick={disconnectESP32} title="Disconnect ESP32" className="px-2.5 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white rounded shadow pointer-events-auto">Disconnect</button>
        )}
      </div>
      <aside className="w-60 bg-white border-r min-h-screen p-4">
        <div className="flex items-center gap-2 mb-6">
          <BrandLogo size={36} />
          <div className="text-lg font-bold">RFID Dashboard</div>
        </div>
        <nav className="space-y-1">
          {links.map(l => (
            <Link key={l.to} to={l.to} className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${pathname===l.to? 'bg-gray-100 font-semibold':''}`}>
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
