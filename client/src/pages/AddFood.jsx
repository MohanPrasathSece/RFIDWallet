import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useNavigate } from 'react-router-dom';

export default function AddFood() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newFood, setNewFood] = useState({ name: '', price: '', quantity: 1 });
  // Existing foods management
  const [foods, setFoods] = useState([]);
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [incQty, setIncQty] = useState(1);
  const [updating, setUpdating] = useState(false);

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

  const loadFoods = async () => {
    try {
      setError('');
      const { data } = await api.get('/items', { params: { type: 'food' } });
      setFoods(Array.isArray(data) ? data : []);
    } catch (e) {
      setFoods([]);
    }
  };

  useEffect(() => { loadFoods(); }, []);

  const increaseQuantity = async () => {
    try {
      setError(''); setUpdating(true);
      const id = selectedFoodId;
      const add = Number(incQty || 0);
      if (!id) { setError('Select a food to update.'); return; }
      if (!add || add <= 0) { setError('Enter a positive quantity to add.'); return; }
      const current = foods.find(f => f._id === id);
      const newQuantity = Number((current?.quantity ?? 0)) + add;
      await api.put(`/items/${id}`, { quantity: newQuantity });
      await loadFoods();
      setIncQty(1);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to update quantity');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
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

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Increase Quantity of Existing Food</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <select className="border rounded px-3 py-2" value={selectedFoodId} onChange={e=>setSelectedFoodId(e.target.value)}>
            <option value="">Select food…</option>
            {foods.map(f => (
              <option key={f._id} value={f._id}>{f.name} — Qty {f.quantity ?? 0} — ₹{f.price ?? '-'}</option>
            ))}
          </select>
          <input className="border rounded px-3 py-2" type="number" min="1" placeholder="Add quantity" value={incQty} onChange={e=>setIncQty(e.target.value)} />
          <button disabled={updating} onClick={increaseQuantity} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-60">{updating ? 'Updating…' : 'Add to Quantity'}</button>
        </div>
        <div className="text-xs text-gray-500 mt-2">This will increase the selected food's quantity by the amount specified.</div>
      </div>
    </div>
  );
}
