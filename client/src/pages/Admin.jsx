import AdminLayout from '../shared/ui/AdminLayout.jsx';
import Button from '../shared/ui/Button.jsx';
import Card from '../shared/ui/Card.jsx';
import StatCard from '../shared/ui/StatCard.jsx';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';

export default function Admin() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' });
  const [selected, setSelected] = useState(null);
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [walletInputs, setWalletInputs] = useState({});
  const [rfidReader, setRfidReader] = useState(null);
  // Web Serial state for inline ESP32 connect
  const [serialPort, setSerialPort] = useState(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialStatus, setSerialStatus] = useState('Not connected');
  const socketRef = useRef(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  // Tabs: 'add' | 'edit'
  const [activeTab, setActiveTab] = useState('add');
  // Edit tab find bar
  const [editRoll, setEditRoll] = useState('');
  const [editRfid, setEditRfid] = useState('');
  const [todaysFoodSales, setTodaysFoodSales] = useState(0);
  const [todaysStoreSales, setTodaysStoreSales] = useState(0);

  // Fetch full student from admin endpoint for freshest data
  const fetchStudentFull = async (id) => {
    try {
      if (!id) return null;
      const { data } = await api.get(`/admin/students/${id}`);
      return data || null;
    } catch (e) {
      // Non-fatal: return null and surface error softly to callers that care
      console.warn('fetchStudentFull failed', e);
      return null;
    }
  };

  // Load latest students list (for sidebar widgets and recent list)
  const loadStudents = async () => {
    try {
      const res = await api.get('/admin/students');
      setStudents(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load students');
    }
  };

  // Update selected student with current form values
  const updateStudent = async () => {
    if (!selected?._id) { setError('No student selected'); return; }
    try {
      setError('');
      setSaving(true);
      const payload = {
        name: form.name,
        rollNo: form.rollNo,
        email: form.email,
        mobileNumber: form.mobileNumber,
        RFIDNumber: form.RFIDNumber,
        department: form.department,
      };
      const { data } = await api.put(`/admin/students/${selected._id}`, payload);
      const full = data || (await fetchStudentFull(selected._id)) || selected;
      setSelected(full);
      // Refresh list silently
      try { await loadStudents(); } catch {}
      // Remember last selection
      try { localStorage.setItem('last_student', JSON.stringify({ student: full, rollNo: full.rollNo, rfid: full.rfid_uid || full.RFIDNumber })); } catch {}
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  // Reset password for selected student
  const resetStudentPassword = async () => {
    if (!selected?._id) { setError('No student selected'); return; }
    if (!newStudentPassword || newStudentPassword.length < 4) { setError('Enter a new password (min 4 chars)'); return; }
    try {
      setError('');
      setSaving(true);
      await api.post(`/admin/students/${selected._id}/reset-password`, { newPassword: newStudentPassword });
      setNewStudentPassword('');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadStudents();
    const fetchSales = async () => {
      try {
        const [foodRes, storeRes] = await Promise.all([
          api.get('/admin/sales/today?module=food'),
          api.get('/admin/sales/today?module=store'),
        ]);
        setTodaysFoodSales(foodRes.data.totalSales || 0);
        setTodaysStoreSales(storeRes.data.totalSales || 0);
      } catch (e) {
        console.error('Failed to fetch sales data', e);
      }
    };
    fetchSales();
  }, []);

  // Hydrate selection from last_student (if any)
  useEffect(() => {
    try {
      const last = localStorage.getItem('last_student');
      if (last) {
        const p = JSON.parse(last);
        if (p?.student) {
          (async () => {
            const full = await fetchStudentFull(p.student._id);
            const s = full || p.student;
            setSelected(s);
            setActiveTab('edit');
            setForm(v => ({
              ...v,
              name: s.name || v.name,
              rollNo: p.rollNo || s.rollNo || v.rollNo,
              RFIDNumber: p.rfid || s.rfid_uid || s.RFIDNumber || v.RFIDNumber,
              department: s.department || v.department,
              email: s.email || v.email,
              mobileNumber: s.mobileNumber || v.mobileNumber,
            }));
          })();
        }
      }
    } catch (_) {}
  }, []);

  // Auto-detect only in Edit tab (for consistency with explicit tab behavior)
  useEffect(() => {
    if (activeTab !== 'edit') return; // do nothing in Add tab
    const h = setTimeout(async () => {
      try {
        // Prefer RFID if present
        const params = {};
        if (form.RFIDNumber) params.rfid_uid = form.RFIDNumber;
        else if (form.rollNo) params.rollNo = form.rollNo;
        if (!Object.keys(params).length) return;
        const { data } = await api.get('/students/find', { params });
        if (data?._id) {
          const full = await fetchStudentFull(data._id) || data;
          setSelected(full);
          setError('');
          setForm(v => ({
            ...v,
            name: full.name || v.name,
            rollNo: full.rollNo || v.rollNo,
            RFIDNumber: full.rfid_uid || full.RFIDNumber || v.RFIDNumber,
            department: full.department || v.department,
            email: full.email || v.email,
            mobileNumber: full.mobileNumber || v.mobileNumber,
          }));
          // silently switched to Edit mode
        }
      } catch (_) {
        // ignore; means not found, keep Add mode
      }
    }, 400);
    return () => clearTimeout(h);
  }, [form.rollNo, form.RFIDNumber, activeTab]);

  // Find handler for Edit tab
  const findForEdit = async () => {
    try {
      setError('');
      const params = {};
      if (editRfid) params.rfid_uid = editRfid;
      else if (editRoll) params.rollNo = editRoll;
      if (!Object.keys(params).length) { setError('Enter Roll No or RFID'); return; }
      const { data } = await api.get('/students/find', { params });
      if (data?._id) {
        const full = await fetchStudentFull(data._id) || data;
        setSelected(full);
        setForm(v => ({
          ...v,
          name: full.name || v.name,
          rollNo: full.rollNo || v.rollNo,
          RFIDNumber: full.rfid_uid || full.RFIDNumber || v.RFIDNumber,
          department: full.department || v.department,
          email: full.email || v.email,
          mobileNumber: full.mobileNumber || v.mobileNumber,
        }));
      } else {
        setSelected(null);
        setError('Student not found');
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Find failed');
    }
  };

  // Setup Socket.IO for server logging and cross-module UI sync
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
          setActiveTab('edit');
          (async () => {
            const full = await fetchStudentFull(s._id);
            const sf = full || s;
            setSelected(sf);
            setForm(v => ({
              ...v,
              name: sf.name || v.name,
              rollNo: sf.rollNo || v.rollNo,
              RFIDNumber: sf.RFIDNumber || sf.rfid_uid || uid || v.RFIDNumber,
              department: sf.department || v.department,
              email: sf.email || v.email,
              mobileNumber: sf.mobileNumber || v.mobileNumber,
            }));
          })();
        }
        else if (uid) {
          // No student found for scan yet: stay in Add and prefill RFID
          setActiveTab('add');
        }
      } catch (_) {}
    };
    socket.on('esp32:rfid-scan', onScan);
    // Cross-module broadcasts
    const onUiScan = (p) => {
      try {
        const s = p?.student;
        const uid = p?.uid || p?.rfid;
        if (s?._id) {
          (async () => {
            const full = await fetchStudentFull(s._id);
            const sf = full || s;
            setSelected(sf);
            setForm(v => ({
              ...v,
              name: sf.name || v.name,
              rollNo: sf.rollNo || v.rollNo,
              RFIDNumber: sf.RFIDNumber || sf.rfid_uid || uid || v.RFIDNumber,
              department: sf.department || v.department,
              email: sf.email || v.email,
              mobileNumber: sf.mobileNumber || v.mobileNumber,
            }));
          })();
        } else if (uid) {
          setForm(v => ({ ...v, RFIDNumber: uid }));
          setActiveTab('add');
        }
      } catch (_) {}
    };
    const onUiClear = () => {
      setSelected(null);
      setForm(v => ({ ...v, name: '', rollNo: '', RFIDNumber: '', department: '', email: '' }));
    };
    socket.on('ui:rfid-scan', onUiScan);
    socket.on('ui:rfid-clear', onUiClear);
    return () => { try { socket.disconnect(); } catch {} };
  }, []);

  // Window-level backup listeners for same-tab sync
  useEffect(() => {
    const onWinScan = (e) => {
      try {
        const p = e?.detail;
        const s = p?.student;
        const uid = p?.uid || p?.rfid;
        if (s?._id) {
          (async () => {
            const full = await fetchStudentFull(s._id);
            const sf = full || s;
            setSelected(sf);
            setForm(v => ({
              ...v,
              name: sf.name || v.name,
              rollNo: sf.rollNo || v.rollNo,
              RFIDNumber: sf.RFIDNumber || sf.rfid_uid || uid || v.RFIDNumber,
              department: sf.department || v.department,
              email: sf.email || v.email,
              mobileNumber: sf.mobileNumber || v.mobileNumber,
            }));
          })();
        } else if (uid) {
          setForm(v => ({ ...v, RFIDNumber: uid }));
        }
      } catch (_) {}
    };
    const onWinClear = () => {
      setSelected(null);
      setForm(v => ({ ...v, name: '', rollNo: '', RFIDNumber: '', department: '', email: '' }));
    };
    try { window.addEventListener('ui:rfid-scan', onWinScan); } catch {}
    try { window.addEventListener('ui:rfid-clear', onWinClear); } catch {}
    return () => {
      try { window.removeEventListener('ui:rfid-scan', onWinScan); } catch {}
      try { window.removeEventListener('ui:rfid-clear', onWinClear); } catch {}
    };
  }, []);

  const deposit = async (id) => {
    try {
      setError('');
      const amt = Number(walletInputs[id] || 0);
      if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
      await api.post('/admin/wallet/deposit', { studentId: id, amount: amt });
      // Refresh students and broadcast wallet update
      try {
        const { data: s } = await api.get(`/admin/students/${id}`);
        try { socketRef.current?.emit('wallet:updated', { studentId: id, walletBalance: s?.walletBalance }); } catch {}
        try { window.dispatchEvent(new CustomEvent('wallet:updated', { detail: { studentId: id, walletBalance: s?.walletBalance } })); } catch {}
      } catch (_) {}
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
      // Refresh students and broadcast wallet update
      try {
        const { data: s } = await api.get(`/admin/students/${id}`);
        try { socketRef.current?.emit('wallet:updated', { studentId: id, walletBalance: s?.walletBalance }); } catch {}
        try { window.dispatchEvent(new CustomEvent('wallet:updated', { detail: { studentId: id, walletBalance: s?.walletBalance } })); } catch {}
      } catch (_) {}
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
      const msg = e?.response?.data?.message || e.message || '';
      // If duplicate, try resolving and switch to Edit mode automatically
      if (/exists/i.test(msg)) {
        try {
          const params = {};
          if (form.RFIDNumber) params.rfid_uid = form.RFIDNumber;
          else if (form.rollNo) params.rollNo = form.rollNo;
          if (Object.keys(params).length) {
            const { data } = await api.get('/students/find', { params });
            if (data?._id) {
              const full = await api.get(`/admin/students/${data._id}`).then(r=>r.data).catch(()=>data);
              setSelected(full);
              setForm(v => ({
                ...v,
                name: full.name || v.name,
                rollNo: full.rollNo || v.rollNo,
                RFIDNumber: full.rfid_uid || full.RFIDNumber || v.RFIDNumber,
                department: full.department || v.department,
                email: full.email || v.email,
                mobileNumber: full.mobileNumber || v.mobileNumber,
              }));
              // silently switched to Edit mode
              return;
            }
          }
        } catch (_) {}
      }
      setError(msg || 'Failed to add student');
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
    // Guard: only admins may access this page
    !user || user.role !== 'admin' ? <Navigate to="/login" replace /> : (
    <AdminLayout title="Admin Dashboard" subtitle="Manage students, wallets and RFID">
      {/* Selected student banner */}
      {selected && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded flex items-center justify-between">
          <div className="text-sm text-green-900">
            <span className="font-medium">Student:</span> {selected.name} · <span className="font-medium">Roll:</span> {selected.rollNo || '-'} · <span className="font-medium">RFID:</span> {selected.rfid_uid || selected.RFIDNumber || '-'} · <span className="font-medium">Dept:</span> {selected.department || '-'}
          </div>
          <button
            onClick={() => { setSelected(null); setForm(v => ({ ...v, name: '', rollNo: '', RFIDNumber: '', department: '', email: '' })); try { localStorage.removeItem('last_student'); } catch {}; try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {}; try { window.dispatchEvent(new CustomEvent('ui:rfid-clear', { detail: {} })); } catch {} }}
            className="px-2 py-1 text-xs bg-white hover:bg-gray-50 rounded border border-green-200 text-green-800"
          >Clear</button>
        </div>
      )}
      <div className="space-y-6 mt-4">
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Students" value={students.length} icon="👥" />
          <StatCard title="Today's Food Sales" value={`₹ ${todaysFoodSales.toFixed(2)}`} hint="Food Court" icon="🍔" />
          <StatCard title="Today's Store Sales" value={`₹ ${todaysStoreSales.toFixed(2)}`} hint="Store" icon="🛍️" />
          <StatCard title="ESP32" value={serialConnected ? 'Connected' : 'Not connected'} hint={serialStatus} icon="🔌" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded border border-green-100 shadow-sm overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{selected ? 'Edit Student' : 'Add Student (by RFID)'}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Roll No" value={form.rollNo} onChange={e => setForm(v => ({ ...v, rollNo: e.target.value }))} />
                <input type="email" className="border rounded px-3 py-2" placeholder="Email ID" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Mobile Number" value={form.mobileNumber} onChange={e => setForm(v => ({ ...v, mobileNumber: e.target.value }))} />
                <input type="text" className="border rounded px-3 py-2" placeholder="New Password" value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} />
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
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {selected ? (
                  <>
                    <Button disabled={saving} onClick={updateStudent}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    {/* Inline password reset */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Set new password"
                        value={newStudentPassword}
                        onChange={e=>setNewStudentPassword(e.target.value)}
                        className="border rounded px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={resetStudentPassword}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm"
                        disabled={saving}
                      >
                        Reset Password
                      </button>
                    </div>
                    <Button type="button" variant="outline" onClick={() => { setSelected(null); setActiveTab('add'); setForm({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' }); }}>
                      Add New
                    </Button>
                  </>
                ) : (
                  <Button disabled={saving} onClick={addStudent}>{saving ? 'Saving...' : 'Add Student'}</Button>
                )}
              </div>
            </div>

            <div className="bg-white p-4 rounded border border-green-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Students</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700">{students.length}</span>
                </div>
                <Button variant="outline" onClick={() => navigate('/admin/students')}>Open</Button>
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
    </AdminLayout>
    )
  );
}
