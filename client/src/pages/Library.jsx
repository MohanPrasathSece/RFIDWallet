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
      setConfirmationAction({
        type: 'borrow',
        data: { student: student?.name, item: selectedItem?.name }
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
      // Step 1: create transaction pending
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
        // Step 2: approve to trigger inventory effects
        await api.put(`/transactions/${txId}`, { status: 'approved' });
      }
      setBorrowItemId(''); setBorrowNotes(''); setBorrowDueDate('');
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
    <div className="h-screen bg-white p-4 flex flex-col">
      <div className="w-full flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Library</h1>
            <p className="text-xs text-gray-500">Search student, issue books, and manage returns</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/library/add" className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm" title="Add new book to library">
              Add Book
            </Link>
            <Link to="/library/scans" className="px-3 py-2 border rounded text-sm" title="View all transaction history">
              Recent Scans
            </Link>
          </div>
        </div>

        {/* Search and Issue */}
        <div className="bg-white rounded border p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Student Search */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Find Student</h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="student-search-input"
                  value={rollNo}
                  onChange={e => setRollNo(e.target.value)}
                  placeholder="Roll Number"
                  className="border rounded px-2 py-2 text-sm"
                  title="Search by roll number (Alt+F to focus)"
                />
                <input
                  value={rfid}
                  onChange={e => setRfid(e.target.value)}
                  placeholder="RFID Number"
                  className="border rounded px-2 py-2 text-sm"
                  title="Search by RFID"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={findStudent} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm" title="Find student (Alt+F)">Find</button>
                <button onClick={loadData} className="px-3 py-2 border rounded text-sm" title="Reload data">Load</button>
                <button
                  onClick={() => {
                    setRfid(''); setRollNo(''); setStudentId(''); setStudent(null);
                    setActive([]); setHistory([]); setError('');
                    try { localStorage.removeItem('last_student'); } catch {}
                    try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {}
                  }}
                  className="px-3 py-2 border rounded text-sm"
                  title="Clear selection (Alt+C)"
                >
                  Clear
                </button>
              </div>

              {student && (
                <div className="border rounded p-2 text-sm text-gray-700">
                  <div className="font-semibold">{student.name}</div>
                  <div className="text-xs text-gray-500">{student.rollNo} {student.department ? `• ${student.department}` : ''}</div>
                  <div className="text-xs">Wallet: ₹{student.walletBalance || 0}</div>
                </div>
              )}
            </div>

            {/* Book Issue */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Select Book</h3>
              <select
                className="w-full border rounded px-2 py-2 text-sm"
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Due Date</label>
                  <input type="date" className="w-full border rounded px-2 py-2 text-sm" value={borrowDueDate} onChange={e => setBorrowDueDate(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <button onClick={borrowBook} disabled={!student || !borrowItemId} className="w-full px-3 py-2 bg-blue-600 disabled:bg-gray-300 text-white rounded text-sm" title="Issue book (Alt+I)">
                    Issue Book
                  </button>
                </div>
              </div>
              <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Notes (optional)" value={borrowNotes} onChange={e=>setBorrowNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {(loading || error) && (
          <div className="p-3 border rounded">
            {loading && <div className="text-sm text-gray-600">Loading...</div>}
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          </div>
        )}

        {/* Tabbed Data Section */}
        <div className="border rounded flex flex-col flex-grow">
          {/* Tab Navigation */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 p-2 text-sm font-medium ${
                activeTab === 'active' ? 'bg-gray-100 text-gray-800' : 'text-gray-500'
              }`}>
              Active Borrows ({active.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 p-2 text-sm font-medium ${
                activeTab === 'history' ? 'bg-gray-100 text-gray-800' : 'text-gray-500'
              }`}>
              History ({history.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3 flex-grow overflow-auto">
            {activeTab === 'active' && (
              <div className="space-y-2 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Active Borrows</h3>
                  <button onClick={loadData} className="px-3 py-1 border rounded text-xs">Refresh</button>
                </div>
                {active.length === 0 ? (
                  <p className="text-sm text-gray-500">No active borrows.</p>
                ) : (
                  <div className="space-y-2 flex-grow overflow-auto">
                    {active.map(({ item, count, dueDate }, idx) => (
                      <div key={idx} className="border rounded p-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm">{item?.name || 'N/A'}</h4>
                            <div className="text-xs text-gray-600">Count: {count} | Due: {dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A'}</div>
                            {dueDate && new Date(dueDate) < new Date() && (
                              <div className="mt-1 text-xs text-red-600">Overdue</div>
                            )}
                          </div>
                          <button onClick={() => returnBook(item?._id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">Return</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-2 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">History</h3>
                  <button onClick={loadData} className="px-3 py-1 border rounded text-xs">Refresh</button>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">No transaction history.</p>
                ) : (
                  <div className="space-y-2 flex-grow overflow-auto">
                    {history.map(tx => (
                      <div key={tx._id} className="border rounded p-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm">{tx.item?.name || 'N/A'}</h4>
                            <p className="text-xs text-gray-600 capitalize">{tx.action} • {new Date(tx.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            tx.status === 'approved' ? 'bg-green-100 text-green-700' :
                            tx.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
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

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded p-4 max-w-sm w-full">
              <h3 className="font-semibold text-lg mb-2">Confirm {confirmationAction?.type}</h3>
              <div className="text-sm text-gray-600 mb-4">
                <p><b>Student:</b> {confirmationAction?.data?.student}</p>
                <p><b>Book:</b> {confirmationAction?.data?.item}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowConfirmation(false); setConfirmationAction(null); }}
                  className="flex-1 px-3 py-2 bg-gray-200 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmationAction?.type === 'borrow' ? confirmBorrow : confirmReturn}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
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
