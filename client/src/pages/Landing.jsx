import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../shared/AuthContext.jsx';

export default function Landing() {
  const { login, logout, token } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showStudent, setShowStudent] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [studentRoll, setStudentRoll] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  const cardBase =
    'relative rounded-2xl border border-green-100 bg-white/90 shadow-sm overflow-hidden transition-all duration-300 ease-out';
  const cardHover =
    'hover:shadow-lg hover:-translate-y-0.5 hover:border-green-200';
  const pillIcon =
    'inline-flex items-center justify-center h-9 w-9 rounded-full bg-green-500 text-white shadow-sm';
  const ctaBtn =
    'mt-3 inline-flex items-center justify-center w-full rounded-lg bg-green-500 text-white font-medium py-2 text-sm transition-all duration-200 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2';

  const onAdminSubmit = async (e) => {
    e?.preventDefault?.();
    try {
      setAdminLoading(true); setAdminError('');
      await login(adminEmail, adminPassword, 'admin');
      setShowAdmin(false);
      navigate('/admin');
    } catch (err) {
      setAdminError(err?.response?.data?.message || 'Admin login failed');
    } finally { setAdminLoading(false); }
  };

  const onStudentLogout = async () => {
    try {
      await logout();
    } finally {
      setShowStudent(false);
      setStudentRoll('');
      setStudentPassword('');
    }
  };

  const onStudentSubmit = async (e) => {
    e?.preventDefault?.();
    try {
      setStudentLoading(true); setStudentError('');
      await login(studentRoll, studentPassword, 'student');
      setShowStudent(false);
      navigate('/student');
    } catch (err) {
      setStudentError(err?.response?.data?.message || 'Student login failed');
    } finally { setStudentLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className={`relative px-6 pt-12 pb-8 mx-auto max-w-3xl text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white shadow-sm border border-green-100">
          <span className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-green-500 text-white">🍃</span>
          <span className="text-sm font-medium text-green-700">EcoCollege Portal</span>
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-green-700">EcoCollege Portal</h1>
        <p className="mt-2 text-sm text-green-700/70">Smart • Secure • Sustainable</p>
        {token && (
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="absolute right-6 top-6 text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-700 bg-white/90 hover:bg-green-50 shadow-sm"
          >
            Logout
          </button>
        )}
      </header>

      {/* Body */}
      <main className={`flex-1 px-6 pb-12 mx-auto max-w-3xl w-full transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <section className="text-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Choose Your Portal</h2>
          <p className="text-gray-500">Select your access level below</p>
        </section>

        <div className="space-y-6">
          {/* Admin Card */}
          <div className={`${cardBase} ${cardHover}`}>
            {/* Decorative corner */}
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-3xl bg-green-50 border border-green-100" />
            <div className="p-5 md:p-6">
              <div className="flex items-start gap-3">
                <span className={pillIcon}>🛡️</span>
                <div className="text-left">
                  <h3 className="text-lg md:text-xl font-semibold text-gray-800">Admin Portal</h3>
                  <p className="text-gray-500">Manage users, transactions, and system analytics</p>
                </div>
              </div>
              <button onClick={() => setShowAdmin(true)} className={ctaBtn}>
                Login as Admin
              </button>
            </div>
          </div>

          {/* Student Card */}
          <div className={`${cardBase} ${cardHover}`}>
            {/* Decorative corner */}
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-3xl bg-green-50 border border-green-100" />
            <div className="p-5 md:p-6">
              <div className="flex items-start gap-3">
                <span className={pillIcon}>👥</span>
                <div className="text-left">
                  <h3 className="text-lg md:text-xl font-semibold text-gray-800">Student Portal</h3>
                  <p className="text-gray-500">Check balance, recharge, and make RFID payments</p>
                </div>
              </div>
              <button onClick={() => setShowStudent(true)} className={ctaBtn}>
                Login as Student
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Admin Login Modal */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Admin Login</h3>
              <button className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setShowAdmin(false)}>Close</button>
            </div>
            {adminError && <div className="text-red-600 text-sm mb-2">{adminError}</div>}
            <form onSubmit={onAdminSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600">Email</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@college.edu" />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Password</label>
                <input className="w-full border rounded px-3 py-2 mt-1" type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" className="px-3 py-1.5 bg-gray-100 rounded" onClick={()=>setShowAdmin(false)}>Cancel</button>
                <button type="submit" disabled={adminLoading} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">{adminLoading ? 'Logging in...' : 'Login'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Login Modal */}
      {showStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Student Login</h3>
              <button className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setShowStudent(false)}>Close</button>
            </div>
            {studentError && <div className="text-red-600 text-sm mb-2">{studentError}</div>}
            <form onSubmit={onStudentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600">Roll Number</label>
                <input className="w-full border rounded px-3 py-2 mt-1" value={studentRoll} onChange={e=>setStudentRoll(e.target.value)} placeholder="e.g., 20CS123" />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Password</label>
                <input className="w-full border rounded px-3 py-2 mt-1" type="password" value={studentPassword} onChange={e=>setStudentPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" className="px-3 py-1.5 bg-gray-100 rounded" onClick={()=>setShowStudent(false)}>Cancel</button>
                <button type="submit" disabled={studentLoading} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60">{studentLoading ? 'Logging in...' : 'Login'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`px-6 pb-8 mx-auto max-w-3xl text-center text-gray-500 text-sm transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        © {new Date().getFullYear()} EcoCollege Portal • Secure & Reliable
      </footer>
    </div>
  );
}
