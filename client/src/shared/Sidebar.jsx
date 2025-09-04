import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/library', label: 'Library', icon: '📚' },
  { to: '/food', label: 'Food Court', icon: '🍔' },
  { to: '/store', label: 'Store', icon: '🛍️' },
  { to: '/admin', label: 'Admin', icon: '🛠️' },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="w-60 bg-white border-r min-h-screen p-4">
      <div className="text-xl font-bold mb-6">RFID Dashboard</div>
      <nav className="space-y-1">
        {links.map(l => (
          <Link key={l.to} to={l.to} className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${pathname===l.to? 'bg-gray-100 font-semibold':''}`}>
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
