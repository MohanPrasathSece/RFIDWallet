import Sidebar from '../Sidebar.jsx';
import { useAuth } from '../AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function AdminLayout({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="w-full px-6 py-4 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
              {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
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
