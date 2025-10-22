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
    <div className="min-h-[100dvh] bg-gradient-to-br from-white to-green-50 font-sans antialiased overflow-y-auto lg:overflow-hidden flex flex-col relative">
      {/* Background Image (from public/bgimage.jpg) */}
      <div
        className="absolute inset-0 bg-[url('/bgimage.jpg')] bg-cover bg-center opacity-70"
        aria-hidden="true"
      ></div>
      {/* Background (light green with white) */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/90 to-green-50/80"></div>
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-300 rounded-full mix-blend-multiply filter blur-xl opacity-25 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-green-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation - Desktop Only */}
      <nav className={`hidden lg:flex relative z-10 items-center justify-between px-4 py-2 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center space-x-2">
          <BrandLogo size={80} rounded={false} />
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        
        {/* Mobile Layout - Minimal Experience */}
        <div className="lg:hidden flex-1 overflow-y-auto">
          <div className="px-5 py-8 space-y-6">
            <header className="flex items-center justify-between">
              <BrandLogo size={48} rounded={false} />
              <span className="text-[11px] font-medium text-green-800 border border-green-200 rounded-full px-3 py-1 bg-white/80 backdrop-blur">
                {brandName}
              </span>
            </header>

            <section className="space-y-6 mt-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-green-800 mb-2">{brandName}</h2>
                <p className="text-green-600 text-sm font-medium">Smart • Secure • Sustainable</p>
              </div>
              <div className="space-y-6 pt-3">
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
            </section>
          </div>
        </div>

        {/* Desktop Layout - Left Side - Hero Content */}
        <div className={`hidden lg:flex flex-1 flex-col justify-center px-4 xl:px-6 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
          <div className="max-w-md">
            <div className="inline-flex items-center px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full border border-green-200 mb-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
              <span className="text-green-700 text-sm font-semibold">{brandName}</span>
            </div>
            
            <h1 className="text-3xl font-bold text-green-800 mb-3 leading-tight">
              Next-Gen
              <span className="block bg-gradient-to-r from-green-500 via-green-600 to-green-700 bg-clip-text text-transparent">
                Digital Wallet
              </span>
            </h1>
            
            <p className="text-lg text-green-700 mb-4 leading-relaxed font-medium">
              Experience the future of campus payments with our secure RFID-enabled digital wallet system. 
              Fast, secure, and seamlessly integrated.
            </p>

            {/* Animated Feature Showcase */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-green-200 mb-4">
              <div className="flex items-center space-x-4 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 font-semibold text-base flex items-center justify-center">
                  {features[currentFeature].tag}
                </div>
                <div>
                  <h3 className="text-green-800 font-bold text-base">{features[currentFeature].title}</h3>
                  <p className="text-green-600 text-sm font-medium">{features[currentFeature].desc}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                {features.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      index === currentFeature ? 'bg-green-500 w-8' : 'bg-green-200 w-2'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center bg-gradient-to-b from-white to-green-50 backdrop-blur-sm rounded-xl p-3 border border-green-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="text-lg font-bold text-green-800">99.9%</div>
                <div className="text-green-600 text-sm font-medium">Uptime</div>
              </div>
              <div className="text-center bg-gradient-to-b from-white to-green-50 backdrop-blur-sm rounded-xl p-3 border border-green-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="text-lg font-bold text-green-800">5000+</div>
                <div className="text-green-600 text-sm font-medium">Students</div>
              </div>
              <div className="text-center bg-gradient-to-b from-white to-green-50 backdrop-blur-sm rounded-xl p-3 border border-green-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="text-lg font-bold text-green-800">24/7</div>
                <div className="text-green-600 text-sm font-medium">Support</div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Right Side - Login Portals */}
        <div className={`hidden lg:flex flex-1 flex-col justify-center px-8 xl:px-12 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
          <div className="max-w-sm mx-auto w-full space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-green-800 mb-1">Access Portal</h2>
              <p className="text-green-600 text-sm">Choose your login method</p>
            </div>

            {/* Admin Portal Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-400 to-green-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
              <div className="relative bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-green-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">Admin Portal</h3>
                    <p className="text-green-600 text-sm">System management & analytics</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAdmin(true)}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 shadow-md text-sm"
                >
                  Admin Login
                </button>
              </div>
            </div>

            {/* Student Portal Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-300 to-green-400 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
              <div className="relative bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-green-200 shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-green-500 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">Student Portal</h3>
                    <p className="text-green-600 text-sm">Wallet & payment management</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStudent(true)}
                  className="w-full bg-gradient-to-r from-green-400 to-green-500 text-white font-semibold py-2.5 px-4 rounded-lg hover:from-green-500 hover:to-green-600 transition-all duration-300 transform hover:scale-105 shadow-md text-sm"
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
