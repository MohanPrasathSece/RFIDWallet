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
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <span className="text-xl text-blue-600 dark:text-blue-400">📚</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Add New Book</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Add a book to the library collection</p>
            </div>
          </div>
          <Link to="/library" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
            ← Back to Library
          </Link>
        </div>

        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Book Details</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Fill in the book information below</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="Name" value={newBook.name} onChange={e=>setNewBook(v=>({...v,name:e.target.value}))} />
            <input className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="Quantity" type="number" value={newBook.quantity} onChange={e=>setNewBook(v=>({...v,quantity:e.target.value}))} />
            <input className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="Topics (comma-separated)" value={newBook.topics} onChange={e=>setNewBook(v=>({...v,topics:e.target.value}))} />
            <input className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="Author" value={newBook.author} onChange={e=>setNewBook(v=>({...v,author:e.target.value}))} />
            <input className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="ISBN" value={newBook.isbn} onChange={e=>setNewBook(v=>({...v,isbn:e.target.value}))} />
            <input className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="Publisher" value={newBook.publisher} onChange={e=>setNewBook(v=>({...v,publisher:e.target.value}))} />
            <input className="border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="Year" type="number" value={newBook.year} onChange={e=>setNewBook(v=>({...v,year:e.target.value}))} />
          </div>
          {error && <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg"><p className="text-sm text-red-800 dark:text-red-300">{error}</p></div>}
          <div className="mt-6 flex gap-3">
            <button disabled={saving} onClick={addBook} className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:bg-gray-400 dark:disabled:bg-gray-600">{saving ? 'Saving...' : 'Add Book'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
