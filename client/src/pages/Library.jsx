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
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const loadAllScans = async () => {
    try {
      const { data } = await api.get('/library/history-all');
      setAllHistory(Array.isArray(data) ? data : []);
    } catch (_) {
      // ignore; optional: setError('Failed to load scans')
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
    // initial all scans
    loadAllScans();

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
          loadAllScans();
        } else if (uid) {
          api.get(`/rfid/resolve/${uid}`).then(({ data }) => {
            if (data?._id) {
              setStudent(data);
              setStudentId(data._id);
              setRollNo(data.rollNo || '');
              loadData({ studentId: data._id });
              loadAllScans();
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
      socket.off('transaction:new', loadAllScans);
      socket.off('transaction:update', loadAllScans);
      socket.off('rfid:approved', loadAllScans);
      socket.off('rfid:pending', loadAllScans);
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
      // Optionally refresh student data if a student is selected
      if (studentId || rfid) await loadData();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to borrow');
    }
  };

  const returnBook = async (itemId) => {
    try {
      setError('');
      const sid = student?._id || studentId;
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
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to mark return');
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Library</h1>
            <p className="text-sm text-gray-500">Borrow, return and manage your library collection</p>
          </div>
          <Link to="/library/add" className="px-8 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow">Add Book</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-semibold mb-3">Borrow Book</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="border rounded px-3 py-2" value={borrowItemId} onChange={e=>setBorrowItemId(e.target.value)}>
                <option value="">Select Book</option>
                {items.map(it => (
                  <option
                    value={it._id}
                    key={it._id}
                    disabled={!(Number.isFinite(it?.quantity) ? it.quantity > 0 : false)}
                  >
                    {it.name} {Number(it?.quantity) > 0 ? `(qty ${it.quantity})` : '— Unavailable'}
                  </option>
                ))}
              </select>
              <input type="date" className="border rounded px-3 py-2" value={borrowDueDate} onChange={e=>setBorrowDueDate(e.target.value)} />
              <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Notes (optional)" value={borrowNotes} onChange={e=>setBorrowNotes(e.target.value)} />
            </div>
            <div className="mt-3">
              <button onClick={borrowBook} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Borrow</button>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-start gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Roll Number</label>
                <input value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="Enter Roll Number"
                       className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">RFID Number</label>
                <input value={rfid} onChange={e => setRfid(e.target.value)} placeholder="Scan or enter RFID"
                       className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 pt-6 md:pt-0">
                <button onClick={findStudent} className="px-2.5 py-0.5 text-xs leading-none bg-emerald-600 hover:bg-emerald-700 text-white rounded">Find</button>
                <button onClick={loadData} className="px-2.5 py-0.5 text-xs leading-none bg-blue-600 hover:bg-blue-700 text-white rounded">Load</button>
                <button onClick={() => { setRfid(''); setRollNo(''); setStudentId(''); setStudent(null); setActive([]); setHistory([]); setError(''); try { localStorage.removeItem('last_student'); } catch {}; try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {}; try { window.dispatchEvent(new CustomEvent('ui:rfid-clear', { detail: {} })); } catch {} }}
                        className="px-2.5 py-0.5 text-xs leading-none bg-gray-100 hover:bg-gray-200 rounded border">Clear</button>
              </div>
            </div>
            <div className="hidden md:block w-px bg-gray-100" />
            <div className="min-w-[260px]">
              <div className="text-sm font-semibold text-gray-700 mb-2">Student</div>
              {!student ? (
                <div className="text-gray-500 text-sm">No student selected</div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    {String(student.name || '?').charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-gray-500">{student.rollNo} · {student.department || '-'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {loading && <div className="text-gray-500 text-sm">Loading...</div>}
            {error && <div className="text-red-600 text-sm">{error}</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Currently Borrowed</h2>
              <button onClick={loadData} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
            </div>
            {active.length === 0 ? (
              <div className="text-gray-500">No active borrows.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm table-fixed">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Topics</th>
                      <th className="px-3 py-2 text-left">Count</th>
                      <th className="px-3 py-2 text-left">Last Activity</th>
                      <th className="px-3 py-2 text-left">Due Date</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {active.map(({ item, count, last, dueDate }, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{item?.name || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{(item?.topics || []).join(', ') || '-'}</td>
                        <td className="px-3 py-2">{count}</td>
                        <td className="px-3 py-2">{last ? new Date(last).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2">{dueDate ? new Date(dueDate).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => returnBook(item?._id)} className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow">Mark Returned</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">History</h2>
              <button onClick={loadData} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
            </div>
            {history.length === 0 ? (
              <div className="text-gray-500">No history.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm table-fixed">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left">When</th>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map(tx => (
                      <tr key={tx._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 capitalize">{tx.action}</td>
                        <td className="px-3 py-2">{tx.item?.name || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{tx.notes || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : tx.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {tx.status || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Link to="/library/scans" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow">View All Scans</Link>
        </div>
      </div>
  );
}
