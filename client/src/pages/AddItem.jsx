import { useEffect, useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function AddItem() {
  const navigate = useNavigate();
  const { module } = useParams(); // 'library', 'food', or 'store'
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state based on module type
  const [formData, setFormData] = useState({});

  // Food-specific state for existing items management
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [incQty, setIncQty] = useState(1);
  const [updating, setUpdating] = useState(false);

  // Initialize form data based on module
  useEffect(() => {
    if (module === 'library') {
      setFormData({ name: '', quantity: 1, topics: '', author: '', isbn: '', publisher: '', year: '' });
    } else {
      setFormData({ name: '', price: '', quantity: 1 });
    }
    setError('');

    // Load existing items if it's food module
    if (module === 'food') {
      loadItems();
    }
  }, [module]);

  const getItemType = () => {
    switch (module) {
      case 'library': return 'library';
      case 'food': return 'food';
      case 'store': return 'store';
      default: return 'store';
    }
  };

  const getBackLink = () => {
    switch (module) {
      case 'library': return '/library';
      case 'food': return '/food';
      case 'store': return '/store';
      default: return '/store';
    }
  };

  const getBackText = () => {
    switch (module) {
      case 'library': return 'Back to Library';
      case 'food': return 'Back to Food';
      case 'store': return 'Back to Store';
      default: return 'Back to Store';
    }
  };

  const getTitle = () => {
    switch (module) {
      case 'library': return 'Add Book';
      case 'food': return 'Add Food';
      case 'store': return 'Add Store Item';
      default: return 'Add Item';
    }
  };

  const getButtonText = () => {
    switch (module) {
      case 'library': return saving ? 'Saving...' : 'Add Book';
      case 'food': return saving ? 'Saving...' : 'Add Food';
      case 'store': return saving ? 'Saving...' : 'Add Item';
      default: return saving ? 'Saving...' : 'Add Item';
    }
  };

  const loadItems = async () => {
    if (module !== 'food') return;
    try {
      setError('');
      const { data } = await api.get('/items', { params: { type: 'food' } });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
    }
  };

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
      if (module === 'library' && payload.topics) {
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
      const errorMessage = e?.response?.data?.message || e.message || `Failed to add ${module} item`;
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

      {/* Food-specific existing items management */}
      {module === 'food' && (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Increase Quantity of Existing Food</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <select
              className="border rounded px-3 py-2"
              value={selectedItemId}
              onChange={e => setSelectedItemId(e.target.value)}
            >
              <option value="">Select food…</option>
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
            <button
              disabled={updating}
              onClick={increaseQuantity}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-60"
            >
              {updating ? 'Updating…' : 'Add to Quantity'}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            This will increase the selected food's quantity by the amount specified.
          </div>
        </div>
      )}
    </div>
  );
}
