import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export default function StudentAnalytics() {
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
        setError(e?.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const { monthLabel, foodTotal, storeTotal, topFood, topStore } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthLabel = now.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    const monthDebits = history.filter(h => h.type === 'debit' && h.createdAt && new Date(h.createdAt) >= monthStart && new Date(h.createdAt) < monthEnd);

    const food = monthDebits.filter(h => h.module === 'food');
    const store = monthDebits.filter(h => h.module === 'store');

    const sum = arr => arr.reduce((s, x) => s + Number(x.amount || 0), 0);
    const foodTotal = sum(food);
    const storeTotal = sum(store);

    const topByProduct = (arr) => {
      const map = new Map();
      for (const x of arr) {
        const key = x.itemName || 'Unknown';
        map.set(key, (map.get(key) || 0) + Number(x.amount || 0));
      }
      return Array.from(map.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    };

    return {
      monthLabel,
      foodTotal,
      storeTotal,
      topFood: topByProduct(food),
      topStore: topByProduct(store),
    };
  }, [history]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Analytics</h1>
            <p className="text-xs text-slate-500">{monthLabel} overview</p>
          </div>
          <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm text-sm">Back</button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-5 rounded-2xl border border-emerald-100 bg-white/80 shadow-sm">
            <div className="text-xs text-emerald-700 mb-1">Food Spent</div>
            {loading ? (
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-semibold text-slate-800">₹ {Number(foodTotal).toFixed(2)}</div>
            )}
          </div>
          <div className="p-5 rounded-2xl border border-blue-100 bg-white/80 shadow-sm">
            <div className="text-xs text-blue-700 mb-1">Store Spent</div>
            {loading ? (
              <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-semibold text-slate-800">₹ {Number(storeTotal).toFixed(2)}</div>
            )}
          </div>
        </div>

        {/* Top products */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-100 bg-white/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-emerald-100 text-slate-800 font-medium flex items-center gap-2">🍔 Top Food Products</div>
            {loading ? (
              <div className="divide-y divide-emerald-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse flex items-center justify-between">
                    <div className="h-3 w-40 bg-slate-200 rounded" />
                    <div className="h-3 w-16 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : topFood.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No purchases this month</div>
            ) : (
              <div className="divide-y divide-emerald-100">
                {topFood.map((p) => (
                  <div key={p.name} className="p-4 flex items-center justify-between">
                    <div className="text-sm text-slate-800">{p.name}</div>
                    <div className="text-sm font-semibold text-slate-700">₹ {p.total.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-blue-100 text-slate-800 font-medium flex items-center gap-2">🛍️ Top Store Products</div>
            {loading ? (
              <div className="divide-y divide-blue-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse flex items-center justify-between">
                    <div className="h-3 w-40 bg-slate-200 rounded" />
                    <div className="h-3 w-16 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : topStore.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No purchases this month</div>
            ) : (
              <div className="divide-y divide-blue-100">
                {topStore.map((p) => (
                  <div key={p.name} className="p-4 flex items-center justify-between">
                    <div className="text-sm text-slate-800">{p.name}</div>
                    <div className="text-sm font-semibold text-slate-700">₹ {p.total.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
