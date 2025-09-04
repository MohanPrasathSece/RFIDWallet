import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api';
import EcoIcon from '../components/EcoIcon.jsx';

export default function StudentProfile() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const brandName = import.meta?.env?.VITE_BRAND_NAME || 'Greenfield College Cards';

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg('');
    setSaving(true);
    try {
      // Try update-profile if backend supports it; otherwise show friendly message
      await api.post('/auth/update-profile', { name, email });
      setUser({ ...(user || {}), name, email });
      setMsg('Profile updated successfully');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Profile update not available. Please contact Admin.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    try {
      if (!currentPassword || !newPassword) throw new Error('Fill both fields');
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPwdMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwdMsg(err?.response?.data?.message || err.message || 'Failed to change password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50/40 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <EcoIcon />
              <h1 className="text-2xl font-semibold text-slate-800">Profile</h1>
            </div>
            <p className="text-xs text-slate-500">Manage your details • {brandName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/student')} className="px-3 py-1.5 rounded-md border border-green-200 bg-white text-slate-700 hover:bg-green-50 shadow-sm text-sm">Dashboard</button>
            <button onClick={() => { logout(); navigate('/'); }} className="px-3 py-1.5 rounded-md border border-green-200 bg-white text-slate-700 hover:bg-green-50 shadow-sm text-sm">Logout</button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="relative overflow-hidden rounded-2xl border border-green-100 bg-white/80 backdrop-blur shadow-sm mb-6">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-green-100/60 blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-60 h-60 rounded-full bg-green-50/80 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/80 via-white/60 to-green-50/80 pointer-events-none" />
          <div className="relative p-4 md:p-5">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white grid place-items-center text-xl font-semibold shadow-md">
                {(name || 'ST').split(' ').map(s=>s[0]).slice(0,2).join('')}
              </div>
              <div className="mt-3">
                <div className="text-slate-800 font-medium text-sm">{name || 'Student'}</div>
                <div className="text-[11px] text-slate-500">{email || '—'}</div>
              </div>
            </div>

            {msg && (
              <div className={`mb-3 text-sm ${msg.toLowerCase().includes('success') ? 'text-green-700' : 'text-red-600'}`}>{msg}</div>
            )}

            <form onSubmit={saveProfile} className="space-y-2.5">
              <div>
                <label className="sr-only">Full Name</label>
                <input
                  className="input-sm rounded-xl bg-white placeholder-slate-400 focus:ring-2 focus:ring-green-300"
                  placeholder="What's your full name?"
                  value={name}
                  onChange={e=>setName(e.target.value)}
                />
              </div>
              <div>
                <label className="sr-only">Email</label>
                <input
                  className="input-sm rounded-xl bg-white placeholder-slate-400 focus:ring-2 focus:ring-green-300"
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={()=>{ setName(user?.name || ''); setEmail(user?.email || ''); }} className="flex-1 px-3 py-2 rounded-xl border border-green-200 bg-white text-slate-700 hover:bg-green-50 shadow-sm text-sm">Reset</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm disabled:opacity-60">{saving ? 'Saving…' : 'Update Profile'}</button>
              </div>
            </form>
          </div>
        </div>

        {/* Change Password */}
        <div className="rounded-2xl border border-green-100 bg-white/80 backdrop-blur shadow-sm">
          <div className="p-2.5">
            <div className="text-sm font-medium text-slate-800 flex items-center gap-2"><EcoIcon className="scale-90" /> Change Password</div>
            <p className="text-[10px] text-slate-500">Update your password securely.</p>
          </div>
          <div className="px-4 pb-4">
            {pwdMsg && (
              <div className={`text-sm mb-2 ${pwdMsg.toLowerCase().includes('success') ? 'text-green-700' : 'text-red-600'}`}>{pwdMsg}</div>
            )}
            <form onSubmit={changePassword} className="space-y-2">
              <input className="input-sm rounded-xl bg-white placeholder-slate-400 focus:ring-2 focus:ring-green-300 py-2 text-sm" type="password" placeholder="Current password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} />
              <input className="input-sm rounded-xl bg-white placeholder-slate-400 focus:ring-2 focus:ring-green-300 py-2 text-sm" type="password" placeholder="New password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
              <button className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white py-2 text-xs" type="submit">Update Password</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
