import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../shared/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';

export default function Landing() {
  const { login, logout, token } = useAuth();
  const navigate = useNavigate();
  const brandName = import.meta?.env?.VITE_BRAND_NAME || 'CamCards';
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
    { icon: '💳', title: 'Smart Payments', desc: 'Contactless RFID transactions' },
    { icon: '🔒', title: 'Secure Wallet', desc: 'Advanced encryption & security' },
    { icon: '📊', title: 'Real-time Analytics', desc: 'Track spending & insights' }
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
    <div className="min-h-[100dvh] bg-gradient-to-br from-white to-green-50 font-sans antialiased overflow-y-auto lg:overflow-hidden flex flex-col relative dark:from-gray-900 dark:to-gray-800 dark:text-white">
      {/* Background Image (from public/bgimage.jpg) */}
      <div
        className="absolute inset-0 bg-[url('/white_bg.png')] bg-cover bg-center opacity-70 dark:opacity-50"
        aria-hidden="true"
      ></div>
      {/* Background (light green with white) */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/90 to-green-50/80 dark:from-gray-900/90 dark:to-gray-800/80"></div>
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob dark:bg-green-900/30"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-300 rounded-full mix-blend-multiply filter blur-xl opacity-25 animate-blob animation-delay-2000 dark:bg-green-800/40"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-green-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000 dark:bg-green-900/50"></div>
      </div>

      {/* Navigation - Desktop Only */}
      <nav className={`hidden lg:flex relative z-10 items-center justify-between px-4 py-2 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center space-x-2">
          <BrandLogo size={80} rounded={false} />
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        
        {/* Mobile Layout - Simplified Old Design */}
        <div className="lg:hidden flex-1 flex flex-col px-4 py-4">
          {/* Brand in Top Left */}
          <div className="flex items-center mb-4">
            <BrandLogo size={60} className="mr-3" rounded={false} />
          </div>

          {/* Main Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-green-700 mb-2 dark:text-green-400">Cashless Payments Portal</h1>
            <p className="text-green-600 text-sm dark:text-green-500">Smart • Secure • Seamless</p>
          </div>

          {/* Portal Links */}
          <div className="space-y-4 max-w-sm mx-auto w-full">
            {/* Admin Portal */}
            <div className="bg-white p-4 rounded border dark:bg-gray-800 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Admin Portal</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage students & transactions</p>
                </div>
                <Link
                  to="/login"
                  className="px-4 py-2 bg-blue-500 text-white rounded text-sm dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  Login
                </Link>
              </div>
            </div>

            {/* Student Portal */}
            <div className="bg-white p-4 rounded border dark:bg-gray-800 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Student Portal</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Check balance & transactions</p>
                </div>
                <Link
                  to="/student"
                  className="px-4 py-2 bg-green-500 text-white rounded text-sm dark:bg-green-600 dark:hover:bg-green-700"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Left Side - Hero Content */}
        <div className={`hidden lg:flex flex-1 flex-col justify-center px-4 xl:px-6 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
          <div className="max-w-md">
            <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-50 to-white backdrop-blur-sm rounded-full border border-green-300 mb-1 shadow-md dark:from-gray-800 dark:to-gray-700 dark:border-gray-600">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              <span className="text-green-700 text-sm font-semibold dark:text-green-400">{brandName}</span>
            </div>
            
            <h1 className="text-3xl font-bold text-green-800 mb-3 leading-tight dark:text-green-300">
              Next-Gen
              <span className="block bg-gradient-to-r from-green-500 via-green-600 to-green-700 bg-clip-text text-transparent dark:from-green-400 dark:via-green-500 dark:to-green-600">
                Digital Wallet
              </span>
            </h1>
            
            <p className="text-lg text-green-700 mb-4 leading-relaxed font-medium dark:text-green-300">
              Experience the future of campus payments with our secure RFID-enabled digital wallet system. 
              Fast, secure, and seamlessly integrated.
            </p>

            {/* Animated Feature Showcase */}
            <div className="bg-gradient-to-r from-white to-green-50 backdrop-blur-sm rounded-xl p-4 border border-green-200 mb-4 shadow-lg hover:shadow-xl transition-all duration-300 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600">
              <div className="flex items-center space-x-4 mb-3">
                <div className="text-3xl p-2 bg-green-100 rounded-lg dark:bg-green-900/30">{features[currentFeature].icon}</div>
                <div>
                  <h3 className="text-green-800 font-bold text-base dark:text-green-300">{features[currentFeature].title}</h3>
                  <p className="text-green-600 text-sm font-medium dark:text-green-400">{features[currentFeature].desc}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                {features.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      index === currentFeature ? 'bg-green-500 w-8' : 'bg-green-200 w-2 dark:bg-green-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center bg-gradient-to-b from-white to-green-50 backdrop-blur-sm rounded-xl p-3 border border-green-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600">
                <div className="text-lg font-bold text-green-800 dark:text-green-300">99.9%</div>
                <div className="text-green-600 text-sm font-medium dark:text-green-400">Uptime</div>
              </div>
              <div className="text-center bg-gradient-to-b from-white to-green-50 backdrop-blur-sm rounded-xl p-3 border border-green-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600">
                <div className="text-lg font-bold text-green-800 dark:text-green-300">5000+</div>
                <div className="text-green-600 text-sm font-medium dark:text-green-400">Students</div>
              </div>
              <div className="text-center bg-gradient-to-b from-white to-green-50 backdrop-blur-sm rounded-xl p-3 border border-green-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600">
                <div className="text-lg font-bold text-green-800 dark:text-green-300">24/7</div>
                <div className="text-green-600 text-sm font-medium dark:text-green-400">Support</div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Right Side - Login Portals */}
        <div className={`hidden lg:flex flex-1 flex-col justify-center px-8 xl:px-12 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
          <div className="max-w-sm mx-auto w-full space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-green-800 mb-1 dark:text-green-300">Access Portal</h2>
              <p className="text-green-600 text-sm dark:text-green-400">Choose your login method</p>
            </div>

            {/* Admin Portal Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-400 to-green-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt dark:from-green-600 dark:to-green-700"></div>
              <div className="relative bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-green-200 shadow-lg dark:bg-gray-800/90 dark:border-gray-600">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md dark:from-green-600 dark:to-green-700">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">Admin Portal</h3>
                    <p className="text-green-600 text-sm dark:text-green-400">System management & analytics</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAdmin(true)}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 shadow-md text-sm dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800"
                >
                  Admin Login
                </button>
              </div>
            </div>

            {/* Student Portal Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-300 to-green-400 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt dark:from-green-500 dark:to-green-600"></div>
              <div className="relative bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-green-200 shadow-lg dark:bg-gray-800/90 dark:border-gray-600">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-green-500 rounded-lg flex items-center justify-center shadow-md dark:from-green-500 dark:to-green-600">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">Student Portal</h3>
                    <p className="text-green-600 text-sm dark:text-green-400">Wallet & payment management</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStudent(true)}
                  className="w-full bg-gradient-to-r from-green-400 to-green-500 text-white font-semibold py-2.5 px-4 rounded-lg hover:from-green-500 hover:to-green-600 transition-all duration-300 transform hover:scale-105 shadow-md text-sm dark:from-green-500 dark:to-green-600 dark:hover:from-green-600 dark:hover:to-green-700"
                >
                  Student Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Admin Login Modal */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-green-900/20 grid place-items-center p-4 dark:bg-black/50">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-green-200 dark:bg-gray-800 dark:border-gray-600">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center dark:from-green-600 dark:to-green-700">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-800 dark:text-green-300">Admin Login</h3>
              </div>
              <button className="text-green-600 hover:text-green-800 transition-colors dark:text-green-400 dark:hover:text-green-300" onClick={() => setShowAdmin(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {adminError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 dark:bg-red-900/20 dark:border-red-700">
                <div className="text-red-600 text-sm dark:text-red-400">{adminError}</div>
              </div>
            )}
            <form onSubmit={onAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2 dark:text-gray-300">Email Address</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-green-600" 
                  value={adminEmail} 
                  onChange={e=>setAdminEmail(e.target.value)} 
                  placeholder="admin@example.com"
                  type="email"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2 dark:text-gray-300">Password</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-green-600" 
                  type="password" 
                  value={adminPassword} 
                  onChange={e=>setAdminPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  className="px-6 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-all duration-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50" 
                  onClick={()=>setShowAdmin(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={adminLoading} 
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800"
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
        <div className="fixed inset-0 z-50 bg-green-900/20 grid place-items-center p-4 dark:bg-black/50">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-green-200 dark:bg-gray-800 dark:border-gray-600">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-500 rounded-lg flex items-center justify-center dark:from-green-500 dark:to-green-600">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-800 dark:text-green-300">Student Login</h3>
              </div>
              <button className="text-green-600 hover:text-green-800 transition-colors dark:text-green-400 dark:hover:text-green-300" onClick={() => setShowStudent(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {studentError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 dark:bg-red-900/20 dark:border-red-700">
                <div className="text-red-600 text-sm dark:text-red-400">{studentError}</div>
              </div>
            )}
            <form onSubmit={onStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2 dark:text-gray-300">Roll Number</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-green-600" 
                  value={studentRoll} 
                  onChange={e=>setStudentRoll(e.target.value)} 
                  placeholder="e.g., 20CS123" 
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 font-medium mb-2 dark:text-gray-300">Password</label>
                <input 
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-green-600" 
                  type="password" 
                  value={studentPassword} 
                  onChange={e=>setStudentPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  className="px-6 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-all duration-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50" 
                  onClick={()=>setShowStudent(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={studentLoading} 
                  className="px-6 py-2 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 dark:from-green-500 dark:to-green-600 dark:hover:from-green-600 dark:hover:to-green-700"
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
