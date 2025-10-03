import Sidebar from '../shared/Sidebar.jsx';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';

export default function Food() {
  const [rollNo, setRollNo] = useState('');
  const [rfid, setRfid] = useState('');
  const [student, setStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Items for listing
  const [items, setItems] = useState([]);
  const [itemQuery, setItemQuery] = useState('');
  // Cart state: array of { _id, name, price, qty }
  const [cart, setCart] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadHistory = async () => {
    if (!student?._id) {
      setError('Find a student to load their history.');
      return;
    }
    try {
      setLoading(true); setError('');
      const res = await api.get('/food/history', { params: { student: student._id } });
      setHistory(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load history');
      setHistory([]);
    } finally { setLoading(false); }
  };

  const addToCart = (it) => {
    if (!student?._id) {
      setError('Select a student first.');
      return;
    }
    setError('');
    // Check if adding this item would exceed wallet balance
    const price = Number(it.price) || 0;
    const proposed = cartTotal + price;
    if (Number(student?.walletBalance || 0) < proposed) {
      setError('Insufficient wallet balance for this item.');
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(x => x._id === it._id);
      if (idx >= 0) {
        const copy = [...prev];
        // Also ensure increasing existing item doesn't exceed balance
        const nextTotal = cartTotal + price; // cartTotal reflects prev state
        if (Number(student?.walletBalance || 0) < nextTotal) {
          setError('Insufficient wallet balance for this item.');
          return prev;
        }
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { _id: it._id, name: it.name, price: it.price ?? 0, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setError('');
    setCart(prev => {
      const item = prev.find(x => x._id === id);
      if (!item) return prev;
      if (delta > 0) {
        const price = Number(item.price) || 0;
        const proposed = cartTotal + price; // based on previous state
        if (Number(student?.walletBalance || 0) < proposed) {
          setError('Insufficient wallet balance to increase quantity.');
          return prev;
        }
      }
      return prev.map(it => it._id === id ? { ...it, qty: Math.max(1, it.qty + delta) } : it);
    });
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(it => it._id !== id));
  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, it) => sum + (Number(it.price) * it.qty), 0);

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => (it.name || '').toLowerCase().includes(q));
  }, [items, itemQuery]);

  const printBill = () => {
    const w = window.open('', 'PRINT', 'height=600,width=400');
    const lines = [
      `<h3 style="margin:0">Food Court Bill</h3>`,
      `<div>Student: ${student?.name || ''}</div>`,
      `<div>RFID: ${student?.rfid_uid || ''}</div>`,
      '<hr/>',
      '<table style="width:100%;font-size:12px">',
      '<tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Price</th></tr>',
      ...cart.map(c => `<tr><td>${c.name}</td><td align="right">${c.qty}</td><td align="right">₹ ${(c.price*c.qty).toFixed(2)}</td></tr>`),
      '<tr><td colspan="3"><hr/></td></tr>',
      `<tr><td><b>Total</b></td><td></td><td align="right"><b>₹ ${cartTotal.toFixed(2)}</b></td></tr>`,
      '</table>'
    ];
    w.document.write(`<html><head><title>Bill</title></head><body>${lines.join('')}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const saveBillPdf = () => {
    try {
      const doc = new jsPDF();
      const lineH = 8;
      let y = 10;
      const put = (text, x = 10) => { doc.text(String(text), x, y); y += lineH; };
      put('Food Court Bill');
      put(`Student: ${student?.name || ''}`);
      put(`Roll No: ${student?.rollNo || ''}`);
      put(`RFID: ${student?.rfid_uid || ''}`);
      y += 2;
      put('Items:');
      cart.forEach(c => put(`- ${c.name}  x${c.qty}  = ₹ ${(c.qty * Number(c.price)).toFixed(2)}`));
      y += 2;
      put(`Total: ₹ ${cartTotal.toFixed(2)}`);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const file = `FoodBill_${student?.rollNo || student?.name || 'student'}_${ts}.pdf`;
      doc.save(file);
    } catch (_) {}
  };

  const confirmAndPurchase = async () => {
    if (!student?._id) return;
    if (cart.length === 0) return;
    try {
      setError('');
      // Final guard before purchase
      if (cartTotal > Number(student?.walletBalance || 0)) {
        setError('Insufficient wallet balance to proceed.');
        setShowConfirm(false);
        return;
      }
      // Print/save receipt first
      printBill();
      saveBillPdf();
      // Optimistic wallet update for instant UI refresh
      const spend = cartTotal;
      setStudent(s => s ? { ...s, walletBalance: Math.max(0, Number(s.walletBalance || 0) - Number(spend)) } : s);
      // Process items sequentially with a single receiptId for this purchase
      const receiptId = `FOOD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      for (const c of cart) {
        for (let i = 0; i < c.qty; i += 1) {
          await api.post('/transactions', {
            student: student._id,
            item: c._id,
            module: 'food',
            action: 'purchase',
            status: 'approved',
            receiptId,
          });
        }
      }
      clearCart();
      setShowConfirm(false);
      await findStudent();
      await loadAllScans();
      // Show confirmation message after successful post
      setSuccessMsg('Order confirmed. Receipt has been printed and saved as PDF.');
      setShowSuccessModal(true);
      // Auto-hide after 5 seconds
      setTimeout(() => setSuccessMsg(''), 5000);
      // Keep selected student after order until user cancels manually
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to complete purchase');
    }
  };

  const loadAllScans = async () => {
    try {
      const { data } = await api.get('/food/history-all');
      setAllHistory(data || []);
    } catch (_) {}
  };

  const findStudent = async () => {
    try {
      setError('');
      // Prefer fetching by id for freshest wallet balance
      if (student?._id) {
        const { data } = await api.get(`/admin/students/${student._id}`);
        if (data?._id) {
          setStudent(data);
          setRollNo(data.rollNo || rollNo || '');
          setRfid(data.rfid_uid || rfid || '');
          // Persist and broadcast
          try {
            const payload = {
              student: data,
              rollNo: data.rollNo || '',
              rfid: data.rfid_uid || '',
              walletBalance: data.walletBalance,
              source: 'food-find'
            };
            localStorage.setItem('last_student', JSON.stringify(payload));
            try { window?.socket?.emit?.('ui:rfid-scan', payload); } catch {}
          } catch {}
          return;
        }
      }
      if (!rollNo && !rfid) {
        setError('Enter a Roll Number or RFID to find a student.');
        return;
      }
      const params = {};
      if (rollNo) params.rollNo = rollNo;
      if (rfid) params.rfid_uid = rfid;
      const { data } = await api.get('/students/find', { params });
      if (data?._id) {
        setStudent(data);
        setRollNo(data.rollNo || rollNo || '');
        setRfid(data.rfid_uid || rfid || '');
        // Persist and broadcast
        try {
          const payload = {
            student: data,
            rollNo: data.rollNo || '',
            rfid: data.rfid_uid || '',
            walletBalance: data.walletBalance,
            source: 'food-find'
          };
          localStorage.setItem('last_student', JSON.stringify(payload));
          try { window?.socket?.emit?.('ui:rfid-scan', payload); } catch {}
        } catch {}
        // Auto-load history for this student
        try { await loadHistory(); } catch {}
      } else {
        setStudent(null);
        setError('Student not found.');
        try { localStorage.removeItem('last_student'); } catch {}
      }
    } catch (e) {
      setStudent(null);
      setError(e?.response?.data?.message || 'Error finding student.');
    }
  };

  const unscan = () => {
    setStudent(null);
    setRollNo('');
    setRfid('');
    clearCart();
    // localStorage cleared by effect below
    try {
      localStorage.removeItem('food_student');
      localStorage.removeItem('last_student');
    } catch (_) {}
  };

  // Per-page Web Serial scanner removed; use global Connect in Sidebar

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/items', { params: { type: 'food' } });
        setItems(res.data || []);
      } catch (_) {}
    })();

    // Initial load for recent scans
    loadAllScans();

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const onEvent = () => {
      loadAllScans();
      // refresh student-specific history if a student context is set
      if (student) {
        loadHistory();
        // Also refresh student to update wallet balance instantly
        findStudent();
      }
    };
    const onEsp32Scan = (payload) => {
      try {
        const uid = payload?.uid || payload?.rfid || payload?.RFIDNumber;
        const s = payload?.student;
        if (uid) setRfid(uid);
        if (s?._id) {
          setStudent(s);
          setRollNo(s.rollNo || '');
          setRfid(s.RFIDNumber || s.rfid_uid || uid || '');
          // Immediately refresh details and history
          findStudent();
          loadHistory();
        } else if (uid) {
          api.get(`/rfid/resolve/${uid}`).then(({ data }) => {
            if (data?._id) {
              setStudent(data);
              setRollNo(data.rollNo || '');
              setRfid(data.RFIDNumber || data.rfid_uid || uid);
              // Immediately refresh details and history
              findStudent();
              loadHistory();
            }
          }).catch(() => {});
        }
      } catch (_) {}
    };
    const onRfidPending = (tx) => {
      try {
        // Auto-select student on Food screen when a Food module scan is received
        if (tx && (tx.module === 'food' || tx.module === 'Food')) {
          const s = tx.student || null;
          if (s) {
            setStudent(s);
            setRollNo(s.rollNo || '');
            setRfid(s.RFIDNumber || s.rfid_uid || '');
          }
        }
      } catch (_) {}
    };
    socket.on('transaction:new', onEvent);
    socket.on('transaction:update', onEvent);
    socket.on('rfid:approved', onEvent);
    socket.on('rfid:pending', onEvent);
    socket.on('rfid:pending', onRfidPending);
    const onClear = () => { unscan(); };
    socket.on('esp32:rfid-clear', onClear);
    socket.on('esp32:rfid-scan', onEsp32Scan);
    // UI-level broadcasts from other modules
    socket.on('ui:rfid-clear', onClear);
    socket.on('ui:rfid-scan', onEsp32Scan);
    return () => {
      socket.off('transaction:new', onEvent);
      socket.off('transaction:update', onEvent);
      socket.off('rfid:approved', onEvent);
      socket.off('rfid:pending', onEvent);
      socket.off('rfid:pending', onRfidPending);
      socket.off('esp32:rfid-clear', onClear);
      socket.off('esp32:rfid-scan', onEsp32Scan);
      socket.off('ui:rfid-clear', onClear);
      socket.off('ui:rfid-scan', onEsp32Scan);
      socket.disconnect();
    };
  }, [student, rfid]);

  // Persist student and cart across navigation
  useEffect(() => {
    try {
      const savedStudent = localStorage.getItem('food_student');
      // Global fallback from Sidebar broadcaster
      const last = localStorage.getItem('last_student');
      const savedCart = localStorage.getItem('food_cart');
      if (savedStudent) {
        const s = JSON.parse(savedStudent);
        setStudent(s);
        setRollNo(s?.rollNo || '');
        setRfid(s?.rfid_uid || '');
        try { loadHistory(); } catch {}
      } else if (last) {
        const p = JSON.parse(last);
        if (p?.student) {
          setStudent(p.student);
          setRollNo(p.rollNo || p.student.rollNo || '');
          setRfid(p.rfid || p.student.rfid_uid || '');
          try { loadHistory(); } catch {}
        }
      }
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      if (student) localStorage.setItem('food_student', JSON.stringify(student));
      else localStorage.removeItem('food_student');
      localStorage.setItem('food_cart', JSON.stringify(cart));
    } catch (_) {}
  }, [student, cart]);

  // Removed inline add/purchase flows; use separate Add Food page and approvals.

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Food Court</h1>
          <Link to="/food/add" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Add Food</Link>
        </div>
        

        <div className="bg-white p-4 rounded shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Roll Number</label>
              <input value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="Enter Roll Number"
                     className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">RFID Number</label>
              <div className="flex items-center gap-2">
                <input value={rfid} onChange={e => setRfid(e.target.value)} placeholder="Scan or enter RFID"
                       className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={findStudent} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Find Student</button>
            </div>
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          {successMsg && <div className="mt-2 text-emerald-700 bg-emerald-50 border border-emerald-200 text-sm px-3 py-2 rounded">{successMsg}</div>}
          {student && (
            <div className="mt-3 text-sm text-gray-700 flex items-center gap-2 flex-wrap">
              <div>
                <span className="font-medium">Student:</span> {student.name} | <span className="font-medium">Wallet Balance:</span> ₹{student.walletBalance}
              </div>
              <button onClick={() => { unscan(); try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {} }} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-200">Cancel</button>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Order Food</h2>
            <div className="flex items-center gap-2">
              <input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder="Search food items"
                className="text-sm border rounded px-2 py-1 w-40 md:w-56"
              />
              <button onClick={() => setItemQuery(v => v.trim())} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">Search</button>
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-2">{student ? 'Ready to order' : 'Find a student to begin.'}</div>
          {items.length === 0 ? (
            <div className="text-gray-500">No food items yet. Use "Add Food" to create some.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map(it => {
                const qty = it.quantity ?? 0;
                const cardClass = `border rounded p-3 flex items-center justify-between ${qty === 0 ? 'opacity-50' : qty <= 5 ? 'bg-red-50 border-red-200' : ''}`;
                const qtyClass = `text-sm ${qty === 0 ? 'text-gray-400' : qty <= 5 ? 'text-red-600' : 'text-gray-600'}`;
                return (
                  <div key={it._id} className={cardClass} title={qty === 0 ? 'Out of stock' : qty <= 5 ? 'Low stock' : undefined}>
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className={qtyClass}>₹{it.price ?? '-'} · Qty {qty}</div>
                    </div>
                    <button
                      disabled={!student || qty === 0}
                      onClick={() => addToCart(it)}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-60"
                    >
                      Add to Cart
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Panel */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Cart</h2>
            <div className="text-sm text-gray-600">Total: <span className="font-medium">₹ {cartTotal.toFixed(2)}</span></div>
          </div>
          {cart.length === 0 ? (
            <div className="text-gray-500">No items in cart.</div>
          ) : (
            <div className="space-y-2">
              {cart.map(c => (
                <div key={c._id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-gray-600">₹ {c.price} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 bg-gray-100 rounded" onClick={() => updateQty(c._id, -1)}>-</button>
                    <span className="w-6 text-center">{c.qty}</span>
                    <button className="px-2 py-1 bg-gray-100 rounded" onClick={() => updateQty(c._id, 1)}>+</button>
                    <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={() => removeFromCart(c._id)}>Remove</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button className="px-3 py-1 bg-gray-100 rounded" onClick={clearCart}>Clear</button>
                <button disabled={!student || cart.length===0 || cartTotal > Number(student?.walletBalance || 0)}
                        onClick={() => setShowConfirm(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-60">
                  Proceed
                </button>
              </div>
              {student && cart.length>0 && cartTotal > Number(student?.walletBalance || 0) && (
                <div className="mt-2 text-sm text-red-600">Insufficient wallet balance. Remove items or reduce quantities.</div>
              )}
            </div>
          )}
        </div>

        {/* Confirm Modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow p-4 w-full max-w-md">
              <div className="text-lg font-semibold mb-2">Confirm Purchase</div>
              <div className="text-sm mb-3">Student: <b>{student?.name}</b> · RFID: <span className="font-mono">{student?.rfid_uid}</span></div>
              <div className="max-h-60 overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Item</th>
                      <th className="px-2 py-1 text-right">Qty</th>
                      <th className="px-2 py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(c => (
                      <tr key={c._id} className="border-t">
                        <td className="px-2 py-1">{c.name}</td>
                        <td className="px-2 py-1 text-right">{c.qty}</td>
                        <td className="px-2 py-1 text-right">₹ {(c.qty*Number(c.price)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td className="px-2 py-1 font-medium">Total</td>
                      <td></td>
                      <td className="px-2 py-1 text-right font-semibold">₹ {cartTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <button className="px-3 py-1 bg-gray-100 rounded" onClick={() => setShowConfirm(false)}>Cancel</button>
                <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={printBill}>Print Bill</button>
                <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded" onClick={confirmAndPurchase}>Confirm & Purchase</button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow p-5 w-full max-w-sm">
              <div className="text-lg font-semibold mb-2">Order Confirmed</div>
              <p className="text-sm text-gray-700">Receipt has been printed and saved as PDF to your downloads.</p>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded" onClick={() => setShowSuccessModal(false)}>OK</button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">More</h2>
            <div className="flex gap-2">
              <Link
                to={`/food/history${student?.rollNo ? `?rollNo=${encodeURIComponent(student.rollNo)}` : ''}`}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Purchase History
              </Link>
              <Link
                to="/food/scans"
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Show All Scans
              </Link>
            </div>
          </div>
        </div>

        {/* All scans moved to dedicated page via button above */}
      </div>
    </div>
  );
}
