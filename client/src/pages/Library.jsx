import Sidebar from '../shared/Sidebar.jsx';
import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Library() {
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const query = studentId ? { student: studentId } : (rfid ? { rfidNumber: rfid } : null);
      if (!query) {
        setError('Enter Student ID or RFID Number');
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
      setStudent(st);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
      setActive([]); setHistory([]); setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const resolveRfid = async () => {
    try {
      setError('');
      if (!rfid) { setError('Enter or scan an RFID number'); return; }
      const { data } = await api.get(`/rfid/resolve/${rfid}`);
      if (data?._id) {
        setStudentId(data._id);
        setStudent(data);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'RFID not found');
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

    // setup socket to refresh all scans on changes
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    socket.on('transaction:new', loadAllScans);
    socket.on('transaction:update', loadAllScans);
    socket.on('rfid:approved', loadAllScans);
    socket.on('rfid:pending', loadAllScans);
    return () => socket.disconnect();
  }, []);

  const borrowBook = async () => {
    try {
      setError('');
      if (!studentId) { setError('Enter Student ID (Mongo)'); return; }
      if (!borrowItemId) { setError('Select a book to borrow'); return; }
      // Step 1: create transaction pending
      const createRes = await api.post('/transactions', {
        student: studentId,
        item: borrowItemId,
        module: 'library',
        action: 'borrow',
        status: 'pending',
        notes: borrowNotes || undefined,
      });
      const txId = createRes.data?._id;
      if (txId) {
        // Step 2: approve to trigger inventory effects
        await api.put(`/transactions/${txId}`, { status: 'approved' });
      }
      setBorrowItemId(''); setBorrowNotes('');
      // Optionally refresh student data if a student is selected
      if (studentId || rfid) await loadData();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to borrow');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Library</h1>
          <Link to="/library/add" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Add Book</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-semibold mb-3">Borrow Book</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" placeholder="Student ID (Mongo)" value={studentId} onChange={e=>setStudentId(e.target.value)} />
              <select className="border rounded px-3 py-2" value={borrowItemId} onChange={e=>setBorrowItemId(e.target.value)}>
                <option value="">Select Book</option>
                {items.map(it => <option value={it._id} key={it._id}>{it.name} (qty {it.quantity})</option>)}
              </select>
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
              <label className="block text-sm text-gray-600 mb-1">RFID Number</label>
              <input value={rfid} onChange={e => setRfid(e.target.value)} placeholder="Scan or enter RFID"
                     className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Student ID (Mongo)</label>
              <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Optional"
                     className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <button onClick={resolveRfid} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded">Resolve RFID</button>
              <button onClick={loadData} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Search</button>
              <button onClick={() => { setRfid(''); setStudentId(''); setStudent(null); setActive([]); setHistory([]); setError(''); }}
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
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(({ item, count, last }, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{item?.name || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{(item?.topics || []).join(', ') || '-'}</td>
                        <td className="px-3 py-2">{count}</td>
                        <td className="px-3 py-2">{last ? new Date(last).toLocaleString() : '-'}</td>
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
            <h2 className="text-lg font-semibold">All Scans (Library)</h2>
            <button onClick={loadAllScans} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
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
                  {allHistory.map(row => (
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
    </div>
  );
}
