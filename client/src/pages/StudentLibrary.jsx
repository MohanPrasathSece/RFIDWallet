import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export default function StudentLibrary() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(''); setLoading(true);
        const { data } = await api.get('/library/my-active');
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e?.response?.data?.message || e.message || 'Failed to load borrowed books');
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const today = new Date();

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 p-4">
      <div className="max-w-5xl mx-auto space-y-6 h-full">
        {/* Header Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 rounded-3xl p-6 text-white shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent">
                📚 My Library
              </h1>
              <p className="text-indigo-100 text-sm">Your borrowed books and reading progress</p>
            </div>
            <button 
              onClick={() => navigate(-1)} 
              className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-2xl shadow-md transition-all duration-300 hover:scale-105 border border-white/20 font-semibold"
            >
              ← Go Back
            </button>
          </div>
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl"></div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center">
                <span className="text-white text-xl">⚠️</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-800">Error Loading Books</h3>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-indigo-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Loading Your Books</h3>
              <p className="text-gray-600">Please wait while we fetch your borrowed books...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-4xl">📖</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No Books Borrowed</h3>
              <p className="text-gray-600 text-lg">You haven't borrowed any books yet. Visit the library to start reading!</p>
            </div>
          ) : (
            <div className="p-5">
              {/* Stats Header */}
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-100 text-sm font-medium">Total Books</p>
                      <p className="text-3xl font-bold">{items.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">📚</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Overdue Books</p>
                      <p className="text-3xl font-bold">
                        {items.filter(row => {
                          const due = row.dueDate ? new Date(row.dueDate) : null;
                          return due ? due < new Date(today.toDateString()) : false;
                        }).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">⏰</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-indigo-400 to-blue-400 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">On Time</p>
                      <p className="text-3xl font-bold">
                        {items.filter(row => {
                          const due = row.dueDate ? new Date(row.dueDate) : null;
                          return due ? due >= new Date(today.toDateString()) : true;
                        }).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">✅</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Books List */}
              <div className="space-y-6 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center">
                    <span className="text-white text-xl">📖</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Your Borrowed Books</h2>
                    <p className="text-gray-600">Keep track of your reading and due dates</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {items.map((row, idx) => {
                    const due = row.dueDate ? new Date(row.dueDate) : null;
                    const overdue = due ? due < new Date(today.toDateString()) : false;
                    const daysLeft = due ? Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24)) : null;
                    
                    return (
                      <div key={idx} className={`rounded-3xl p-6 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                        overdue 
                          ? 'bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200' 
                          : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200'
                      }`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${
                            overdue 
                              ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' 
                              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                          }`}>
                            📚
                          </div>
                          
                          <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                            overdue 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {overdue ? '⚠️ Overdue' : '✅ Active'}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-xl font-bold text-gray-800 mb-1">{row.item?.name || 'Unknown Book'}</h3>
                            <p className="text-gray-600">
                              <span className="font-medium">Topics:</span> {(row.item?.topics || []).join(', ') || 'No topics listed'}
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                            <div>
                              <p className="text-gray-500 text-sm font-medium">Due Date</p>
                              <p className="text-gray-800 font-bold">
                                {due ? due.toLocaleDateString() : 'No due date'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-sm font-medium">Days Left</p>
                              <p className={`font-bold ${
                                overdue 
                                  ? 'text-red-600' 
                                  : daysLeft !== null && daysLeft <= 3 
                                  ? 'text-amber-600' 
                                  : 'text-emerald-600'
                              }`}>
                                {overdue 
                                  ? `${Math.abs(daysLeft)} days overdue` 
                                  : daysLeft !== null 
                                  ? `${daysLeft} days left` 
                                  : 'No deadline'
                                }
                              </p>
                            </div>
                          </div>
                          
                          {overdue && (
                            <div className="mt-4 p-3 bg-red-100 rounded-xl border border-red-200">
                              <p className="text-red-700 text-sm font-medium">
                                📢 This book is overdue! Please return it to the library as soon as possible.
                              </p>
                            </div>
                          )}
                          
                          {!overdue && daysLeft !== null && daysLeft <= 3 && (
                            <div className="mt-4 p-3 bg-amber-100 rounded-xl border border-amber-200">
                              <p className="text-amber-700 text-sm font-medium">
                                ⏰ This book is due soon! Consider renewing or returning it.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-600 text-sm">
            Last updated: {new Date().toLocaleString()} • Keep reading! 📚
          </p>
        </div>
      </div>
    </div>
  );
}
