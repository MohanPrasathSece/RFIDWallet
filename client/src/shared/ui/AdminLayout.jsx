import Sidebar from '../Sidebar.jsx';
import { useAuth } from '../AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function AdminLayout({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-white md:flex">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)}></div>
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar />
          </div>
        </>
      )}
      <div className="flex-1 flex flex-col md:ml-64">
        <header className="w-full px-6 py-4 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="md:hidden px-3 py-1.5 border rounded text-gray-700 bg-white">Menu</button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
                {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200 uppercase">{user?.role || 'user'}</span>
              <span className="hidden md:block text-sm text-gray-700">{user?.name || 'Admin'}</span>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded shadow"
              >Logout</button>
              {actions}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 bg-green-50/40">{children}</main>
      </div>
    </div>
  );
}

