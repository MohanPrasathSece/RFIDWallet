import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState } from 'react';

export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 md:flex">
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
      <button
        className="md:hidden fixed top-4 left-4 z-50 px-3 py-1.5 rounded border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        Menu
      </button>
      <main className="flex-1 p-6 space-y-6 bg-gray-50 dark:bg-gray-900 md:ml-64">
        <Outlet />
      </main>
    </div>
  );
}
