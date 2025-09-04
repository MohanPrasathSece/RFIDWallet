import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export default function StudentHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    // Separate credits and debits. Group debits by receiptId when present; otherwise treat individually
    const credits = [];
    const debits = [];
    for (const h of history) {
      if (h.type === 'credit') credits.push(h);
      else debits.push(h);
    }
    const byReceipt = new Map();
    for (const d of debits) {
      const key = d.receiptId || `single:${d._id}`;
      if (!byReceipt.has(key)) byReceipt.set(key, []);
      byReceipt.get(key).push(d);
    }
    const rows = [];
    // Push debit groups
    for (const [key, list] of byReceipt.entries()) {
      const createdAt = list[0]?.createdAt;
      const module = list[0]?.module;
      const amount = list.reduce((s, x) => s + Number(x.amount || 0), 0);
      const itemCount = list.length;
      // Prefer showing product names over generic module labels
      const productNames = list.map(x => x?.itemName).filter(Boolean);
      let title;
      if (productNames.length > 1) {
        // Show first product and indicate there are more
        title = `${productNames[0]} +${productNames.length - 1} more`;
      } else if (productNames.length === 1) {
        title = productNames[0];
      } else {
        // Fallback to a sensible module label
        title = (module === 'store' ? 'Store' : (module === 'food' ? 'Food Court' : 'Purchase'));
      }
      rows.push({
        kind: 'debit',
        id: key,
        title,
        createdAt,
        amount,
        module,
        itemCount,
      });
    }
    // Push credits as individual rows
    for (const c of credits) {
      rows.push({
        kind: 'credit',
        id: c._id,
        title: 'Top-up',
        createdAt: c.createdAt,
        amount: Number(c.amount || 0),
        module: undefined,
      });
    }
    // Sort by date desc
    rows.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return rows;
  }, [history]);

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
            <h1 className="text-2xl font-semibold text-slate-800">History</h1>
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
              {grouped.map(row => (
                <button
                  key={row.id}
                  onClick={() => {
                    if (row.kind === 'debit' && String(row.id).startsWith('FOOD-'))
                      navigate(`/student/purchase/${encodeURIComponent(row.id)}`);
                    else if (row.kind === 'debit' && row.module)
                      navigate(`/student/purchase/${encodeURIComponent(row.id)}`);
                  }}
                  className={`w-full text-left p-4 flex items-center justify-between ${row.kind==='debit' ? 'hover:bg-slate-50' : ''}`}
                >
                  <div>
                    <div className="text-sm text-slate-800">
                      {row.title}{row.kind==='debit' && row.itemCount>1 ? ` • ${row.itemCount} items` : ''}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</div>
                  </div>
                  <div className={`text-sm font-semibold ${row.kind === 'debit' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.kind === 'debit' ? '-' : '+'} ₹ {Number(row.amount).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
