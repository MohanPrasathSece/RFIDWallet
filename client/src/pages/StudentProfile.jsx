import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api';

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Profile</h1>
            <p className="text-xs text-slate-500">Manage your details • {brandName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/student')} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm">Dashboard</button>
            <button onClick={() => { logout(); navigate('/'); }} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm">Logout</button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-200/30 blur-2xl" />
          <div className="absolute bottom-0 -left-10 w-60 h-60 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="relative p-5 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white grid place-items-center text-lg font-semibold shadow-md">
                {(name || 'ST').split(' ').map(s=>s[0]).slice(0,2).join('')}
              </div>
              <div>
                <div className="text-slate-800 font-medium">{name || 'Student'}</div>
                <div className="text-xs text-slate-500">{user?.rfid_uid ? `RFID: ${user.rfid_uid}` : ''}</div>
              </div>
            </div>

            {msg && (
              <div className={`mb-3 text-sm ${msg.toLowerCase().includes('success') ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</div>
            )}

            <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600">Full Name</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={name} onChange={e=>setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Email</label>
                <input className="w-full border rounded px-3 py-2 mt-1" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={()=>{ setName(user?.name || ''); setEmail(user?.email || ''); }} className="px-3 py-1.5 bg-gray-100 rounded">Reset</button>
                <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>

        {/* Change Password */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4 text-lg font-medium text-slate-800">Change Password</div>
          <div className="px-4 pb-4">
            {pwdMsg && (
              <div className={`text-sm mb-2 ${pwdMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg}</div>
            )}
            <form onSubmit={changePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <input className="input" type="password" placeholder="Current password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} />
              <input className="input" type="password" placeholder="New password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
              <button className="btn-primary" type="submit">Update</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
