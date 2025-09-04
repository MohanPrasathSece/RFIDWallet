import Sidebar from '../shared/Sidebar.jsx';
import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link } from 'react-router-dom';

export default function FoodScans() {
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAllScans = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/food/history-all');
      setAllHistory(data || []);
    } catch (_) {
      setAllHistory([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAllScans(); }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">All Scans (Food)</h1>
          <div className="flex gap-2">
            <button onClick={loadAllScans} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded" disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <Link to="/food" className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">Back to Food</Link>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          {allHistory.length === 0 ? (
            <div className="text-gray-500">No scans yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">RFID</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allHistory.map(row => (
                    <tr key={row._id} className="border-t">
                      <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{row.item?.name || '-'}</td>
                      <td className="px-3 py-2 text-right">₹ {Number(row.item?.price ?? 0).toFixed(2)}</td>
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
