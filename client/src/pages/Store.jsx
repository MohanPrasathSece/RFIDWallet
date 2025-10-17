import { useEffect, useMemo, useState } from 'react';
import { api } from '../shared/api.js';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';

export default function Store() {
  const [rollNo, setRollNo] = useState('');
  const [rfid, setRfid] = useState('');
  const [student, setStudent] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [itemQuery, setItemQuery] = useState('');
  // Cart state: array of { _id, name, price, qty }
  const [cart, setCart] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState(null);
  const [todaysSales, setTodaysSales] = useState(0);

  const loadHistory = async () => {
    try {
      setLoading(true); setError('');
      let params = studentId ? { student: studentId } : (rfid ? { rfidNumber: rfid } : null);
      // Fallback: resolve by roll number if available
      if (!params && rollNo) {
        try {
          const { data } = await api.get('/students/find', { params: { rollNo } });
          if (data?._id) {
            setStudent(data);
            setStudentId(data._id);
            setRfid(data.rfid_uid || rfid || '');
            params = { student: data._id };
          }
        } catch (_) {}
      }
      if (!params) { setError('Enter Student ID, RFID Number, or Roll Number'); setHistory([]); return; }
      const res = await api.get('/store/history', { params });
      setHistory(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
      setHistory([]);
    } finally { setLoading(false); }
  };

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => (it.name || '').toLowerCase().includes(q));
  }, [items, itemQuery]);

  // New cart-style flow (mirrors Food)
  const currentBalance = Number((student && student.walletBalance != null) ? student.walletBalance : (walletBalance ?? 0)) || 0;
  const cartTotal = cart.reduce((sum, it) => sum + (Number(it.price) * it.qty), 0);

  const addToCart = (it) => {
    if (!student?._id && !studentId) {
      setError('Select a student first.');
      return;
    }
    setError('');
    const price = Number(it.price) || 0;
    const proposed = cartTotal + price;
    if (currentBalance < proposed) {
      setError('Insufficient wallet balance for this item.');
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(x => x._id === it._id);
      if (idx >= 0) {
        const copy = [...prev];
        const nextTotal = cartTotal + price;
        if (currentBalance < nextTotal) {
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
        const proposed = cartTotal + price;
        if (currentBalance < proposed) {
          setError('Insufficient wallet balance to increase quantity.');
          return prev;
        }
      }
      return prev.map(it => it._id === id ? { ...it, qty: Math.max(1, it.qty + delta) } : it);
    });
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(it => it._id !== id));
  const clearCart = () => setCart([]);

  const printBill = () => {
    if (!student) return;
    const w = window.open('', 'PRINT', 'height=600,width=400');
    const lines = [
      `<h3 style="margin:0">Store Bill</h3>`,
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
      put('Store Bill');
      put(`Student: ${student?.name || ''}`);
      put(`Roll No: ${student?.rollNo || ''}`);
      put(`RFID: ${student?.rfid_uid || ''}`);
      y += 2;
      put('Items:');
      cart.forEach(c => put(`- ${c.name}  x${c.qty}  = ₹ ${(c.qty * Number(c.price)).toFixed(2)}`));
      y += 2;
      put(`Total: ₹ ${cartTotal.toFixed(2)}`);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const file = `StoreBill_${student?.rollNo || student?.name || 'student'}_${ts}.pdf`;
      doc.save(file);
    } catch (_) {}
  };

  const confirmAndPurchase = async () => {
    const sid = student?._id || studentId;
    if (!sid) return;
    if (cart.length === 0) return;
    try {
      setError('');
      if (cartTotal > currentBalance) {
        setError('Insufficient wallet balance to proceed.');
        setShowConfirm(false);
        return;
      }
      printBill();
      saveBillPdf();
      // Optimistic wallet update for instant UI feedback
      const spend = cartTotal;
      setWalletBalance(prev => {
        const base = (prev != null) ? prev : Number(student?.walletBalance || 0);
        return Math.max(0, Number(base) - Number(spend));
      });
      setStudent(s => s ? { ...s, walletBalance: Math.max(0, Number(s.walletBalance || 0) - Number(spend)) } : s);
      const receiptId = `STORE-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      for (const c of cart) {
        for (let i = 0; i < c.qty; i += 1) {
          await api.post('/transactions', {
            student: sid,
            item: c._id,
            module: 'store',
            action: 'purchase',
            status: 'approved',
            receiptId,
          });
        }
      }
      clearCart();
      setShowConfirm(false);
      // refresh selected student balance
      try {
        const { data: s } = await api.get(`/admin/students/${sid}`);
        if (s?.walletBalance !== undefined) setWalletBalance(s.walletBalance);
      } catch (_) {}
      await Promise.all([loadHistory(), loadAllScans()]);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to complete purchase');
    }
  };

  const loadAllScans = async () => {
    try {
      const { data } = await api.get('/store/history-all');
      setAllHistory(data || []);
    } catch (_) {}
  };

  // Per-page Web Serial scanner removed; use global Connect in Sidebar

  const findStudent = async () => {
    try {
      setError('');
      // Prefer fetching by id for freshest wallet balance
      if (studentId) {
        const { data } = await api.get(`/admin/students/${studentId}`);
        if (data?._id) {
          setStudent(data);
          setRollNo(data.rollNo || rollNo || '');
          setRfid(data.rfid_uid || rfid || '');
          setWalletBalance(data.walletBalance ?? null);
          // Persist and broadcast so other modules/pages can reuse current student
          try {
            const payload = {
              student: data,
              rollNo: data.rollNo || '',
              rfid: data.rfid_uid || '',
              walletBalance: data.walletBalance,
              source: 'store-find'
            };
            localStorage.setItem('last_student', JSON.stringify(payload));
            try { window?.socket?.emit?.('ui:rfid-scan', payload); } catch {}
          } catch {}
          // Immediately load history for this student
          try {
            const resHist = await api.get('/store/history', { params: { student: data._id } });
            setHistory(resHist.data || []);
          } catch (_) {}
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
        setStudentId(data._id);
        setRollNo(data.rollNo || rollNo || '');
        setRfid(data.rfid_uid || rfid || '');
        setWalletBalance(data.walletBalance ?? null);
        // Persist and broadcast selection for cross-module consistency
        try {
          const payload = {
            student: data,
            rollNo: data.rollNo || '',
            rfid: data.rfid_uid || '',
            walletBalance: data.walletBalance,
            source: 'store-find'
          };
          localStorage.setItem('last_student', JSON.stringify(payload));
          try { window?.socket?.emit?.('ui:rfid-scan', payload); } catch {}
        } catch {}
        // Immediately load history for this student
        try {
          const resHist = await api.get('/store/history', { params: { student: data._id } });
          setHistory(resHist.data || []);
        } catch (_) {}
      } else {
        setStudent(null);
        setStudentId('');
        setWalletBalance(null);
        setError('Student not found.');
        try { localStorage.removeItem('last_student'); } catch {}
      }
    } catch (e) {
      setStudent(null);
      setStudentId('');
      setWalletBalance(null);
      setError(e?.response?.data?.message || 'Error finding student.');
    }
  };

  const orderItem = async (itemId) => {
    try {
      setError('');
      let sid = studentId;
      if (!sid && rfid) {
        try {
          const { data } = await api.get(`/rfid/resolve/${rfid}`);
          sid = data?._id; if (sid) setStudentId(sid);
        } catch (_) { setError('Could not resolve RFID to a student'); return; }
      }
      if (!sid) { setError('Select a student first'); return; }
      const res = await api.post('/transactions', {
        student: sid,
        item: itemId,
        module: 'store',
        action: 'purchase',
        status: 'approved',
      });
      if (res?.data?._id) {
        await Promise.all([loadHistory(), loadAllScans()]);
        // Refresh wallet
        try {
          const { data: s } = await api.get(`/admin/students/${sid}`);
          if (s?.walletBalance !== undefined) setWalletBalance(s.walletBalance);
        } catch (_) {}
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to place order');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/items', { params: { type: 'store' } });
        setItems(data || []);
      } catch (_) {}
    })();
    (async () => {
      try {
        const { data } = await api.get('/admin/sales/today?module=store');
        setTodaysSales(data.totalSales || 0);
      } catch (e) {
        console.error("Failed to fetch today's sales", e);
      }
    })();
    loadAllScans();
    // Hydrate from global broadcaster cache
    try {
      const last = localStorage.getItem('last_student');
      if (last) {
        const p = JSON.parse(last);
        if (p?.student) {
          setStudent(p.student);
          setStudentId(p.student._id);
          setRollNo(p.rollNo || p.student.rollNo || '');
          setRfid(p.rfid || p.student.rfid_uid || '');
          if (p.student.walletBalance !== undefined) setWalletBalance(p.student.walletBalance);
          try { loadHistory(); } catch {}
        }
      }
    } catch (_) {}
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const onEvent = () => {
      loadAllScans();
      if (studentId || rfid) {
        loadHistory();
        // Also refresh current student to update wallet instantly
        findStudent();
      }
    };
    const onWalletUpdated = (p) => {
      try {
        const sid = p?.studentId;
        if (!sid) return;
        if (sid === (student?._id || studentId)) {
          // Fetch latest balance and update
          api.get(`/admin/students/${sid}`).then(({ data }) => {
            if (data?._id) {
              setStudent(data);
              if (data.walletBalance !== undefined) setWalletBalance(data.walletBalance);
            }
          }).catch(()=>{});
        }
      } catch (_) {}
    };
    const onClear = () => {
      setError('');
      clearCart();
      setStudent(null);
      setStudentId('');
      setRollNo('');
      setRfid('');
      setWalletBalance(null);
      try { localStorage.removeItem('last_student'); } catch {}
    };
    const onEsp32Scan = (payload) => {
      try {
        const uid = payload?.uid || payload?.rfid || payload?.RFIDNumber;
        const s = payload?.student;
        const rn = payload?.rollNo;
        if (uid) setRfid(uid);
        // New scan: reset UI cart/errors to switch context cleanly
        setError('');
        clearCart();
        if (s?._id) {
          setStudent(s);
          setStudentId(s._id);
          setRollNo(s.rollNo || rn || '');
          setWalletBalance(s.walletBalance ?? null);
          try { loadHistory(); } catch {}
        } else if (uid) {
          api.get(`/rfid/resolve/${uid}`).then(({ data }) => {
            if (data?._id) {
              setStudent(data);
              setStudentId(data._id);
              setRollNo(data.rollNo || rn || '');
              setWalletBalance(data.walletBalance ?? null);
              try { loadHistory(); } catch {}
            }
          }).catch(() => {});
        }
      } catch (_) {}
    };
    socket.on('transaction:new', onEvent);
    socket.on('transaction:update', onEvent);
    socket.on('rfid:approved', onEvent);
    socket.on('rfid:pending', onEvent);
    socket.on('esp32:rfid-scan', onEsp32Scan);
    socket.on('wallet:updated', onWalletUpdated);
    socket.on('esp32:rfid-clear', onClear);
    // UI-level broadcasts to sync with other modules
    socket.on('ui:rfid-scan', onEsp32Scan);
    socket.on('ui:rfid-clear', onClear);
    return () => {
      socket.off('transaction:new', onEvent);
      socket.off('transaction:update', onEvent);
      socket.off('rfid:approved', onEvent);
      socket.off('rfid:pending', onEvent);
      socket.off('esp32:rfid-scan', onEsp32Scan);
      socket.off('esp32:rfid-clear', onClear);
      socket.off('ui:rfid-scan', onEsp32Scan);
      socket.off('ui:rfid-clear', onClear);
      socket.off('wallet:updated', onWalletUpdated);
      socket.disconnect();
    };
  }, [studentId, rfid]);

  // Same-tab wallet update listener
  useEffect(() => {
    const onWalletUpdatedWin = (e) => {
      try {
        const sid = e?.detail?.studentId;
        if (!sid) return;
        if (sid === (student?._id || studentId)) {
          api.get(`/admin/students/${sid}`).then(({ data }) => {
            if (data?._id) {
              setStudent(data);
              if (data.walletBalance !== undefined) setWalletBalance(data.walletBalance);
            }
          }).catch(()=>{});
        }
      } catch (_) {}
    };
    try { window.addEventListener('wallet:updated', onWalletUpdatedWin); } catch {}
    return () => { try { window.removeEventListener('wallet:updated', onWalletUpdatedWin); } catch {} };
  }, [student, studentId]);

  // Clear any stale error once a student context is present
  useEffect(() => {
    if (student || studentId) setError('');
  }, [student, studentId]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-teal-400/20 to-cyan-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-1/2 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-cyan-400/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 p-6 max-w-7xl mx-auto">
          {/* Enhanced Header Section */}
          <div className="text-center space-y-2 py-4 mb-4">
            <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-gray-700 dark:text-gray-300 font-semibold">Campus Store</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Enhanced Header with Sales Info */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 rounded-xl flex items-center justify-center">
                    <span className="text-2xl text-cyan-600 dark:text-cyan-400">🛒</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Campus Store Management</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-xl">
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">Today's Sales:</span>
                        <span className="font-bold text-green-800 dark:text-green-200 ml-2">₹{todaysSales.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Link to="/store/add" className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                  Add Store Item
                </Link>
              </div>
            </div>

            {/* Enhanced Student Search Section */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Student Information</label>
                  <input
                    value={rollNo}
                    onChange={e => setRollNo(e.target.value)}
                    placeholder="Roll Number"
                    className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">RFID Scanner</label>
                  <input
                    value={rfid}
                    onChange={e => setRfid(e.target.value)}
                    placeholder="Scan or enter RFID"
                    className="w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 hover:bg-white dark:hover:bg-gray-700"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={findStudent} className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                    Find Student
                  </button>
                  <button onClick={loadHistory} className="px-4 py-3 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                    Load History
                  </button>
                </div>
                <div className="flex items-center">
                  {loading && <div className="text-gray-500 dark:text-gray-400 flex items-center gap-2"><div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>Loading...</div>}
                </div>
              </div>

              {/* Status Messages */}
              {error && <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700 rounded-xl"><p className="text-sm text-red-800 dark:text-red-300">{error}</p></div>}

              {student && (
                <div className="mt-4 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-700 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-bold text-cyan-900 dark:text-cyan-100 text-lg">{student.name}</div>
                      <div className="text-sm text-cyan-700 dark:text-cyan-300">Roll: {student.rollNo} • Wallet: ₹{student.walletBalance}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-cyan-600 dark:text-cyan-400">Ready to Shop</div>
                      <div className="text-xs text-cyan-500 dark:text-cyan-500 mt-1">🛒 RFID Enabled</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Items + Cart Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
              {/* Enhanced Store Items Section */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 rounded-xl flex items-center justify-center">
                      <span className="text-xl text-cyan-600 dark:text-cyan-400">🛍️</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Store Items</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                      placeholder="Search store items"
                      className="text-sm border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 w-48 bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                    />
                    <button onClick={() => setItemQuery(v => v.trim())} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                      Search
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {(student || studentId || rfid) ? '🛒 Ready to shop - select items below' : '👤 Find a student first to begin shopping'}
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl text-gray-400 dark:text-gray-500">🛍️</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">No store items available</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add items using "Add Store Item" button</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {filteredItems.map(it => {
                      const qty = it.quantity ?? 0;
                      const cardClass = `border-2 border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-700/50 rounded-xl p-3 flex items-center justify-between transition-all duration-200 hover:shadow-lg hover:scale-105 h-20 ${qty === 0 ? 'opacity-50 border-gray-300 dark:border-gray-500' : qty <= 5 ? 'border-red-200 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' : 'hover:border-cyan-300 dark:hover:border-cyan-600'}`;
                      const qtyClass = `text-sm font-medium ${qty === 0 ? 'text-gray-400 dark:text-gray-500' : qty <= 5 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`;
                      return (
                        <div key={it._id} className={cardClass} title={qty === 0 ? 'Out of stock' : qty <= 5 ? 'Low stock' : undefined}>
                          <div className="flex-1">
                            <div className="font-bold text-base text-gray-900 dark:text-gray-100">{it.name}</div>
                            <div className={qtyClass}>₹{it.price ?? '-'} • Qty: {qty}</div>
                          </div>
                          <button
                            disabled={(!student && !studentId) || qty === 0}
                            onClick={() => addToCart(it)}
                            className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl flex items-center justify-center">
                      <span className="text-xl text-blue-600 dark:text-blue-400">🛒</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Shopping Cart</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
                    <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">₹{cartTotal.toFixed(2)}</div>
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
                        disabled={(!student && !studentId) || cart.length===0 || cartTotal > currentBalance}
                        onClick={() => setShowConfirm(true)}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        Proceed to Pay
                      </button>
                    </div>

                    {cart.length>0 && cartTotal > currentBalance && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-700 rounded-xl">
                        <p className="text-xs text-red-800 dark:text-red-300">⚠️ Insufficient wallet balance. Remove items or reduce quantities.</p>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            </div>

            {/* Enhanced Purchase History Section */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl flex items-center justify-center">
                    <span className="text-xl text-indigo-600 dark:text-indigo-400">📋</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Purchase History</h3>
                </div>
                <button onClick={loadHistory} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                  Refresh
                </button>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl text-gray-400 dark:text-gray-500">📋</span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">No purchase history</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Purchases will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">When</th>
                        <th className="px-4 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Action</th>
                        <th className="px-4 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Item</th>
                        <th className="px-4 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">Student</th>
                        <th className="px-4 py-3 text-left text-gray-900 dark:text-gray-100 font-semibold">RFID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(row => (
                        <tr key={row._id} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{new Date(row.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 capitalize text-gray-900 dark:text-gray-100">{row.action}</td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{row.item?.name || '-'}</td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{row.student?.name || '-'}</td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-mono text-xs">{row.student?.rfid_uid || row.student?.rfid || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Enhanced Navigation Links */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Quick Actions</h3>
                <div className="flex gap-3">
                  <Link
                    to={`/store/history${student?.rollNo ? `?rollNo=${encodeURIComponent(student.rollNo)}` : ''}`}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    Purchase History
                  </Link>
                  <Link
                    to="/store/scans"
                    className="px-4 py-2 border-2 border-cyan-200 dark:border-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 rounded-xl text-sm font-semibold transition-all duration-200"
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
