import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../shared/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { FaShieldAlt, FaUserGraduate } from 'react-icons/fa';

export default function Landing() {
  const { login, logout, token } = useAuth();
  const navigate = useNavigate();
  const brandName = import.meta?.env?.VITE_BRAND_NAME || 'EcoCollege Portal';
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
  const [currentFeature, setCurrentFeature] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    { tag: 'SP', title: 'Smart Payments', desc: 'Contactless RFID transactions' },
    { tag: 'SW', title: 'Secure Wallet', desc: 'Advanced encryption & security' },
    { tag: 'RA', title: 'Real-time Analytics', desc: 'Track spending & insights' }
  ];

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

  // Hoisted to avoid "Cannot access before initialization" when rendering student screen
  async function onStudentSubmit(e) {
    e?.preventDefault?.();
    try {
      setStudentLoading(true); setStudentError('');
      await login(studentRoll, studentPassword, 'student');
      setShowStudent(false);
      navigate('/student');
    } catch (err) {
      setStudentError(err?.response?.data?.message || 'Student login failed');
    } finally { setStudentLoading(false); }
  }

  // Centered modals are rendered below in the JSX

  const onStudentLogout = async () => {
    try {
      await logout();
    } finally {
      setShowStudent(false);
      setStudentRoll('');
      setStudentPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 font-sans antialiased flex flex-col">
      
      {/* Main Content - Mobile First Design */}
      <main className="flex-1 flex flex-col items-center justify-start px-6 py-8 max-w-md mx-auto w-full">
        
        {/* Header with Logo and Title */}
        <div className="w-full mb-8">
          <div className="flex items-start gap-3 mb-6">
            <BrandLogo size={48} rounded={false} />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-green-800 leading-tight">RFID Wallet</h1>
              <p className="text-sm text-green-600 font-medium">Digital Payment System</p>
            </div>
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm border border-green-200 mb-6">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          <span className="text-xs font-semibold text-green-700">{brandName}</span>
        </div>

        {/* Main Title */}
        <div className="text-center mb-9">
          <h2 className="text-3xl font-bold text-green-800 mb-2">{brandName}</h2>
          <p className="text-green-600 text-sm font-medium">Smart • Secure • Sustainable</p>
        </div>

        {/* Portal Cards */}
        <div className="w-full space-y-4">
          
          {/* Admin Portal Card */}
          <div className="bg-white rounded-lg shadow-md border border-green-100 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3 mb-2.5">
                <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaShieldAlt className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 mb-0.5">Admin Portal</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Manage users, transactions, and system analytics</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdmin(true)}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Login as Admin
              </button>
            </div>
          </div>

          {/* Student Portal Card */}
          <div className="bg-white rounded-lg shadow-md border border-green-100 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3 mb-2.5">
                <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaUserGraduate className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 mb-0.5">Student Portal</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Check balance, recharge, and make RFID payments</p>
                </div>
              </div>
              <button
                onClick={() => setShowStudent(true)}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Login as Student
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Admin Login Modal */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-green-900/20 grid place-items-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-800">Admin Login</h3>
              </div>
              <button className="text-green-600 hover:text-green-800 transition-colors" onClick={() => setShowAdmin(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {adminError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="text-red-600 text-sm">{adminError}</div>
              </div>
            )}
            <form onSubmit={onAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Email Address</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                  value={adminEmail} 
                  onChange={e=>setAdminEmail(e.target.value)} 
                  placeholder="admin@example.com"
                  type="email"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Password</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                  type="password" 
                  value={adminPassword} 
                  onChange={e=>setAdminPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  className="px-6 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-all duration-200" 
                  onClick={()=>setShowAdmin(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={adminLoading} 
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                >
                  {adminLoading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Login Modal */}
      {showStudent && (
        <div className="fixed inset-0 z-50 bg-green-900/20 grid place-items-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-800">Student Login</h3>
              </div>
              <button className="text-green-600 hover:text-green-800 transition-colors" onClick={() => setShowStudent(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {studentError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="text-red-600 text-sm">{studentError}</div>
              </div>
            )}
            <form onSubmit={onStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Roll Number</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                  value={studentRoll} 
                  onChange={e=>setStudentRoll(e.target.value)} 
                  placeholder="e.g., 20CS123" 
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2">Password</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                  type="password" 
                  value={studentPassword} 
                  onChange={e=>setStudentPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  className="px-6 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-all duration-200" 
                  onClick={()=>setShowStudent(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={studentLoading} 
                  className="px-6 py-2 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                >
                  {studentLoading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
