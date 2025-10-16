import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6 bg-gray-50 dark:bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
}
