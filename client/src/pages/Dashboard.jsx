import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';
import PendingApprovals from '../shared/PendingApprovals.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState({ users: 0, today: 0, pending: 0, notifications: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await api.get('/stats/quick');
        if (mounted) setStats(data);
      } catch {}
    };
    load();

    // Socket for live updates
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    socket.on('rfid:approved', () => setStats(s => ({ ...s, today: s.today + 1 })));
    socket.on('transaction:new', () => setStats(s => ({ ...s, today: s.today + 1 })));
    socket.on('rfid:pending', () => setStats(s => ({ ...s, pending: s.pending + 1 })));
    socket.on('transaction:update', (tx) => {
      // When a pending tx is approved/denied, decrement pending and increment today if approved
      setStats(s => ({
        ...s,
        pending: Math.max(0, s.pending - 1),
        today: tx?.status === 'approved' ? s.today + 1 : s.today,
        approved: tx?.status === 'approved' ? s.approved + 1 : s.approved,
        rejected: tx?.status === 'rejected' ? s.rejected + 1 : s.rejected,
      }));
    });

    return () => { mounted = false; socket.disconnect(); };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Today</div>
          <div className="text-2xl font-semibold">{stats.today ?? 0}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-semibold">{stats.pending ?? 0}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Approved</div>
          <div className="text-2xl font-semibold">{stats.approved ?? 0}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Rejected</div>
          <div className="text-2xl font-semibold">{stats.rejected ?? 0}</div>
        </div>
      </div>

      <PendingApprovals />
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-gray-500 text-sm">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
