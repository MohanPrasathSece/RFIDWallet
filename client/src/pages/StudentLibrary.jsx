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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto space-y-6 h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">📚 My Books</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/student/history')} 
              className="px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg text-xs"
            >
              View History
            </button>
            <button 
              onClick={() => navigate(-1)} 
              className="px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg text-xs"
            >
              Back
            </button>
          </div>
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Loading Your Books</h3>
              <p className="text-gray-600">Please wait while we fetch your borrowed books...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-4xl">📖</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No Books Borrowed</h3>
              <p className="text-gray-600 text-lg">You haven't borrowed any books yet. Visit the library to start reading!</p>
            </div>
          ) : (
            <div className="p-5">
              {/* Books List */}
              <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Your Borrowed Books</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {items.map((row, idx) => {
                    const due = row.dueDate ? new Date(row.dueDate) : null;
                    const overdue = due ? due < new Date(today.toDateString()) : false;
                    const daysLeft = due ? Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24)) : null;
                    
                    return (
                      <div key={idx} className={`rounded-lg p-3 border bg-white ${
                        overdue ? 'border-red-200' : 'border-gray-200'
                      }`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="text-xl">📚</div>
                          <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                            {overdue ? 'Overdue' : 'Active'}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-0.5">{row.item?.name || 'Unknown Book'}</h3>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Topics:</span> {(row.item?.topics || []).join(', ') || 'No topics listed'}
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                            <div>
                              <p className="text-gray-500 text-xs font-medium">Due Date</p>
                              <p className="text-gray-800 text-sm font-semibold">
                                {due ? due.toLocaleDateString() : 'No due date'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs font-medium">Days Left</p>
                              <p className={`text-sm font-semibold ${
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
                            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200 text-red-700 text-sm">
                              This book is overdue. Please return it soon.
                            </div>
                          )}
                          
                          {!overdue && daysLeft !== null && daysLeft <= 3 && (
                            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-700 text-sm">
                              This book is due soon. Consider renewing or returning it.
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
