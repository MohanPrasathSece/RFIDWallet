import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api';

export default function PendingApprovals() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/transactions?status=pending');
      setItems(data || []);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    load();
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    socket.on('rfid:pending', () => mounted && load());
    socket.on('transaction:update', () => mounted && load());
    socket.on('transaction:delete', () => mounted && load());
    return () => { mounted = false; socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/transactions/${id}`, { status });
      // Optimistic update: remove from list
      setItems(prev => prev.filter(x => x._id !== id));
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Update failed');
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Pending Approvals</h2>
        <button onClick={load} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
      </div>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">No pending requests.</div>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Module</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(tx => (
                <tr key={tx._id} className="border-t">
                  <td className="px-3 py-2">{new Date(tx.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 capitalize">{tx.module}</td>
                  <td className="px-3 py-2 capitalize">{tx.action}</td>
                  <td className="px-3 py-2">{tx.student?.name || tx.user?.name || '-'}</td>
                  <td className="px-3 py-2">{tx.item?.name || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{tx.notes || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(tx._id, 'approved')}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                        title="Approve"
                      >Approve</button>
                      <button
                        onClick={() => updateStatus(tx._id, 'rejected')}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                        title="Reject"
                      >Deny</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
