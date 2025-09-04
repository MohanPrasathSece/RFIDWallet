import Sidebar from '../shared/Sidebar.jsx';
import { useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useNavigate } from 'react-router-dom';

export default function AddStore() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState({ name: '', price: '', quantity: 1 });

  const addItem = async () => {
    try {
      setError(''); setSaving(true);
      const payload = {
        type: 'store',
        name: item.name,
        price: item.price ? Number(item.price) : undefined,
        quantity: Number(item.quantity || 0),
      };
      if (!payload.name) { setError('Name is required'); return; }
      await api.post('/items', payload);
      navigate('/store');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to add store item');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Add Store Item</h1>
          <Link to="/store" className="text-blue-600 hover:underline">Back to Store</Link>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Name" value={item.name} onChange={e=>setItem(v=>({...v,name:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Price" type="number" value={item.price} onChange={e=>setItem(v=>({...v,price:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Quantity" type="number" value={item.quantity} onChange={e=>setItem(v=>({...v,quantity:e.target.value}))} />
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          <div className="mt-4">
            <button disabled={saving} onClick={addItem} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-60">{saving ? 'Saving...' : 'Add Item'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
