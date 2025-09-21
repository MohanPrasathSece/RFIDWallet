import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { io } from 'socket.io-client';
import { useAuth } from '../shared/AuthContext.jsx';

function StudentDashboard() {
  const brandName = import.meta?.env?.VITE_BRAND_NAME || 'Sri Eshwar College of Engineering';
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
        handler: async function (response) {
          // Verify signature server-side as per Standard Checkout integration
          try {
            await api.post('/wallet/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            alert('Payment successful. Balance will update shortly.');
          } catch (verr) {
            alert('Payment verification failed. If amount was deducted, it will be auto-refunded or updated via webhook.');
          }
        },
        prefill: { name: profile.name || 'Student' },
        notes: {},
        theme: { color: '#0ea5e9' },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setError(resp?.error?.description || 'Payment failed. Please try again.');
      });
      rzp.open();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  // Compute recent history (latest 3 entries) for a clean, minimal preview
  const recent = [...history]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50/40 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="College Logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
            <h1 className="text-3xl font-extrabold leading-tight text-green-700">
              {`Welcome, ${profile.name || 'Student'}`}
            </h1>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v=>!v)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white grid place-items-center shadow-md focus:outline-none focus:ring-2 focus:ring-green-300"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {(profile.name || 'ST').split(' ').map(s=>s[0]).slice(0,2).join('')}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-10">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); navigate('/student/profile'); }}>Profile</button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); navigate('/student/library'); }}>My Books</button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); navigate('/student/analytics'); }}>Analytics</button>
                <div className="h-px bg-slate-100" />
                <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-green-100 bg-white/80 backdrop-blur shadow-sm mb-6">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-green-100/70 blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-60 h-60 rounded-full bg-green-50/80 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/80 via-white/60 to-green-50/80 pointer-events-none" />
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white grid place-items-center font-semibold shadow">
                    {profile.name ? profile.name.split(' ').map(s=>s[0]).slice(0,2).join('') : 'ST'}
                  </div>
                  <div>
                    <div className="text-sm text-slate-800 font-medium">{profile.name || '—'}</div>
                    <div className="text-[11px] font-mono text-slate-500">RFID: {profile.rfid_uid || '—'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-[11px] text-green-700 ring-1 ring-green-200">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Balance
                  </div>
                  <div className="mt-1 text-3xl font-semibold text-slate-800">₹ {balance?.toFixed(2)}</div>
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2 items-center">
              <input className="input-sm rounded-xl flex-1 bg-white placeholder-slate-400 focus:ring-green-300" type="number" placeholder="Add amount (₹)" value={amount} onChange={e=>setAmount(e.target.value)} />
              <button className="rounded-xl whitespace-nowrap px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-60" onClick={handleAdd} disabled={loading}>
                {loading ? 'Processing…' : 'Add Funds'}
              </button>
            </div>
          </div>
        </div>

        {/* Minimal Recent Activity */}
        <div className="rounded-2xl border border-green-100 bg-white/80 backdrop-blur shadow-sm overflow-hidden">
          <div className="p-4 border-b border-green-100 text-slate-800 font-medium">Recent Activity</div>
          {initLoading ? (
            <div className="divide-y divide-green-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex items-center justify-between">
                  <div className="h-3 w-40 bg-slate-200 rounded" />
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No recent transactions</div>
          ) : (
            <div className="divide-y divide-green-100">
              {recent.map((row, i) => (
                <button
                  key={row._id || i}
                  onClick={() => {
                    if (row.type === 'debit' && (row.receiptId || row.module)) {
                      const id = row.receiptId || `single:${row._id}`;
                      navigate(`/student/purchase/${encodeURIComponent(id)}`);
                    }
                  }}
                  className={`w-full text-left p-4 flex items-center justify-between ${row.type==='debit' ? 'hover:bg-green-50/50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full grid place-items-center bg-green-50 text-sm">
                      {row.type === 'credit' ? '➕' : (row.module === 'food' ? '🍔' : row.module === 'store' ? '🛍️' : '🧾')}
                    </div>
                    <div>
                      <div className="text-sm text-slate-800">
                        {row.type === 'credit' ? 'Top-up' : (row.itemName || (row.module === 'store' ? 'Store' : row.module === 'food' ? 'Food Court' : 'Purchase'))}
                      </div>
                      <div className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${row.type === 'debit' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.type === 'debit' ? '-' : '+'} ₹ {Number(row.amount || 0).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="p-3 text-center">
            <button
              onClick={() => navigate('/student/history')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl ring-1 ring-green-200 bg-white hover:bg-green-50 text-slate-700 text-sm"
            >
              View full history
            </button>
          </div>
        </div>

        {/* No modals here; profile and history are separate pages now */}
      </div>
    </div>
  );
}

export default StudentDashboard;
