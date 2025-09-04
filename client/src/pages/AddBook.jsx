import Sidebar from '../shared/Sidebar.jsx';
import { useState } from 'react';
import { api } from '../shared/api.js';
import { Link, useNavigate } from 'react-router-dom';

export default function AddBook() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newBook, setNewBook] = useState({ name: '', quantity: 1, topics: '', author: '', isbn: '', publisher: '', year: '' });

  const addBook = async () => {
    try {
      setError(''); setSaving(true);
      const payload = {
        type: 'library',
        name: newBook.name,
        quantity: Number(newBook.quantity || 0),
        topics: newBook.topics ? newBook.topics.split(',').map(s => s.trim()).filter(Boolean) : [],
        author: newBook.author || undefined,
        isbn: newBook.isbn || undefined,
        publisher: newBook.publisher || undefined,
        year: newBook.year ? Number(newBook.year) : undefined,
      };
      await api.post('/items', payload);
      navigate('/library');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to add book');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Add Book</h1>
          <Link to="/library" className="text-blue-600 hover:underline">Back to Library</Link>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Name" value={newBook.name} onChange={e=>setNewBook(v=>({...v,name:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Quantity" type="number" value={newBook.quantity} onChange={e=>setNewBook(v=>({...v,quantity:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Topics (comma-separated)" value={newBook.topics} onChange={e=>setNewBook(v=>({...v,topics:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Author" value={newBook.author} onChange={e=>setNewBook(v=>({...v,author:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="ISBN" value={newBook.isbn} onChange={e=>setNewBook(v=>({...v,isbn:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Publisher" value={newBook.publisher} onChange={e=>setNewBook(v=>({...v,publisher:e.target.value}))} />
            <input className="border rounded px-3 py-2" placeholder="Year" type="number" value={newBook.year} onChange={e=>setNewBook(v=>({...v,year:e.target.value}))} />
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          <div className="mt-4">
            <button disabled={saving} onClick={addBook} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-60">{saving ? 'Saving...' : 'Add Book'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
