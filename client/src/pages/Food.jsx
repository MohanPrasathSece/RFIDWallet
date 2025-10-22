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
  const [todaysSales, setTodaysSales] = useState(0);

  const loadHistory = async (overrides = {}) => {
    try {
      setLoading(true);
      // Prefer explicit overrides, then current state
      const sid = overrides.studentId || (student?._id);
      const rfidParam = overrides.rfid || rfid;
      let params = sid ? { student: sid } : (rfidParam ? { rfidNumber: rfidParam } : null);
      if (!params && rollNo) {
        try {
          const { data } = await api.get('/students/find', { params: { rollNo } });
          if (data?._id) {
            setStudent(data);
            params = { student: data._id };
          }
        } catch (_) {}
      }
      if (!params) {
        if (!overrides.silent) {
          setError('Find a student to load their history.');
          setHistory([]);
        }
        return;
      }
      setError('');
      const res = await api.get('/food/history', { params });
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
      if (rfid) params.rfid_uid = rfid; // prefer RFID if both provided
      else if (rollNo) params.rollNo = rollNo;
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
        // Auto-load history for this student without flashing errors
        try { await loadHistory({ studentId: data._id, silent: true }); } catch {}
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
    (async () => {
      try {
        const { data } = await api.get('/admin/sales/today?module=food');
        setTodaysSales(data.totalSales || 0);
      } catch (e) {
        console.error("Failed to fetch today's sales", e);
      }
    })();

    // Initial load for recent scans
    loadAllScans();

    const socket = (typeof window !== 'undefined' && window.socket) ? window.socket : io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const onEvent = () => {
      loadAllScans();
      // refresh student-specific history if a student context is set
      if (student) {
        loadHistory();
        // Also refresh student to update wallet balance instantly
        findStudent();
      }
    };
    const onWalletUpdated = (p) => {
      try {
        const sid = p?.studentId;
        if (!sid) return;
        if (student?._id && sid === student._id) {
          api.get(`/admin/students/${sid}`).then(({ data }) => {
            if (data?._id) setStudent(data);
          }).catch(()=>{});
        }
      } catch (_) {}
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
    socket.on('wallet:updated', onWalletUpdated);
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
      // Do not disconnect shared global socket
      if (!(typeof window !== 'undefined' && window.socket === socket)) {
        socket.disconnect();
      }
    };
  }, [student, rfid]);

  // Clear any stale "find a student" error once a student is present
  useEffect(() => {
    if (student) setError('');
  }, [student]);

  // Listen to window-level UI events to sync across modules in the same tab
  useEffect(() => {
    const onUiClear = () => { unscan(); };
    const onUiScan = (e) => {
      try {
        const p = e?.detail;
        const s = p?.student;
        if (s?._id) {
          setStudent(s);
          setRollNo(p?.rollNo || s.rollNo || '');
          setRfid(p?.rfid || s.rfid_uid || '');
          try { loadHistory(); } catch {}
        }
      } catch (_) {}
    };
    try { window.addEventListener('ui:rfid-clear', onUiClear); } catch {}
    try { window.addEventListener('ui:rfid-scan', onUiScan); } catch {}
    return () => {
      try { window.removeEventListener('ui:rfid-clear', onUiClear); } catch {}
      try { window.removeEventListener('ui:rfid-scan', onUiScan); } catch {}
    };
  }, []);

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
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-400/20 to-red-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-1/2 w-80 h-80 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 p-6 max-w-7xl mx-auto">
          
          <div className="space-y-6">

            {/* Enhanced Student Search Section */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Student Information</label>
                  <input
                    value={rollNo}
                    onChange={e => setRollNo(e.target.value)}
                    placeholder="Roll Number"
                    className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">RFID Scanner</label>
                  <input
                    value={rfid}
                    onChange={e => setRfid(e.target.value)}
                    placeholder="Scan or enter RFID"
                    className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={findStudent} className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                    Find Student
                  </button>
                  <button onClick={() => { unscan(); try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {} }} className="px-4 py-3 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                    Clear
                  </button>
                </div>
              </div>

              {/* Status Messages */}
              {error && <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700 rounded-xl"><p className="text-sm text-red-800 dark:text-red-300">{error}</p></div>}
              {successMsg && <div className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl"><p className="text-sm text-emerald-800 dark:text-emerald-300">{successMsg}</p></div>}

              {student && (
                <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-bold text-orange-900 dark:text-orange-100 text-lg">{student.name}</div>
                      <div className="text-sm text-orange-700 dark:text-orange-300">Roll: {student.rollNo} • Wallet: ₹{student.walletBalance}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-orange-600 dark:text-orange-400">Ready to Order</div>
                      <div className="text-xs text-orange-500 dark:text-orange-500 mt-1">🍽️ RFID Enabled</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Items + Cart Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
              {/* Enhanced Food Items Section */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl flex items-center justify-center">
                      <span className="text-xl text-orange-600 dark:text-orange-400">🍔</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Order Food Items</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                      placeholder="Search food items"
                      className="text-sm border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 w-48 bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                    <button onClick={() => setItemQuery(v => v.trim())} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                      Search
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {student ? '🎯 Ready to order - select items below' : '👤 Find a student first to begin ordering'}
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl text-gray-400 dark:text-gray-500">🍽️</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">No food items available</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add food items using "Add Food Item" button</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {filteredItems.map(it => {
                      const qty = it.quantity ?? 0;
                      const cardClass = `border-2 border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-700/50 rounded-xl p-3 flex items-center justify-between transition-all duration-200 hover:shadow-lg hover:scale-105 ${qty === 0 ? 'opacity-50 border-gray-300 dark:border-gray-500' : qty <= 5 ? 'border-red-200 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' : 'hover:border-orange-300 dark:hover:border-orange-600'}`;
                      const qtyClass = `text-sm font-medium ${qty === 0 ? 'text-gray-400 dark:text-gray-500' : qty <= 5 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`;
                      return (
                        <div key={it._id} className={cardClass} title={qty === 0 ? 'Out of stock' : qty <= 5 ? 'Low stock' : undefined}>
                          <div className="flex-1">
                            <div className="font-bold text-base text-gray-900 dark:text-gray-100">{it.name}</div>
                            <div className={qtyClass}>₹{it.price ?? '-'} • Qty: {qty}</div>
                          </div>
                          <button
                            disabled={!student || qty === 0}
                            onClick={() => addToCart(it)}
                            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                          >
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Enhanced Cart Sidebar */}
              <aside className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 lg:sticky lg:top-6 h-fit">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl flex items-center justify-center">
                      <span className="text-xl text-amber-600 dark:text-amber-400">🛒</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Shopping Cart</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
                    <div className="text-xl font-bold text-orange-600 dark:text-orange-400">₹{cartTotal.toFixed(2)}</div>
                  </div>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl text-gray-400 dark:text-gray-500">🛒</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">Cart is empty</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add items to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(c => (
                      <div key={c._id} className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700/50 dark:to-slate-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-3 transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{c.name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">₹{c.price} each</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button className="w-7 h-7 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200" onClick={() => updateQty(c._id, -1)}>-</button>
                            <span className="w-7 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{c.qty}</span>
                            <button className="w-7 h-7 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200" onClick={() => updateQty(c._id, 1)}>+</button>
                            <button className="w-7 h-7 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-all duration-200" onClick={() => removeFromCart(c._id)}>×</button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button className="px-4 py-2 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200" onClick={clearCart}>
                        Clear Cart
                      </button>
                      <button
                        disabled={!student || cart.length===0 || cartTotal > Number(student?.walletBalance || 0)}
                        onClick={() => setShowConfirm(true)}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        Proceed
                      </button>
                    </div>

                    {student && cart.length>0 && cartTotal > Number(student?.walletBalance || 0) && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700 rounded-xl">
                        <p className="text-xs text-red-800 dark:text-red-300">⚠️ Insufficient wallet balance. Remove items or reduce quantities.</p>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            </div>

            {/* Enhanced Confirmation Modal */}
            {showConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-xl flex items-center justify-center">
                      <span className="text-xl text-emerald-600 dark:text-emerald-400">✅</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Confirm Purchase</h3>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    <div className="font-medium mb-2">Student: <span className="font-bold">{student?.name}</span></div>
                    <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded">RFID: {student?.rfid_uid}</div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-900 dark:text-gray-100">Item</th>
                          <th className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">Qty</th>
                          <th className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map(c => (
                          <tr key={c._id} className="border-t border-gray-200 dark:border-gray-600">
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{c.name}</td>
                            <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{c.qty}</td>
                            <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">₹{(c.qty*Number(c.price)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                          <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">Total</td>
                          <td></td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">₹{cartTotal.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-xl text-sm font-semibold transition-all duration-200" onClick={() => setShowConfirm(false)}>
                      Cancel
                    </button>
                    <button className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200" onClick={printBill}>
                      Print Bill
                    </button>
                    <button className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200" onClick={confirmAndPurchase}>
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Success Modal */}
            {showSuccessModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700 shadow-2xl">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl text-emerald-600 dark:text-emerald-400">✅</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Order Confirmed!</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Receipt has been printed and saved as PDF to your downloads.</p>
                    <button className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 w-full" onClick={() => setShowSuccessModal(false)}>
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Navigation Links */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Quick Actions</h3>
                <div className="flex gap-3">
                  <Link
                    to={`/food/history${student?.rollNo ? `?rollNo=${encodeURIComponent(student.rollNo)}` : ''}`}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    Purchase History
                  </Link>
                  <Link
                    to="/food/scans"
                    className="px-4 py-2 border-2 border-orange-200 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-xl text-sm font-semibold transition-all duration-200"
                  >
                    Show All Scans
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
