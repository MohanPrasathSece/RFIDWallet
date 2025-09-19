import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../shared/api.js';

export default function LibraryScans() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true); setError('');
      const { data } = await api.get('/library/history-all');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load scans');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">All Scans (Library)</h1>
          <div className="flex items-center gap-2">
            <button onClick={load} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
            <Link to="/library" className="px-3 py-1.5 text-sm bg-white border rounded hover:bg-gray-50">Back to Library</Link>
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500">No scans yet.</div>
        ) : (
          <div className="overflow-x-auto bg-white rounded shadow">
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
                {rows.map((row) => (
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
