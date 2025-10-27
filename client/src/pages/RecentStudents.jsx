import AdminLayout from '../shared/ui/AdminLayout.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api.js';

export default function RecentStudents() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [walletInputs, setWalletInputs] = useState({});
  const [search, setSearch] = useState('');
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const loadStudents = async () => {
    try {
      const res = await api.get('/admin/students');
      setStudents(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    }
  };

  useEffect(() => { loadStudents(); }, []);

  const deposit = async (id) => {
    try {
      setError('');
      const amt = Number(walletInputs[id] || 0);
      if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
      await api.post('/admin/wallet/deposit', { studentId: id, amount: amt });
      await loadStudents();
      setWalletInputs(v => ({ ...v, [id]: '' }));
    } catch (e) { setError(e?.response?.data?.message || e.message || 'Failed to deposit'); }
  };

  const withdraw = async (id) => {
    try {
      setError('');
      const amt = Number(walletInputs[id] || 0);
      if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
      await api.post('/admin/wallet/withdraw', { studentId: id, amount: amt });
      await loadStudents();
      setWalletInputs(v => ({ ...v, [id]: '' }));
    } catch (e) { setError(e?.response?.data?.message || e.message || 'Failed to withdraw'); }
  };

    <AdminLayout title="">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, roll no, RFID, dept" className="border rounded px-3 py-2 w-72 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
              <button onClick={loadStudents} className="px-3 py-2 text-sm bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded dark:bg-gray-700 dark:text-green-400 dark:border-green-600 dark:hover:bg-gray-600">Refresh</button>
            </div>
            {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
          </div>

          <div className="bg-white rounded border border-green-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <div className="w-full overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Roll No</th>
                  <th className="px-3 py-2 text-left">RFID</th>
                  <th className="px-3 py-2 text-left">Dept</th>
                  <th className="px-3 py-2 text-left">Modules</th>
                  <th className="px-3 py-2 text-left">Wallet</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Deposit</th>
                  <th className="px-3 py-2 text-left">Withdraw</th>
                  <th className="px-3 py-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter(s => {
                    if (!search) return true;
                    const t = search.toLowerCase();
                    return (
                      (s.name || '').toLowerCase().includes(t) ||
                      (s.rollNo || '').toLowerCase().includes(t) ||
                      (s.rfid_uid || '').toLowerCase().includes(t) ||
                      (s.department || '').toLowerCase().includes(t)
                    );
                  })
                  .slice()
                  .sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                  .map(s => (
                    <tr key={s._id} className="border-t dark:border-gray-600">
                      <td className="px-3 py-2 dark:text-white">{s.name}</td>
                      <td className="px-3 py-2 dark:text-gray-300">{s.rollNo || '-'}</td>
                      <td className="px-3 py-2 dark:text-gray-300">{s.rfid_uid || '-'}</td>
                      <td className="px-3 py-2 dark:text-gray-300">{s.department || '-'}</td>
                      <td className="px-3 py-2 dark:text-gray-300">{Array.isArray(s.modules) && s.modules.length ? s.modules.join(', ') : '-'}</td>
                      <td className="px-3 py-2 dark:text-gray-300">₹{s.walletBalance ?? 0}</td>
                      <td className="px-3 py-2"><input type="number" className="w-28 border rounded px-2 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600" placeholder="Amount" value={walletInputs[s._id] || ''} onChange={e=>setWalletInputs(v=>({...v,[s._id]:e.target.value}))} /></td>
                      <td className="px-3 py-2"><button onClick={()=>deposit(s._id)} className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded dark:bg-green-700 dark:hover:bg-green-800">Deposit</button></td>
                      <td className="px-3 py-2"><button onClick={()=>withdraw(s._id)} className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded border border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-600 dark:hover:bg-green-800">Withdraw</button></td>
                      <td className="px-3 py-2 dark:text-gray-300">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
    </AdminLayout>
}

