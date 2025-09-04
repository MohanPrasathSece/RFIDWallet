import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export default function StudentHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get('/wallet/history');
        if (!mounted) return;
        setHistory(res.data || []);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Transactions</h1>
            <p className="text-xs text-slate-500">Your complete wallet activity</p>
          </div>
          <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm">Back</button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-slate-800 font-medium">History</div>
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex items-center justify-between">
                  <div className="h-3 w-40 bg-slate-200 rounded" />
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No transactions yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map(h => (
                <div key={h._id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-800">{h.type === 'debit' ? 'Purchase' : 'Top-up'}</div>
                    <div className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString()} • {h.razorpay_payment_id || '—'}</div>
                  </div>
                  <div className={`text-sm font-semibold ${h.type === 'debit' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {h.type === 'debit' ? '-' : '+'} ₹ {Number(h.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
