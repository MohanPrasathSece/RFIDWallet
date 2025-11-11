import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Library() {
  const [rollNo, setRollNo] = useState('');
  const [rfid, setRfid] = useState('');
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState(null);
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'history'

  // Items for library (used for borrow dropdown)
  const [items, setItems] = useState([]);
  const [borrowItemId, setBorrowItemId] = useState('');
  const [borrowQty, setBorrowQty] = useState(1);
  const [borrowNotes, setBorrowNotes] = useState('');
  const [borrowDueDate, setBorrowDueDate] = useState('');

  const loadData = async (overrides = {}) => {
    try {
      setLoading(true);
      setError('');
      const sid = overrides.studentId || student?._id || studentId;
      const rfidParam = overrides.rfid || rfid;
      const query = sid ? { student: sid } : (rfidParam ? { rfidNumber: rfidParam } : null);
      if (!query) {
        setError('Find a student (Roll No or RFID) to load data.');
        setActive([]); setHistory([]); setStudent(null);
        return;
      }
      // Resolve student via active call (will 404 if not found)
      const [activeRes, histRes] = await Promise.all([
        api.get('/library/active', { params: query }),
        api.get('/library/history', { params: query }),
      ]);
      setActive(activeRes.data || []);
      setHistory(histRes.data || []);
      // Extract student from history if present
      const st = (histRes.data && histRes.data[0]?.student) || null;
      if (st) setStudent(st);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
      setActive([]); setHistory([]); setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  // Per-page Web Serial scanner removed; use global Connect in Sidebar

  // Simplified: removed global recent transactions and stats overview

  const findStudent = async () => {
    try {
      setError('');
      if (!rollNo && !rfid) {
        setError('Enter a Roll Number or RFID to find a student.');
        return;
      }
      const params = {};
      if (rollNo) params.rollNo = rollNo;
      if (rfid) params.rfid_uid = rfid;
      const { data } = await api.get('/students/find', { params });
      if (data?._id) {
        setStudent(data);
        setStudentId(data._id);
        setRollNo(data.rollNo || rollNo);
        setRfid(data.rfid_uid || rfid);
        // Persist and broadcast to keep selection across modules
        try {
          const payload = {
            student: data,
            rollNo: data.rollNo || '',
            rfid: data.rfid_uid || '',
            walletBalance: data.walletBalance,
            source: 'library-find'
          };
          localStorage.setItem('last_student', JSON.stringify(payload));
          try { window?.socket?.emit?.('ui:rfid-scan', payload); } catch {}
        } catch {}
        // Auto-load borrowed and history for this student (use override id to avoid async state lag)
        try { await loadData({ studentId: data._id }); } catch {}
      } else {
        setStudent(null);
        setStudentId('');
        setError('Student not found.');
        try { localStorage.removeItem('last_student'); } catch {}
      }
    } catch (e) {
      setStudent(null);
      setStudentId('');
      setError(e?.response?.data?.message || 'Error finding student.');
    }
  };

  useEffect(() => {
    // Load library items list for borrow dropdown
    (async () => {
      try {
        const res = await api.get('/items', { params: { type: 'library' } });
        setItems(res.data || []);
      } catch (_) {}
    })();

    // Hydrate context from global broadcaster cache
    try {
      const last = localStorage.getItem('last_student');
      if (last) {
        const p = JSON.parse(last);
        if (p?.student) {
          setStudent(p.student);
          setStudentId(p.student._id);
          setRollNo(p.rollNo || p.student.rollNo || '');
          setRfid(p.rfid || p.student.rfid_uid || '');
          // Auto-load lists for hydrated student (pass id explicitly)
          try { loadData({ studentId: p.student._id }); } catch {}
        }
      }
    } catch (_) {}

    // setup socket to refresh all scans on changes and react to RFID scans
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const onScan = (payload) => {
      try {
        const uid = payload?.uid || payload?.rfid || payload?.RFIDNumber;
        const s = payload?.student;
        if (uid) setRfid(uid);
        if (s?._id) {
          setStudent(s);
          setStudentId(s._id);
          setRollNo(s.rollNo || '');
          // refresh lists immediately with explicit id
          loadData({ studentId: s._id });
        } else if (uid) {
          api.get(`/rfid/resolve/${uid}`).then(({ data }) => {
            if (data?._id) {
              setStudent(data);
              setStudentId(data._id);
              setRollNo(data.rollNo || '');
              loadData({ studentId: data._id });
            }
          }).catch(() => {});
        }
      } catch (_) {}
    };
    const onClear = () => {
      setStudent(null);
      setStudentId('');
      setRollNo('');
      setRfid('');
      setActive([]);
      setHistory([]);
      setError('');
      try { localStorage.removeItem('last_student'); } catch {}
    };
    socket.on('esp32:rfid-scan', onScan);
    socket.on('esp32:rfid-clear', onClear);
    // UI-level broadcasts from other modules
    socket.on('ui:rfid-scan', onScan);
    socket.on('ui:rfid-clear', onClear);
    return () => {
      socket.off('esp32:rfid-scan', onScan);
      socket.off('esp32:rfid-clear', onClear);
      socket.off('ui:rfid-scan', onScan);
      socket.off('ui:rfid-clear', onClear);
      socket.disconnect();
    };
  }, []);

  const borrowBook = async () => {
    try {
      setError('');
      const sid = student?._id || studentId;
      if (!sid) { setError('Find a student first'); return; }
      if (!borrowItemId) { setError('Select a book to borrow'); return; }
      
      const selectedItem = items.find(item => item._id === borrowItemId);
      const available = Number.isFinite(selectedItem?.quantity) ? Number(selectedItem.quantity) : 0;
      const qty = Math.max(1, Math.min(Number(borrowQty) || 1, available));
      if (qty <= 0) { setError('Selected book is out of stock'); return; }

      setConfirmationAction({
        type: 'borrow',
        data: { student: student?.name, item: selectedItem?.name, qty }
      });
      setShowConfirmation(true);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to prepare borrow');
    }
  };

  const confirmBorrow = async () => {
    try {
      setError('');
      const sid = student?._id || studentId;
      // Optional due date
      const due = borrowDueDate ? new Date(borrowDueDate) : undefined;
      // Borrow multiple copies by creating/approving multiple transactions
      const qty = Math.max(1, Number(confirmationAction?.data?.qty) || Number(borrowQty) || 1);
      for (let i = 0; i < qty; i += 1) {
        const createRes = await api.post('/transactions', {
          student: sid,
          item: borrowItemId,
          module: 'library',
          action: 'borrow',
          status: 'pending',
          notes: borrowNotes || undefined,
          dueDate: due ? due.toISOString() : undefined,
        });
        const txId = createRes.data?._id;
        if (txId) {
          await api.put(`/transactions/${txId}`, { status: 'approved' });
        }
      }
      setBorrowItemId(''); setBorrowNotes(''); setBorrowDueDate('');
      setBorrowQty(1);
      setShowConfirmation(false);
      setConfirmationAction(null);
      // Optionally refresh student data if a student is selected
      if (studentId || rfid) await loadData();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to borrow');
      setShowConfirmation(false);
    }
  };

  const returnBook = async (itemId) => {
    const item = active.find(a => a.item?._id === itemId);
    setConfirmationAction({
      type: 'return',
      data: { student: student?.name, item: item?.item?.name, itemId }
    });
    setShowConfirmation(true);
  };

  const confirmReturn = async () => {
    try {
      setError('');
      const sid = student?._id || studentId;
      const itemId = confirmationAction?.data?.itemId;
      if (!sid) { setError('Find a student first'); return; }
      if (!itemId) { setError('Invalid item'); return; }
      const createRes = await api.post('/transactions', {
        student: sid,
        item: itemId,
        module: 'library',
        action: 'return',
        status: 'approved',
        notes: 'Returned by admin',
      });
      if (createRes?.data?._id) {
        await loadData();
      }
      setShowConfirmation(false);
      setConfirmationAction(null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to mark return');
      setShowConfirmation(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'f':
            e.preventDefault();
            document.getElementById('student-search-input')?.focus();
            break;
          case 'i':
            e.preventDefault();
            if (student && borrowItemId) borrowBook();
            break;
          case 'c':
            e.preventDefault();
            setRfid(''); setRollNo(''); setStudentId(''); setStudent(null); 
            setActive([]); setHistory([]); setError('');
            try { localStorage.removeItem('last_student'); } catch {}
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [student, borrowItemId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-400/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-violet-400/10 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        

        <div className="space-y-6">
          {/* Enhanced Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <span className="text-2xl text-purple-600 dark:text-purple-400">📚</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Library Management</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manage book borrowing, returns, and collections</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/library/add" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                ➕ Add Book
              </Link>
              <Link to="/library/scans" className="px-4 py-2 border-2 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-semibold transition-all duration-200">
                📡 Recent Scans
              </Link>
            </div>
          </div>

          {/* Enhanced Search and Issue Section */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Student Search */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <span className="text-xl text-blue-600 dark:text-blue-400">👤</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Find Student</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    id="student-search-input"
                    value={rollNo}
                    onChange={e => setRollNo(e.target.value)}
                    placeholder="Roll Number"
                    className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700"
                    title="Search by roll number (Alt+F to focus)"
                  />
                  <input
                    value={rfid}
                    onChange={e => setRfid(e.target.value)}
                    placeholder="RFID Number"
                    className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700"
                    title="Search by RFID"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={findStudent} className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200" title="Find student (Alt+F)">
                    Find Student
                  </button>
                  <button onClick={loadData} className="px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-xl text-sm font-semibold transition-all duration-200" title="Reload data">
                    Load
                  </button>
                  <button
                    onClick={() => {
                      setRfid(''); setRollNo(''); setStudentId(''); setStudent(null);
                      setActive([]); setHistory([]); setError('');
                      try { localStorage.removeItem('last_student'); } catch {}
                      try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {}
                    }}
                    className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    title="Clear selection (Alt+C)"
                  >
                    Clear
                  </button>
                </div>

                {student && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-green-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm text-green-600 dark:text-green-400">✓</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-blue-900 dark:text-blue-100 text-lg">{student.name}</div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">{student.rollNo} {student.department ? `• ${student.department}` : ''}</div>
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Wallet: ₹{student.walletBalance || 0}</div>
                      </div>
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 px-2 py-1 rounded-full inline-block">
                      📡 Student scanned successfully
                    </div>
                  </div>
                )}
              </div>

              {/* Book Issue */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                    <span className="text-xl text-emerald-600 dark:text-emerald-400">📚</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Issue Book</h3>
                </div>

                <select
                  className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700"
                  value={borrowItemId}
                  onChange={e => setBorrowItemId(e.target.value)}
                  title="Choose book to issue"
                >
                  <option value="">Choose a book...</option>
                  {items.map(it => (
                    <option value={it._id} key={it._id} disabled={!(Number.isFinite(it?.quantity) ? it.quantity > 0 : false)}>
                      {it.name} {Number(it?.quantity) > 0 ? `(${it.quantity} available)` : '— Out of Stock'}
                    </option>
                  ))}
                </select>

                {/* Quantity selector for multiple copies */}
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {(() => {
                      try {
                        const sel = items.find(it => it._id === borrowItemId);
                        const avail = Number.isFinite(sel?.quantity) ? Number(sel.quantity) : 0;
                        if (!borrowItemId) return 'Select a book to set quantity';
                        return `Available: ${avail}`;
                      } catch (_) { return null; }
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-8 h-8 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200"
                      onClick={() => setBorrowQty(q => Math.max(1, Number(q || 1) - 1))}
                      disabled={!borrowItemId}
                    >-</button>
                    <input
                      type="number"
                      min={1}
                      value={borrowQty}
                      onChange={e => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        try {
                          const sel = items.find(it => it._id === borrowItemId);
                          const avail = Number.isFinite(sel?.quantity) ? Number(sel.quantity) : val;
                          setBorrowQty(Math.min(val, avail));
                        } catch (_) { setBorrowQty(val); }
                      }}
                      className="w-16 text-center border-2 border-gray-200 dark:border-gray-600 rounded-xl px-2 py-1 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100"
                      disabled={!borrowItemId}
                    />
                    <button
                      type="button"
                      className="w-8 h-8 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200"
                      onClick={() => {
                        try {
                          const sel = items.find(it => it._id === borrowItemId);
                          const avail = Number.isFinite(sel?.quantity) ? Number(sel.quantity) : Infinity;
                          setBorrowQty(q => Math.min(avail, Number(q || 1) + 1));
                        } catch (_) { setBorrowQty(q => Number(q || 1) + 1); }
                      }}
                      disabled={!borrowItemId}
                    >+</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">Due Date</label>
                    <input type="date" className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200" value={borrowDueDate} onChange={e => setBorrowDueDate(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <button onClick={borrowBook} disabled={!student || !borrowItemId || (Number(borrowQty)||0) < 1} className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:disabled:bg-gray-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" title="Issue book (Alt+I)">
                      Issue Book
                    </button>
                  </div>
                </div>

                <input className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700" placeholder="Notes (optional)" value={borrowNotes} onChange={e=>setBorrowNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Enhanced Status Messages */}
          {(loading || error) && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              {loading && <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"><div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>Loading...</div>}
              {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-700">{error}</div>}
            </div>
          )}

          {/* Enhanced Tabbed Data Section */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col flex-grow">
            {/* Enhanced Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 p-4 text-sm font-medium transition-all duration-200 ${
                  activeTab === 'active'
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-b-2 border-purple-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <div className="flex items-center justify-center gap-2">
                  <span>📖</span>
                  <span>Active Borrows</span>
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">{active.length}</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 p-4 text-sm font-medium transition-all duration-200 ${
                  activeTab === 'history'
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-b-2 border-purple-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <div className="flex items-center justify-center gap-2">
                  <span>📋</span>
                  <span>History</span>
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">{history.length}</span>
                </div>
              </button>
            </div>

            {/* Enhanced Tab Content */}
            <div className="p-6 flex-grow overflow-auto">
              {activeTab === 'active' && (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Active Book Borrows</h3>
                    <button onClick={loadData} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                      Refresh
                    </button>
                  </div>
                  {active.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-gray-400 dark:text-gray-500">📚</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-lg">No active borrows</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Books will appear here when borrowed</p>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-grow overflow-auto">
                      {active.map(({ item, count, dueDate }, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-gray-600 rounded-xl p-4 transition-all duration-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📖</span>
                                <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100">{item?.name || 'Unknown Book'}</h4>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                <span className="font-medium">Quantity:</span> {count} • <span className="font-medium">Due:</span> {dueDate ? new Date(dueDate).toLocaleDateString() : 'No due date'}
                              </div>
                              {dueDate && new Date(dueDate) < new Date() && (
                                <div className="mt-2 inline-flex items-center px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                                  ⚠️ Overdue
                                </div>
                              )}
                            </div>
                            <button onClick={() => returnBook(item?._id)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                              Return Book
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Transaction History</h3>
                    <button onClick={loadData} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                      Refresh
                    </button>
                  </div>
                  {history.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-gray-400 dark:text-gray-500">📋</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-lg">No transaction history</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Transactions will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-grow overflow-auto">
                      {history.map(tx => (
                        <div key={tx._id} className="bg-gray-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-gray-600 rounded-xl p-4 transition-all duration-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📚</span>
                                <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100">{tx.item?.name || 'Unknown Book'}</h4>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 capitalize">
                                <span className="font-medium">Action:</span> {tx.action} • <span className="font-medium">Date:</span> {new Date(tx.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              tx.status === 'approved'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : tx.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Enhanced Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-xl text-purple-600 dark:text-purple-400">📋</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Confirm {confirmationAction?.type}</h3>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Student:</span>
                  <span className="font-bold">{confirmationAction?.data?.student}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Book:</span>
                  <span className="font-bold">{confirmationAction?.data?.item}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmation(false); setConfirmationAction(null); }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-xl text-sm font-semibold transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmationAction?.type === 'borrow' ? confirmBorrow : confirmReturn}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
