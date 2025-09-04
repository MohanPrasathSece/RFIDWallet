import Sidebar from '../shared/Sidebar.jsx';
import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';

export default function Store() {
  const [rfid, setRfid] = useState('');
  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState(null);

  const loadHistory = async () => {
    try {
      setLoading(true); setError('');
      const params = studentId ? { student: studentId } : (rfid ? { rfidNumber: rfid } : null);
      if (!params) { setError('Enter Student ID or RFID Number'); setHistory([]); return; }
      const res = await api.get('/store/history', { params });
      setHistory(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
      setHistory([]);
    } finally { setLoading(false); }
  };

  const loadAllScans = async () => {
    try {
      const { data } = await api.get('/store/history-all');
      setAllHistory(data || []);
    } catch (_) {}
  };

  const resolveRfid = async () => {
    try {
      setError('');
      if (!rfid) { setError('Enter or scan an RFID number'); return; }
      const { data } = await api.get(`/rfid/resolve/${rfid}`);
      if (data?._id) {
        setStudentId(data._id);
        if (data.walletBalance !== undefined) setWalletBalance(data.walletBalance);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'RFID not found');
    }
  };

  const orderItem = async (itemId) => {
    try {
      setError('');
      let sid = studentId;
      if (!sid && rfid) {
        try {
          const { data } = await api.get(`/rfid/resolve/${rfid}`);
          sid = data?._id; if (sid) setStudentId(sid);
        } catch (_) { setError('Could not resolve RFID to a student'); return; }
      }
      if (!sid) { setError('Select a student first'); return; }
      const res = await api.post('/transactions', {
        student: sid,
        item: itemId,
        module: 'store',
        action: 'purchase',
        status: 'approved',
      });
      if (res?.data?._id) {
        await Promise.all([loadHistory(), loadAllScans()]);
        // Refresh wallet
        try {
          const { data: s } = await api.get(`/admin/students/${sid}`);
          if (s?.walletBalance !== undefined) setWalletBalance(s.walletBalance);
        } catch (_) {}
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to place order');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/items', { params: { type: 'store' } });
        setItems(data || []);
      } catch (_) {}
    })();
    loadAllScans();
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const onEvent = () => {
      loadAllScans();
      if (studentId || rfid) loadHistory();
    };
    socket.on('transaction:new', onEvent);
    socket.on('transaction:update', onEvent);
    socket.on('rfid:approved', onEvent);
    socket.on('rfid:pending', onEvent);
    return () => socket.disconnect();
  }, [studentId, rfid]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Store</h1>
          <Link to="/store/add" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Add Store Item</Link>
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
              <button onClick={resolveRfid} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Resolve RFID</button>
              <button onClick={loadHistory} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded">Load History</button>
            </div>
            {loading && <div className="text-gray-500">Loading...</div>}
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          {(studentId || rfid) && (
            <div className="mt-3 text-sm text-gray-700">
              <span className="font-medium">Wallet Balance:</span> {walletBalance === null ? '—' : `₹${walletBalance}`}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Order Item</h2>
            <span className="text-sm text-gray-500">{(studentId || rfid) ? 'Ready to order' : 'Enter RFID or Student ID to order'}</span>
          </div>
          {items.length === 0 ? (
            <div className="text-gray-500">No store items yet. Use "Add Store Item" to create some.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(it => (
                <div key={it._id} className="border rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-sm text-gray-600">₹{it.price ?? '-'} · Qty {it.quantity ?? 0}</div>
                  </div>
                  <button disabled={!studentId && !rfid}
                          onClick={() => orderItem(it._id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-60">
                    Order
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Purchase History</h2>
            <button onClick={loadHistory} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
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
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">RFID</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row._id} className="border-t">
                      <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{row.action}</td>
                      <td className="px-3 py-2">{row.item?.name || '-'}</td>
                      <td className="px-3 py-2">{row.student?.name || '-'}</td>
                      <td className="px-3 py-2">{row.student?.rfid || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{row.notes || '-'}</td>
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
