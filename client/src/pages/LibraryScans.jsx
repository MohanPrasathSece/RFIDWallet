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
    <div className="h-screen bg-white dark:bg-gray-900 p-4 flex flex-col">
      <div className="w-full flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Library Transaction History</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Overview of all library activities</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Refresh</button>
            <Link to="/library" className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">Back to Library</Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 border border-red-200 dark:border-red-700 rounded text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden flex-grow flex flex-col bg-white dark:bg-gray-800">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-300">No transaction history.</div>
          ) : (
            <div className="overflow-auto flex-grow">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Item</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Student</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{row.item?.name || 'N/A'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{row.student?.name || 'N/A'}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 capitalize">{row.action}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        row.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        row.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          <p>Showing {rows.length} transactions.</p>
        </div>
      </div>
    </div>
  );
}
