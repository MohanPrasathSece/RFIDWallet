import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export default function StudentLibrary() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(''); setLoading(true);
        const { data } = await api.get('/library/my-active');
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e?.response?.data?.message || e.message || 'Failed to load borrowed books');
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const today = new Date();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50/40 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">My Library</h1>
            <p className="text-xs text-slate-500">Borrowed books and due dates</p>
          </div>
          <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm">Back</button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-200/70 rounded animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-5 text-sm text-slate-600">You have no active borrowed books.</div>
        ) : (
          <div className="space-y-3">
            {items.map((row, idx) => {
              const due = row.dueDate ? new Date(row.dueDate) : null;
              const overdue = due ? due < new Date(today.toDateString()) : false;
              return (
                <div key={idx} className={`rounded-2xl border bg-white/80 shadow-sm p-4 ${overdue ? 'border-red-200' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{row.item?.name || 'Unknown Book'}</div>
                      <div className="text-xs text-slate-500">Topics: {(row.item?.topics || []).join(', ') || '-'}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs inline-flex items-center gap-2 px-2 py-1 rounded-full ring-1 ${overdue ? 'text-red-700 bg-red-50 ring-red-200' : 'text-emerald-700 bg-emerald-50 ring-emerald-200'}`}>
                        <span className={`h-2 w-2 rounded-full ${overdue ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                        {overdue ? 'Overdue' : 'Borrowed'}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">Due: {due ? due.toLocaleDateString() : '—'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
