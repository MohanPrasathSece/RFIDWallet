import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';
import PendingApprovals from '../shared/PendingApprovals.jsx';
import StatCard from '../shared/ui/StatCard.jsx';

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
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Today" value={stats.today ?? 0} />
        <StatCard title="Pending" value={stats.pending ?? 0} />
        <StatCard title="Approved" value={stats.approved ?? 0} />
        <StatCard title="Rejected" value={stats.rejected ?? 0} />
      </div>

      <PendingApprovals />
    </div>
  );
}
