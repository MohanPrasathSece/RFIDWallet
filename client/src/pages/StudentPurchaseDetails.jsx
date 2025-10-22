import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../shared/api';

export default function StudentPurchaseDetails() {
  const navigate = useNavigate();
  const { receiptId } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/wallet/history', { params: { receiptId } });
        if (!mounted) return;
        setItems(Array.isArray(res.data) ? res.data.filter(x => x.type === 'debit') : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || 'Failed to load purchase details');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [receiptId]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.itemId || it.itemName || it._id;
      const prev = map.get(key) || { itemName: it.itemName || 'Item', itemPrice: Number(it.itemPrice || it.amount || 0), qty: 0 };
      map.set(key, { ...prev, qty: prev.qty + 1 });
    }
    const list = Array.from(map.values());
    const total = list.reduce((s, x) => s + (x.itemPrice * x.qty), 0);
    return { list, total };
  }, [items]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Purchase Details</h1>
          <button onClick={() => navigate(-1)} className="px-3 py-2 rounded bg-white border hover:bg-slate-50">Back</button>
        </div>

        <div className="bg-white rounded shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-700">Receipt</div>
              <div className="text-xs text-slate-500 font-mono break-all">{receiptId}</div>
            </div>
            {!loading && (
              <div className="text-sm font-semibold">Total: ₹ {grouped.total.toFixed(2)}</div>
            )}
          </div>

          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex items-center justify-between">
                  <div className="h-3 w-40 bg-slate-200 rounded" />
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : grouped.list.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No items found for this purchase.</div>
          ) : (
            <div className="divide-y">
              <div className="p-3 text-xs text-slate-500 bg-slate-50">Items</div>
              {grouped.list.map((row, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-800">{row.itemName}</div>
                    <div className="text-xs text-slate-500">Rate: ₹ {Number(row.itemPrice).toFixed(2)}</div>
                  </div>
                  <div className="text-sm text-slate-700">Qty: {row.qty}</div>
                </div>
              ))}
              <div className="p-4 flex items-center justify-between border-t">
                <div className="text-sm font-medium">Grand Total</div>
                <div className="text-sm font-semibold">₹ {grouped.total.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
