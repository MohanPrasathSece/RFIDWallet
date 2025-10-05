import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useLocation } from 'react-router-dom';

export default function StoreHistory() {
  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => {
    // Accept rollNo or student id via query string
    const params = new URLSearchParams(location.search);
    const rollNo = params.get('rollNo');
    const s = params.get('student');
    (async () => {
      try {
        if (rollNo) {
          setError('');
          setLoading(true);
          const { data } = await api.get('/students/find', { params: { rollNo } });
          setStudentId(data?._id || '');
          if (data?._id) {
            const res = await api.get('/store/history', { params: { student: data._id } });
            setHistory(res.data || []);
          }
        } else if (s) {
          setStudentId(s);
          setError('');
          setLoading(true);
          const res = await api.get('/store/history', { params: { student: s } });
          setHistory(res.data || []);
        }
      } catch (e) {
        setError(e?.response?.data?.message || e.message || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    })();
  }, [location.search]);

  const resolveStudentId = async (value) => {
    // If value looks like a Mongo ObjectId, use directly; otherwise treat as rollNo
    const isObjectId = /^[a-f\d]{24}$/i.test(value);
    if (isObjectId) return value;
    const { data } = await api.get('/students/find', { params: { rollNo: value } });
    return data?._id;
  };

  const loadHistory = async () => {
    if (!studentId) { setError('Enter roll number or student id to load history'); return; }
    try {
      setLoading(true); setError('');
      const id = await resolveStudentId(studentId);
      if (!id) throw new Error('Student not found');
      const res = await api.get('/store/history', { params: { student: id } });
      setHistory(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load history');
      setHistory([]);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Store Purchase History</h1>
        <div className="flex gap-2">
          <Link to="/store" className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">Back to Store</Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Roll No or Student Id</label>
            <input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Enter roll number or student _id"
                   className="w-full border rounded px-3 py-2" />
          </div>
          <button className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded" onClick={loadHistory} disabled={loading}>
            {loading ? 'Loading...' : 'Load History'}
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="bg-white p-4 rounded shadow">
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
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row._id} className="border-t">
                    <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 capitalize">{row.action}</td>
                    <td className="px-3 py-2">{row.item?.name || '-'}</td>
                    <td className="px-3 py-2">{row.student?.name || '-'}</td>
                    <td className="px-3 py-2">{row.student?.rfid || row.student?.rfid_uid || '-'}</td>
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
