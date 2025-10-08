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
    <div className="h-screen bg-white p-4 flex flex-col">
      <div className="w-full flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Library Transaction History</h1>
            <p className="text-xs text-gray-500">Overview of all library activities</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Refresh</button>
            <Link to="/library" className="px-3 py-2 border rounded text-sm">Back to Library</Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 border rounded text-sm text-red-600 bg-red-50">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="border rounded overflow-hidden flex-grow flex flex-col">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-600">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-600">No transaction history.</div>
          ) : (
            <div className="overflow-auto flex-grow">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{row.item?.name || 'N/A'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{row.student?.name || 'N/A'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 capitalize">{row.action}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        row.status === 'approved' ? 'bg-green-100 text-green-800' :
                        row.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-gray-500">
          <p>Showing {rows.length} transactions.</p>
        </div>
      </div>
    </div>
  );
}
