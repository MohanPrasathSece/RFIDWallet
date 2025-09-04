import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import { io } from 'socket.io-client';

export default function StudentDashboard() {
  const brandName = import.meta?.env?.VITE_BRAND_NAME || 'Greenfield College Cards';
  const [profile, setProfile] = useState({ name: '', rfid_uid: '' });
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    try {
      if (!currentPassword || !newPassword) throw new Error('Fill both fields');
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPwdMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
      setPwdMsg(e?.response?.data?.message || e.message || 'Failed to change password');
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const bal = await api.get('/wallet/balance');
        if (!mounted) return;
        setBalance(bal.data.balance || 0);
        setProfile({ name: bal.data.name, rfid_uid: bal.data.rfid_uid });
        const hist = await api.get('/wallet/history');
        if (!mounted) return;
        setHistory(hist.data || []);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load');
      }
    };

  // moved handleChangePassword to top-level so it can be used in the form
    load();

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    socket.on('wallet:updated', (p) => {
      setBalance(p?.balance ?? balance);
      // Refresh history best-effort
      api.get('/wallet/history').then(r => setHistory(r.data || [])).catch(() => {});
    });
    return () => { mounted = false; socket.disconnect(); };
  }, []);

  const handleAdd = async () => {
    try {
      setLoading(true);
      setError('');
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter a valid amount');
      const { data } = await api.post('/wallet/add', { amount: amt });
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: brandName,
        description: 'Wallet Top-up',
        order_id: data.orderId,
        handler: function () {
          // Webhook will update the balance; show a toast-like message
          alert('Payment initiated successfully. Balance will update shortly.');
        },
        prefill: {},
        notes: {},
        theme: { color: '#0ea5e9' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Student Dashboard</h1>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-gray-500">Student</div>
              <div className="font-medium">{profile.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">RFID UID</div>
              <div className="font-mono">{profile.rfid_uid}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Current Balance</div>
              <div className="text-2xl font-semibold">₹ {balance?.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="text-lg font-medium mb-3">Add Balance</div>
          <div className="flex gap-3 items-center">
            <input className="input" type="number" placeholder="Amount in INR" value={amount} onChange={e=>setAmount(e.target.value)} />
            <button className="btn-primary" onClick={handleAdd} disabled={loading}>
              {loading ? 'Processing...' : 'Add'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="text-lg font-medium mb-3">Transactions</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">Time</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Payment Id</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h._id} className="border-t">
                    <td className="py-2">{new Date(h.createdAt).toLocaleString()}</td>
                    <td className="py-2 capitalize">{h.type}</td>
                    <td className="py-2">{h.type === 'debit' ? '-' : '+'} ₹ {Number(h.amount).toFixed(2)}</td>
                    <td className="py-2">{h.razorpay_payment_id || '-'}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td className="py-4 text-gray-500" colSpan={4}>No transactions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4 mt-6">
          <div className="text-lg font-medium mb-3">Change Password</div>
          {pwdMsg && (
            <div className={`text-sm mb-2 ${pwdMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg}</div>
          )}
          <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <input className="input" type="password" placeholder="Current password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} />
            <input className="input" type="password" placeholder="New password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
            <button className="btn-primary" type="submit">Update</button>
          </form>
        </div>
      </div>
    </div>
  );
}
