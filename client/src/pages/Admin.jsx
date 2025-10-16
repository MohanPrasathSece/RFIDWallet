import Button from '../shared/ui/Button.jsx';
import Card from '../shared/ui/Card.jsx';
import StatCard from '../shared/ui/StatCard.jsx';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' });
  const [selected, setSelected] = useState(null);
  const [newStudentPassword, setNewStudentPassword] = useState('');
  // Tabs: 'add' | 'edit'
  const [activeTab, setActiveTab] = useState('add');
  // Edit tab find bar
  const [editRoll, setEditRoll] = useState('');
  const [editRfid, setEditRfid] = useState('');
  const [todaysFoodSales, setTodaysFoodSales] = useState(0);
  const [todaysStoreSales, setTodaysStoreSales] = useState(0);

  // Serial ESP32 state
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialStatus, setSerialStatus] = useState('Not connected');
  const [serialPort, setSerialPort] = useState(null);
  const socketRef = useRef(null);
  const [walletInputs, setWalletInputs] = useState({});
  const [showSidebar, setShowSidebar] = useState(false);

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

  return (
    // Guard: only admins may access this page
    !user || user.role !== 'admin' ? <Navigate to="/login" replace /> : (
    <>

      <div className="space-y-6 mt-4">
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Students" value={students.length} icon="👥" />
          <StatCard title="Today's Food Sales" value={`₹ ${todaysFoodSales.toFixed(2)}`} hint="Food Court" icon="🍔" />
          <StatCard title="Today's Store Sales" value={`₹ ${todaysStoreSales.toFixed(2)}`} hint="Store" icon="🛍️" />
          <StatCard title="ESP32" value={serialConnected ? 'Connected' : 'Not connected'} hint={serialStatus} icon="🔌" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            {/* Add/Edit Student (condensed, auto-switch by selection) */}
            <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">{selected? 'Edit Student' : 'Add New Student'}</h2>
              </div>

              {/* Hidden decoy fields to deter browser autofill */}
              <div className="hidden">
                <input type="text" autoComplete="username" name="username" />
                <input type="password" autoComplete="new-password" name="password" />
              </div>

              {selected && (
                <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-900">
                  <span className="font-medium">Editing:</span> {selected.name || '-'} · Roll: {selected.rollNo || '-'} · RFID: {selected.rfid_uid || selected.RFIDNumber || '-'}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(v => ({ ...v, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  autoComplete="off"
                  name="student-name"
                  placeholder="Name *"
                />
                <input
                  type="text"
                  value={form.rollNo}
                  onChange={(e) => setForm(v => ({ ...v, rollNo: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  autoComplete="off"
                  name="roll-no"
                  placeholder="Roll No *"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(v => ({ ...v, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  autoComplete="off"
                  name="noemail"
                  autoCorrect="off"
                  autoCapitalize="none"
                  placeholder="Email *"
                />
                <input
                  type="text"
                  value={form.RFIDNumber}
                  onChange={(e) => setForm(v => ({ ...v, RFIDNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  autoComplete="off"
                  name="rfid-number"
                  placeholder="RFID Number *"
                />
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm(v => ({ ...v, department: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  autoComplete="off"
                  name="department"
                  placeholder="Department"
                />
                {!selected && (
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm(v => ({ ...v, password: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    autoComplete="new-password"
                    name="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    placeholder="Password *"
                  />
                )}
              </div>

              {error && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={selected? updateStudent : addStudent}
                  disabled={saving}
                  className={`px-4 py-2 ${saving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white rounded text-sm`}
                >
                  {saving ? 'Saving...' : (selected? 'Update Student' : 'Add Student')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' });
                    setSelected(null);
                    setError('');
                    // Broadcast clear event to all modules
                    try { socketRef.current?.emit('ui:rfid-clear', {}); } catch {}
                    try { window.dispatchEvent(new CustomEvent('ui:rfid-clear', { detail: {} })); } catch {}
                    try { localStorage.removeItem('last_student'); } catch {}
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Bulk Upload (short) */}
            <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Bulk Student Upload</h3>
                <Button variant="outline" onClick={() => navigate('/admin/bulk-upload')}>Open</Button>
              </div>
              <p className="mt-2 text-sm text-gray-600">Upload multiple students from Excel.</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Recent Students</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700">{students.length}</span>
              </div>
              <Button variant="outline" onClick={() => setShowSidebar(true)}>Open</Button>
            </div>
            <p className="mt-2 text-sm text-gray-600">Latest added students:</p>
            <div className="mt-3 max-h-48 overflow-auto space-y-2">
              {students.slice(0, 8).map(s => (
                <div
                  key={s._id}
                  className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-sm font-semibold">
                      {(s.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.rollNo || s.rfid_uid || '—'}</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSidebar(true)}
                    className="text-xs"
                  >
                    View Details
                  </Button>
                </div>
              ))}
              {students.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No students yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Students Sidebar */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowSidebar(false)}
          />

          {/* Sidebar */}
          <div className="relative ml-auto w-full max-w-lg bg-white shadow-xl transform transition-transform">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">All Students</h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search students..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  onChange={(e) => {
                    // Add search functionality if needed
                  }}
                />
              </div>

              <div className="max-h-[calc(100vh-200px)] overflow-auto space-y-3">
                {students.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No students found.</div>
                ) : (
                  students.map(s => (
                    <div key={s._id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      {/* Student Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-sm font-semibold">
                          {(s.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.rollNo || s.rfid_uid || '—'}</div>
                        </div>
                        <button
                          onClick={() => {
                            setSelected(s);
                            setActiveTab('edit');
                            setForm(v => ({
                              ...v,
                              name: s.name || v.name,
                              rollNo: s.rollNo || v.rollNo,
                              RFIDNumber: s.rfid_uid || s.RFIDNumber || v.RFIDNumber,
                              department: s.department || v.department,
                              email: s.email || v.email,
                              mobileNumber: s.mobileNumber || v.mobileNumber,
                            }));
                            setShowSidebar(false);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Student Details */}
                      <div className="space-y-2 mb-3">
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Email:</span>
                            <span className="text-gray-600">{s.email || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Department:</span>
                            <span className="text-gray-600">{s.department || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">RFID:</span>
                            <span className="text-gray-600 font-mono text-xs">{s.rfid_uid || s.RFIDNumber || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Mobile:</span>
                            <span className="text-gray-600">{s.mobileNumber || '-'}</span>
                          </div>
                        </div>

                        {/* Wallet Balance */}
                        <div className="bg-green-50 border border-green-200 rounded p-3 mt-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-green-800">Wallet Balance:</span>
                            <span className="font-semibold text-green-900">₹{s.walletBalance ?? 0}</span>
                          </div>
                        </div>

                        {/* Wallet Actions */}
                        <div className="flex gap-2 mt-3">
                          <input
                            type="number"
                            placeholder="Amount"
                            value={walletInputs[s._id] || ''}
                            onChange={(e) => setWalletInputs(v => ({ ...v, [s._id]: e.target.value }))}
                            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                            min="0"
                            step="0.01"
                          />
                          <button
                            onClick={() => {
                              deposit(s._id);
                              // Clear input after operation
                              setTimeout(() => setWalletInputs(v => ({ ...v, [s._id]: '' })), 100);
                            }}
                            disabled={!walletInputs[s._id] || walletInputs[s._id] <= 0}
                            className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-400"
                            title="Add money to wallet"
                          >
                            + Add
                          </button>
                          <button
                            onClick={() => {
                              withdraw(s._id);
                              // Clear input after operation
                              setTimeout(() => setWalletInputs(v => ({ ...v, [s._id]: '' })), 100);
                            }}
                            disabled={!walletInputs[s._id] || walletInputs[s._id] <= 0}
                            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:bg-gray-400"
                            title="Deduct money from wallet"
                          >
                            - Deduct
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
    )
  );
}
