import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useParams } from 'react-router-dom';

export default function Scans() {
  const { module } = useParams(); // 'library', 'food', or 'store'
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadScans = async () => {
    try {
      setLoading(true);
      let endpoint;
      if (module === 'library') {
        endpoint = '/library/history-all';
      } else if (module === 'food') {
        endpoint = '/food/history-all';
      } else if (module === 'store') {
        endpoint = '/store/history-all';
      } else {
        setHistory([]);
        return;
      }

      const { data } = await api.get(endpoint);
      setHistory(data || []);
    } catch (_) {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (module) loadScans();
  }, [module]);

  const isLibrary = module === 'library';
  const isFood = module === 'food';
  const isStore = module === 'store';

  const getBackLink = () => {
    if (isLibrary) return '/library';
    if (isFood) return '/food';
    if (isStore) return '/store';
    return '/';
  };

  const getBackText = () => {
    if (isLibrary) return 'Back to Library';
    if (isFood) return 'Back to Food';
    if (isStore) return 'Back to Store';
    return 'Back';
  };

  const getTitle = () => {
    const moduleName = isLibrary ? 'Library' : isFood ? 'Food' : 'Store';
    return `All Scans (${moduleName})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{getTitle()}</h1>
        <div className="flex gap-2">
          <button onClick={loadScans} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <Link to={getBackLink()} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">
            {getBackText()}
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        {history.length === 0 ? (
          <div className="text-gray-500">No scans yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  {(isLibrary || isStore) && <th className="px-3 py-2 text-left">Action</th>}
                  <th className="px-3 py-2 text-left">Item</th>
                  {isFood && <th className="px-3 py-2 text-right">Amount</th>}
                  <th className="px-3 py-2 text-left">Student</th>
                  <th className="px-3 py-2 text-left">RFID</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row._id} className="border-t">
                    <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    {(isLibrary || isStore) && <td className="px-3 py-2 capitalize">{row.action}</td>}
                    <td className="px-3 py-2">{row.item?.name || '-'}</td>
                    {isFood && <td className="px-3 py-2 text-right">₹ {Number(row.item?.price ?? 0).toFixed(2)}</td>}
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
