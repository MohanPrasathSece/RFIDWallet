import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { io } from 'socket.io-client';
import { useAuth } from '../shared/AuthContext.jsx';

export default function StudentDashboard() {
  const brandName = import.meta?.env?.VITE_BRAND_NAME || 'Greenfield College Cards';
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [profile, setProfile] = useState({ name: '', rfid_uid: '' });
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [initLoading, setInitLoading] = useState(true);
  const [showAllTx, setShowAllTx] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  const handleLogout = () => {
    try { logout(); } finally { navigate('/'); }
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
        setInitLoading(false);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load');
        setInitLoading(false);
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

  // Close profile menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Student Dashboard</h1>
            <p className="text-xs text-slate-500">Welcome to {brandName}</p>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v=>!v)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white grid place-items-center shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {(profile.name || 'ST').split(' ').map(s=>s[0]).slice(0,2).join('')}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-10">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); navigate('/student/profile'); }}>Profile</button>
                <div className="h-px bg-slate-100" />
                <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-200/30 blur-2xl" />
          <div className="absolute bottom-0 -left-10 w-60 h-60 rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="relative p-5 md:p-6">
            {initLoading ? (
              <div className="animate-pulse flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-slate-200 rounded" />
                  <div className="mt-2 h-3 w-56 bg-slate-200 rounded" />
                </div>
                <div className="h-8 w-28 bg-slate-200 rounded" />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white grid place-items-center font-semibold">
                    {profile.name ? profile.name.split(' ').map(s=>s[0]).slice(0,2).join('') : 'ST'}
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">{profile.name || '—'}</div>
                    <div className="text-xs font-mono text-slate-500">RFID: {profile.rfid_uid || '—'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Current Balance</div>
                  <div className="text-3xl font-semibold text-slate-800">₹ {balance?.toFixed(2)}</div>
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-3 items-center">
              <input className="input flex-1" type="number" placeholder="Add amount (₹)" value={amount} onChange={e=>setAmount(e.target.value)} />
              <button className="btn-primary whitespace-nowrap" onClick={handleAdd} disabled={loading}>
                {loading ? 'Processing…' : 'Add Funds'}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 flex items-center justify-between">
            <div className="text-lg font-medium text-slate-800">Quick Actions</div>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => navigate('/student/history')} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm text-left">
              <div className="font-medium">View History</div>
              <div className="text-xs text-slate-500">See all your transactions</div>
            </button>
            <button onClick={() => navigate('/student/profile')} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm text-left">
              <div className="font-medium">Profile</div>
              <div className="text-xs text-slate-500">Manage your profile and password</div>
            </button>
          </div>
        </div>

        {/* No modals here; profile and history are separate pages now */}
      </div>
    </div>
  );
}
