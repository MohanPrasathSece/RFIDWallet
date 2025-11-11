import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';

export default function AddItem() {
  const navigate = useNavigate();
  const { module } = useParams(); // 'library', 'food', or 'store'
  const location = useLocation();
  const mod = module || (location?.pathname?.includes('/food') ? 'food' : (location?.pathname?.includes('/store') ? 'store' : 'library'));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state based on module type
  const [formData, setFormData] = useState({});

  // Existing items management for food/store
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [incQty, setIncQty] = useState(1);
  const [updating, setUpdating] = useState(false);
  const [editPrice, setEditPrice] = useState('');

  // Initialize form data based on module
  useEffect(() => {
    if (mod === 'library') {
      setFormData({ name: '', quantity: 1, topics: '', author: '', isbn: '', publisher: '', year: '' });
    } else {
      setFormData({ name: '', price: '', quantity: 1 });
    }
    setError('');

    // Load existing items for food and store modules
    if (mod !== 'library') { loadItems(); }
  }, [mod]);

  const getItemType = () => {
    switch (mod) {
      case 'library': return 'library';
      case 'food': return 'food';
      case 'store': return 'store';
      default: return 'store';
    }
  };

  const updatePrice = async () => {
    try {
      setError(''); setUpdating(true);
      const id = selectedItemId;
      if (!id) { setError('Select an item to update price.'); return; }
      const p = Number(editPrice);
      if (!Number.isFinite(p) || p < 0) { setError('Enter a valid non-negative price.'); return; }
      await api.put(`/items/${id}`, { price: p });
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to update price');
    } finally {
      setUpdating(false);
    }
  };

  const getBackLink = () => {
    switch (mod) {
      case 'library': return '/library';
      case 'food': return '/food';
      case 'store': return '/store';
      default: return '/store';
    }
  };

  const getBackText = () => {
    switch (mod) {
      case 'library': return 'Back to Library';
      case 'food': return 'Back to Food';
      case 'store': return 'Back to Store';
      default: return 'Back to Store';
    }
  };

  const getTitle = () => {
    switch (mod) {
      case 'library': return 'Add Book';
      case 'food': return 'Add Food';
      case 'store': return 'Add Store Item';
      default: return 'Add Item';
    }
  };

  const getButtonText = () => {
    switch (mod) {
      case 'library': return saving ? 'Saving...' : 'Add Book';
      case 'food': return saving ? 'Saving...' : 'Add Food';
      case 'store': return saving ? 'Saving...' : 'Add Item';
      default: return saving ? 'Saving...' : 'Add Item';
    }
  };

  const loadItems = async () => {
    if (mod === 'library') return;
    try {
      setError('');
      const { data } = await api.get('/items', { params: { type: getItemType() } });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
    }
  };

  // Populate editPrice when selection changes
  useEffect(() => {
    try {
      if (!selectedItemId) { setEditPrice(''); return; }
      const it = items.find(x => x._id === selectedItemId);
      if (it && it.price != null) setEditPrice(String(it.price));
    } catch (_) {}
  }, [selectedItemId, items]);

  const handleSubmit = async () => {
    try {
      setError(''); setSaving(true);
      const payload = {
        type: getItemType(),
        ...formData,
      };

      // Convert numeric fields
      if (payload.quantity) payload.quantity = Number(payload.quantity);
      if (payload.price) payload.price = Number(payload.price);
      if (payload.year) payload.year = Number(payload.year);

      // Process topics for library items
      if (mod === 'library' && payload.topics) {
        payload.topics = payload.topics.split(',').map(s => s.trim()).filter(Boolean);
      }

      // Validation
      if (!payload.name) {
        setError('Name is required');
        return;
      }

      await api.post('/items', payload);
      navigate(getBackLink());
    } catch (e) {
      const errorMessage = e?.response?.data?.message || e.message || `Failed to add ${mod} item`;
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const increaseQuantity = async () => {
    try {
      setError(''); setUpdating(true);
      const id = selectedItemId;
      const add = Number(incQty || 0);
      if (!id) { setError('Select an item to update.'); return; }
      if (!add || add <= 0) { setError('Enter a positive quantity to add.'); return; }

      const current = items.find(item => item._id === id);
      const newQuantity = Number((current?.quantity ?? 0)) + add;
      await api.put(`/items/${id}`, { quantity: newQuantity });
      await loadItems();
      setIncQty(1);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to update quantity');
    } finally {
      setUpdating(false);
    }
  };

  const deleteItem = async () => {
    try {
      setError(''); setUpdating(true);
      const id = selectedItemId;
      if (!id) { setError('Select an item to delete.'); return; }
      const item = items.find(x => x._id === id);
      const ok = window.confirm(`Delete "${item?.name || 'item'}"? This cannot be undone.`);
      if (!ok) return;
      await api.delete(`/items/${id}`);
      await loadItems();
      setSelectedItemId('');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to delete item');
    } finally {
      setUpdating(false);
    }
  };

  const renderFormFields = () => {
    const fields = [];

    // Common fields
    fields.push(
      <input
        key="name"
        className="border rounded px-3 py-2"
        placeholder="Name"
        value={formData.name || ''}
        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
      />
    );

    if (module !== 'library') {
      fields.push(
        <input
          key="price"
          className="border rounded px-3 py-2"
          placeholder="Price"
          type="number"
          value={formData.price || ''}
          onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
        />
      );
    }

    fields.push(
      <input
        key="quantity"
        className="border rounded px-3 py-2"
        placeholder="Quantity"
        type="number"
        value={formData.quantity || ''}
        onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
      />
    );

    // Library-specific fields
    if (module === 'library') {
      fields.push(
        <input
          key="topics"
          className="border rounded px-3 py-2"
          placeholder="Topics (comma-separated)"
          value={formData.topics || ''}
          onChange={e => setFormData(prev => ({ ...prev, topics: e.target.value }))}
        />
      );
      fields.push(
        <input
          key="author"
          className="border rounded px-3 py-2"
          placeholder="Author"
          value={formData.author || ''}
          onChange={e => setFormData(prev => ({ ...prev, author: e.target.value }))}
        />
      );
      fields.push(
        <input
          key="isbn"
          className="border rounded px-3 py-2"
          placeholder="ISBN"
          value={formData.isbn || ''}
          onChange={e => setFormData(prev => ({ ...prev, isbn: e.target.value }))}
        />
      );
      fields.push(
        <input
          key="publisher"
          className="border rounded px-3 py-2"
          placeholder="Publisher"
          value={formData.publisher || ''}
          onChange={e => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
        />
      );
      fields.push(
        <input
          key="year"
          className="border rounded px-3 py-2"
          placeholder="Year"
          type="number"
          value={formData.year || ''}
          onChange={e => setFormData(prev => ({ ...prev, year: e.target.value }))}
        />
      );
    }

    return fields;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{getTitle()}</h1>
        <Link to={getBackLink()} className="text-blue-600 hover:underline">{getBackText()}</Link>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderFormFields()}
        </div>
        {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
        <div className="mt-4">
          <button
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-60"
          >
            {getButtonText()}
          </button>
        </div>
      </div>

      {/* Existing items management for Food/Store */}
      {mod !== 'library' && (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Manage Existing {mod === 'food' ? 'Food' : 'Store'} Items</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <select
              className="border rounded px-3 py-2"
              value={selectedItemId}
              onChange={e => setSelectedItemId(e.target.value)}
            >
              <option value="">Select item…</option>
              {items.map(item => (
                <option key={item._id} value={item._id}>
                  {item.name} — Qty {item.quantity ?? 0} — ₹{item.price ?? '-'}
                </option>
              ))}
            </select>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min="1"
              placeholder="Add quantity"
              value={incQty}
              onChange={e => setIncQty(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                disabled={updating}
                onClick={increaseQuantity}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-60"
              >
                {updating ? 'Updating…' : 'Add to Quantity'}
              </button>
              <button
                disabled={updating || !selectedItemId}
                onClick={deleteItem}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-60"
              >
                {updating ? 'Deleting…' : 'Delete Item'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center mt-3">
            <div className="text-sm text-gray-600">Edit price for selected item</div>
            <input
              className="border rounded px-3 py-2"
              type="number"
              step="0.01"
              min="0"
              placeholder="New price"
              value={editPrice}
              onChange={e => setEditPrice(e.target.value)}
              disabled={!selectedItemId}
            />
            <button
              disabled={updating || !selectedItemId}
              onClick={updatePrice}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded disabled:opacity-60"
            >
              {updating ? 'Saving…' : 'Update Price'}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Use this section to increase quantity or delete the selected item.
          </div>
        </div>
      )}
    </div>
  );
}
