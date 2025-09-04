import Sidebar from '../shared/Sidebar.jsx';
import { useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useNavigate } from 'react-router-dom';

export default function AddFood() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newFood, setNewFood] = useState({ name: '', price: '', quantity: 1 });

  const addFood = async () => {
    try {
      setError(''); setSaving(true);
      const payload = {
        type: 'food',
        name: newFood.name,
        price: newFood.price ? Number(newFood.price) : undefined,
        quantity: Number(newFood.quantity || 0),
      };
      if (!payload.name) { setError('Name is required'); return; }
      await api.post('/items', payload);
      navigate('/food');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to add food');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Add Food</h1>
          <Link to="/food" className="text-blue-600 hover:underline">Back to Food</Link>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Name" value={newFood.name} onChange={e=>setNewFood(v=>({...v,name:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Price" type="number" value={newFood.price} onChange={e=>setNewFood(v=>({...v,price:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Quantity" type="number" value={newFood.quantity} onChange={e=>setNewFood(v=>({...v,quantity:e.target.value}))} />
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          <div className="mt-4">
            <button disabled={saving} onClick={addFood} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-60">{saving ? 'Saving...' : 'Add Food'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
