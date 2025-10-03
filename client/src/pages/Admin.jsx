import Sidebar from '../shared/Sidebar.jsx';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';

export default function Admin() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' });
  const [walletInputs, setWalletInputs] = useState({});
  const [rfidReader, setRfidReader] = useState(null);
  // Web Serial state for inline ESP32 connect
  const [serialPort, setSerialPort] = useState(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialStatus, setSerialStatus] = useState('Not connected');
  const socketRef = useRef(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const loadStudents = async () => {
    try {
      const res = await api.get('/admin/students');
      setStudents(res.data || []);
    } catch (_) {}
  };

  useEffect(() => { loadStudents(); }, []);

  // Setup Socket.IO for server logging
  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || (window.location.origin.replace(/\/$/, ''));
    const socket = io(url, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    // Listen for RFID scans from global connector and auto-fill form
    const onScan = (payload) => {
      try {
        const uid = payload?.uid || payload?.rfid || payload?.RFIDNumber;
        const s = payload?.student;
        if (uid) {
          setForm(v => ({ ...v, RFIDNumber: uid }));
        }
        if (s?._id) {
          setForm(v => ({
            ...v,
            name: s.name || v.name,
            rollNo: s.rollNo || v.rollNo,
            RFIDNumber: s.RFIDNumber || s.rfid_uid || uid || v.RFIDNumber,
            department: s.department || v.department,
            email: s.email || v.email,
          }));
        }
      } catch (_) {}
    };
    socket.on('esp32:rfid-scan', onScan);
    return () => { try { socket.disconnect(); } catch {} };
  }, []);

  const deposit = async (id) => {
    try {
      setError('');
      const amt = Number(walletInputs[id] || 0);
      if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
      await api.post('/admin/wallet/deposit', { studentId: id, amount: amt });
      await loadStudents();
      setWalletInputs(v => ({ ...v, [id]: '' }));
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to deposit');
    }
  };

  const withdraw = async (id) => {
    try {
      setError('');
      const amt = Number(walletInputs[id] || 0);
      if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
      await api.post('/admin/wallet/withdraw', { studentId: id, amount: amt });
      await loadStudents();
      setWalletInputs(v => ({ ...v, [id]: '' }));
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to withdraw');
    }
  };

  const addStudent = async () => {
    try {
      setError(''); setSaving(true);
      const required = ['name', 'rollNo', 'email', 'password', 'RFIDNumber'];
      for (const field of required) {
        if (!form[field]) {
          setError(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
          return;
        }
      }
      await api.post('/admin/students', form);
      setForm({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' });
      await loadStudents();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to add student');
    } finally { setSaving(false); }
  };

  const connectESP32 = async () => {
    if (!('serial' in navigator)) {
      setError('Web Serial API not supported in this browser. Use Chrome/Edge.');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'unsupported' }); } catch {}
      return;
    }
    try {
      try { socketRef.current?.emit('esp32:web-serial', { event: 'request-port' }); } catch {}
      const port = await navigator.serial.requestPort();
      setSerialStatus('Opening serial (115200)...');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'opening', extra: { baudRate: 115200 } }); } catch {}
      await port.open({ baudRate: 115200 });

      setSerialPort(port);
      setSerialConnected(true);
      setSerialStatus('✅ Connected');
      setError('');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'connected' }); } catch {}

      // TextDecoder stream for line-buffered reads
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      setRfidReader(reader);

      let buffer = '';
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const raw of lines) {
              const line = raw.trim();
              if (!line) continue;
              // Filter common boot noise
              if (line.includes('clk_drv') || line.includes('load:') || line.includes('entry') || line.includes('esp_image') || line.includes('boot:') || line.includes('ets ') || line.includes('rst:') || line.includes('configsip') || line.includes('mode:DIO')) {
                continue;
              }
              try { socketRef.current?.emit('esp32:web-serial', { event: 'data', message: line }); } catch {}
              if (line === 'ESP32_BOOT_OK') {
                setSerialStatus('ESP32 booted');
                try { socketRef.current?.emit('esp32:web-serial', { event: 'boot-ok' }); } catch {}
              } else if (line === 'RFID_READY') {
                setSerialStatus('RFID ready');
                try { socketRef.current?.emit('esp32:web-serial', { event: 'rfid-ready' }); } catch {}
              } else if (line === 'RC522_ERROR') {
                setSerialStatus('RC522 error - check wiring');
                try { socketRef.current?.emit('esp32:web-serial', { event: 'rc522-error' }); } catch {}
              } else if (line.startsWith('RFID:')) {
                const uid = line.substring(5);
                setForm(v => ({ ...v, RFIDNumber: uid }));
                try { socketRef.current?.emit('esp32:web-serial', { event: 'rfid-scan', extra: { uid } }); } catch {}
                // Resolve student and broadcast to all dashboards
                try {
                  const { data } = await api.get(`/rfid/resolve/${uid}`);
                  if (data) {
                    // Update local form context
                    setForm(v => ({ ...v, RFIDNumber: data.RFIDNumber || data.rfid_uid || uid }));
                    // Broadcast so other dashboards can auto-fill
                    try { socketRef.current?.emit('ui:rfid-scan', { uid, student: data, source: 'admin' }); } catch {}
                  } else {
                    // Broadcast UID alone if no student found
                    try { socketRef.current?.emit('ui:rfid-scan', { uid, source: 'admin' }); } catch {}
                  }
                } catch (_) {
                  try { socketRef.current?.emit('ui:rfid-scan', { uid, source: 'admin' }); } catch {}
                }
              } else if (/\bCard UID\b/i.test(line)) {
                // Fallback: extract hex from "Card UID: xx xx ..."
                const hex = (line.match(/([0-9A-Fa-f]{2}\s+){3,}\b/) || [])[0] || '';
                if (hex) {
                  const uid = hex.replace(/\s+/g, '').toUpperCase();
                  setForm(v => ({ ...v, RFIDNumber: uid }));
                  try { socketRef.current?.emit('esp32:web-serial', { event: 'rfid-scan', extra: { uid } }); } catch {}
                  // Resolve and broadcast
                  try {
                    const { data } = await api.get(`/rfid/resolve/${uid}`);
                    if (data) {
                      setForm(v => ({ ...v, RFIDNumber: data.RFIDNumber || data.rfid_uid || uid }));
                      try { socketRef.current?.emit('ui:rfid-scan', { uid, student: data, source: 'admin' }); } catch {}
                    } else {
                      try { socketRef.current?.emit('ui:rfid-scan', { uid, source: 'admin' }); } catch {}
                    }
                  } catch (_) {
                    try { socketRef.current?.emit('ui:rfid-scan', { uid, source: 'admin' }); } catch {}
                  }
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
      setError(`Serial connect error: ${err.message}`);
      try { socketRef.current?.emit('esp32:web-serial', { event: 'connect-failed', message: err.message }); } catch {}
    }
  };

  const disconnectESP32 = async () => {
    try {
      if (rfidReader) { await rfidReader.cancel(); setRfidReader(null); }
      if (serialPort) { await serialPort.close(); setSerialPort(null); }
      setSerialConnected(false);
      setSerialStatus('Disconnected');
      try { socketRef.current?.emit('esp32:web-serial', { event: 'disconnected' }); } catch {}
    } catch (err) {
      setError(`Disconnect error: ${err.message}`);
      try { socketRef.current?.emit('esp32:web-serial', { event: 'disconnect-error', message: err.message }); } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-0">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between px-6 py-3 bg-white border-b">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden md:block">{user?.name || 'Admin'}</span>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
            >Logout</button>
          </div>
        </div>
        {/* Page content */}
        <div className="p-6 space-y-6">
          <h2 className="text-2xl font-semibold">Admin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Add Student (by RFID)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Roll No" value={form.rollNo} onChange={e => setForm(v => ({ ...v, rollNo: e.target.value }))} />
                <input type="email" className="border rounded px-3 py-2" placeholder="Email ID" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Mobile Number" value={form.mobileNumber} onChange={e => setForm(v => ({ ...v, mobileNumber: e.target.value }))} />
                <input type="password" className="border rounded px-3 py-2" placeholder="New Password" value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Department" value={form.department} onChange={e => setForm(v => ({ ...v, department: e.target.value }))} />
                <div className="flex items-center gap-2">
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="RFID Number"
                    value={form.RFIDNumber}
                    onChange={e => setForm(v => ({ ...v, RFIDNumber: e.target.value }))}
                  />
                </div>
              </div>
              {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
              <div className="mt-3">
                <button disabled={saving} onClick={addStudent} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-60">{saving ? 'Saving...' : 'Add Student'}</button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Students</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700">{students.length}</span>
                </div>
                <button
                  onClick={() => navigate('/admin/students')}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-sm"
                >
                  Open
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">Latest added students:</p>
              <div className="mt-3 max-h-48 overflow-auto divide-y">
                {students.slice(0, 8).map(s => (
                  <button
                    key={s._id}
                    onClick={() => navigate('/admin/students')}
                    className="w-full text-left px-2 py-2 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-xs font-semibold">
                          {(s.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.rollNo || s.rfid_uid || '—'}</div>
                        </div>
                      </div>
                      <span className="text-xs text-blue-600">View</span>
                    </div>
                  </button>
                ))}
                {students.length === 0 && (
                  <div className="px-2 py-3 text-sm text-gray-500">No students yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
