import { useState } from 'react';
import { useAuth } from '../shared/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  // Admin form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminShowPw, setAdminShowPw] = useState(false);

  // Student form state
  const [rollNo, setRollNo] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [studentShowPw, setStudentShowPw] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const onAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError('');
    try {
      const user = await login(adminEmail, adminPassword, 'admin');
      navigate('/admin');
    } catch (err) {
      setAdminError(err?.response?.data?.message || 'Admin login failed');
    } finally {
      setAdminLoading(false);
    }
  };

  const onStudentSubmit = async (e) => {
    e.preventDefault();
    setStudentLoading(true);
    setStudentError('');
    try {
      const user = await login(rollNo, studentPassword, 'student');
      navigate('/student');
    } catch (err) {
      setStudentError(err?.response?.data?.message || 'Student login failed');
    } finally {
      setStudentLoading(false);
    }
  };

  const demoEmail = import.meta?.env?.VITE_DEMO_ADMIN_EMAIL || '';
  const demoPassword = import.meta?.env?.VITE_DEMO_ADMIN_PASSWORD || '';
  const canShowDemo = Boolean(demoEmail);
  const brandName = import.meta?.env?.VITE_BRAND_NAME || 'Greenfield College Cards';

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Branding header */}
      <header className="sticky top-0 z-10 backdrop-blur border-b border-white/60 bg-white/70">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-emerald-500 text-white grid place-items-center font-bold">CC</div>
            <div>
              <div className="font-semibold leading-tight">{brandName}</div>
              <div className="text-[11px] text-slate-500 -mt-0.5">RFID Payments • Library • Store</div>
            </div>
          </div>
          <div className="text-xs text-slate-500 hidden md:block">Secure role-based access — Admin and Student</div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto min-h-[calc(100vh-56px)] grid grid-cols-1 md:grid-cols-2">
        {/* Left: Admin */}
        <div className="relative flex items-center justify-center p-8 md:p-12 overflow-hidden">
          {/* background gradient block */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/20 via-teal-400/10 to-emerald-600/20" />
          {/* decorative circles */}
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-emerald-400/20 blur-2xl" />
          <div className="absolute bottom-10 -right-10 w-56 h-56 rounded-full bg-teal-400/20 blur-2xl" />

          <div className="w-full max-w-md backdrop-blur-sm bg-white/85 border border-white/60 shadow-2xl rounded-2xl p-6 transition hover:shadow-[0_20px_50px_-20px_rgba(16,185,129,0.45)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-lg">⚙️</div>
              <div>
                <h2 className="text-2xl font-semibold text-emerald-900">For Admins</h2>
                <p className="text-xs text-emerald-700/80">Login to manage students, wallets, and POS.</p>
              </div>
            </div>

            {adminError && <div className="mt-3 text-red-600 text-sm">{adminError}</div>}

            <form onSubmit={onAdminSubmit} className="mt-4">
              <label className="text-xs font-medium text-emerald-900/80">Admin Email</label>
              <input className="input mt-1 focus:ring-2 focus:ring-emerald-400" placeholder="admin@college.edu" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} />
              <label className="text-xs font-medium text-emerald-900/80 mt-3 block">Password</label>
              <div className="relative mt-1">
                <input className="input pr-10 focus:ring-2 focus:ring-emerald-400" type={adminShowPw ? 'text' : 'password'} placeholder="••••••••" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} />
                <button type="button" onClick={()=>setAdminShowPw(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-700/80 hover:text-emerald-900">
                  {adminShowPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-emerald-800/70">Signup is disabled. Admins are provisioned from backend.</p>
                {canShowDemo && (
                  <button type="button" onClick={()=>{ setAdminEmail(demoEmail); if (demoPassword) setAdminPassword(demoPassword); }} className="text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Use example</button>
                )}
              </div>
              <button className="w-full mt-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition disabled:opacity-60 active:scale-[.99]" disabled={adminLoading}>
                {adminLoading ? 'Logging in...' : 'Login as Admin'}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Student */}
        <div className="relative flex items-center justify-center p-8 md:p-12 overflow-hidden">
          {/* background gradient block */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/20 via-fuchsia-400/10 to-purple-600/20" />
          {/* decorative circles */}
          <div className="absolute -top-12 right-6 w-48 h-48 rounded-full bg-indigo-400/20 blur-2xl" />
          <div className="absolute bottom-6 -left-10 w-56 h-56 rounded-full bg-fuchsia-400/20 blur-2xl" />

          <div className="w-full max-w-md backdrop-blur-sm bg-white/85 border border-white/60 shadow-2xl rounded-2xl p-6 transition hover:shadow-[0_20px_50px_-20px_rgba(99,102,241,0.45)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg">🎓</div>
              <div>
                <h2 className="text-2xl font-semibold text-indigo-900">For Students</h2>
                <p className="text-xs text-indigo-800/80">Login to view wallet, transactions and library.</p>
              </div>
            </div>

            {studentError && <div className="mt-3 text-red-600 text-sm">{studentError}</div>}

            <form onSubmit={onStudentSubmit} className="mt-4">
              <label className="text-xs font-medium text-indigo-900/80">Roll Number</label>
              <input className="input mt-1 focus:ring-2 focus:ring-indigo-400" placeholder="e.g., 20CS123" value={rollNo} onChange={e=>setRollNo(e.target.value)} />
              <label className="text-xs font-medium text-indigo-900/80 mt-3 block">Password</label>
              <div className="relative mt-1">
                <input className="input pr-10 focus:ring-2 focus:ring-indigo-400" type={studentShowPw ? 'text' : 'password'} placeholder="••••••••" value={studentPassword} onChange={e=>setStudentPassword(e.target.value)} />
                <button type="button" onClick={()=>setStudentShowPw(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-700/80 hover:text-indigo-900">
                  {studentShowPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-indigo-900/70">Accounts are created by Admin. No public signup.</p>
                <span className="text-[11px] text-indigo-900/50">Need help? Contact Admin</span>
              </div>
              <button className="w-full mt-4 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition disabled:opacity-60 active:scale-[.99]" disabled={studentLoading}>
                {studentLoading ? 'Logging in...' : 'Login as Student'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
