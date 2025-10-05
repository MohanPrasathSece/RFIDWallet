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
          <h1 className="text-2xl font-semibold">Library</h1>
          <Link to="/library/add" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Add Book</Link>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Roll Number</label>
              <input value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="Enter Roll Number"
                     className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">RFID Number</label>
              <div className="flex items-center gap-2">
                <input value={rfid} onChange={e => setRfid(e.target.value)} placeholder="Scan or enter RFID"
                       className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={findStudent} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded">Find Student</button>
              <button onClick={loadData} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Load Data</button>
              <button onClick={() => { setRfid(''); setRollNo(''); setStudentId(''); setStudent(null); setActive([]); setHistory([]); setError(''); try { localStorage.removeItem('last_student'); } catch {}; try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {}; try { window.dispatchEvent(new CustomEvent('ui:rfid-clear', { detail: {} })); } catch {} }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded">Clear</button>
            </div>
            {loading && <div className="text-gray-500">Loading...</div>}
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          {student && (
            <div className="mt-3 text-sm text-gray-700">Student: <b>{student.name}</b> · Dept: {student.department || '-'} · Modules: {Array.isArray(student.modules) && student.modules.length ? student.modules.join(', ') : '-'}</div>
          )}
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
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Topics</th>
                      <th className="px-3 py-2 text-left">Count</th>
                      <th className="px-3 py-2 text-left">Last Activity</th>
                      <th className="px-3 py-2 text-left">Due Date</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(({ item, count, last, dueDate }, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{item?.name || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{(item?.topics || []).join(', ') || '-'}</td>
                        <td className="px-3 py-2">{count}</td>
                        <td className="px-3 py-2">{last ? new Date(last).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2">{dueDate ? new Date(dueDate).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => returnBook(item?._id)} className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded">Mark Returned</button>
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
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">When</th>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(tx => (
                      <tr key={tx._id} className="border-t">
                        <td className="px-3 py-2">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 capitalize">{tx.action}</td>
                        <td className="px-3 py-2">{tx.item?.name || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{tx.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Recent Scans (Library)</h2>
            <div className="flex items-center gap-2">
              <button onClick={loadAllScans} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
              <Link to="/library/scans" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">All Scans</Link>
            </div>
          </div>
          {allHistory.length === 0 ? (
            <div className="text-gray-500">No scans yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">RFID</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allHistory.slice(0,5).map(row => (
                    <tr key={row._id} className="border-t">
                      <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{row.action}</td>
                      <td className="px-3 py-2">{row.item?.name || '-'}</td>
                      <td className="px-3 py-2">{row.student?.name || '-'}</td>
                      <td className="px-3 py-2">{row.student?.rfid || '-'}</td>
                      <td className="px-3 py-2 capitalize">{row.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}
