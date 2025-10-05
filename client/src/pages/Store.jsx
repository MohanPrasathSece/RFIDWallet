import Sidebar from '../shared/Sidebar.jsx';
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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Store</h1>
            <div className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-md">
              Today's Sales: <span className="font-bold text-green-700">₹{todaysSales.toFixed(2)}</span>
            </div>
          </div>
          <Link to="/store/add" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Add Store Item</Link>
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
              <button onClick={loadHistory} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded">Load History</button>
            </div>
            {loading && <div className="text-gray-500">Loading...</div>}
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          {student && (
            <div className="mt-3 text-sm text-gray-700 flex items-center gap-2 flex-wrap">
              <div>
                <span className="font-medium">Student:</span> {student.name} | <span className="font-medium">Wallet Balance:</span> ₹{student.walletBalance}
              </div>
              <button onClick={() => { setError(''); clearCart(); setStudent(null); setStudentId(''); setRollNo(''); setRfid(''); setWalletBalance(null); try { localStorage.removeItem('last_student'); localStorage.removeItem('food_student'); } catch {}; try { window?.socket?.emit?.('ui:rfid-clear', {}); } catch {}; try { window.dispatchEvent(new CustomEvent('ui:rfid-clear', { detail: {} })); } catch {} }} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-200">Cancel</button>
            </div>
          )}
        </div>

        {/* Items + Cart layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Items */}
          <div className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Order Item</h2>
              <div className="flex items-center gap-2">
                <input
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Search store items"
                  className="text-sm border rounded px-2 py-1 w-40 md:w-56"
                />
                <button onClick={() => setItemQuery(v => v.trim())} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">Search</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2">{(student || studentId || rfid) ? 'Ready to order' : 'Find a student to begin.'}</div>
            {items.length === 0 ? (
              <div className="text-gray-500">No store items yet. Use "Add Store Item" to create some.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                        disabled={(!student && !studentId) || qty === 0}
                        onClick={() => addToCart(it)}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-60 flex-shrink-0"
                      >
                        Add to Cart
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <aside className="bg-white p-3 rounded shadow lg:sticky lg:top-4 h-fit max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold">Cart</h2>
              <div className="text-xs text-gray-600">Total: <span className="font-medium">₹ {cartTotal.toFixed(2)}</span></div>
            </div>
            {cart.length === 0 ? (
              <div className="text-gray-500 text-sm">No items in cart.</div>
            ) : (
              <div className="space-y-2">
                {cart.map(c => (
                  <div key={c._id} className="flex items-center justify-between border rounded px-2 py-1">
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-gray-600">₹ {c.price} each</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="px-2 py-0.5 bg-gray-100 rounded" onClick={() => updateQty(c._id, -1)}>-</button>
                      <span className="w-6 text-center text-sm">{c.qty}</span>
                      <button className="px-2 py-0.5 bg-gray-100 rounded" onClick={() => updateQty(c._id, 1)}>+</button>
                      <button className="px-2 py-0.5 bg-red-100 text-red-700 rounded" onClick={() => removeFromCart(c._id)}>x</button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={clearCart}>Clear</button>
                  <button
                    disabled={(!student && !studentId) || cart.length===0 || cartTotal > currentBalance}
                    onClick={() => setShowConfirm(true)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm disabled:opacity-60"
                  >
                    Proceed
                  </button>
                </div>
                {cart.length>0 && cartTotal > currentBalance && (
                  <div className="mt-1 text-xs text-red-600">Insufficient wallet balance. Remove items or reduce quantities.</div>
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Purchase History</h2>
            <button onClick={loadHistory} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
          </div>
          {history.length === 0 ? (
            <div className="text-gray-500">No history.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">RFID</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row._id} className="border-t">
                      <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{row.action}</td>
                      <td className="px-3 py-2">{row.item?.name || '-'}</td>
                      <td className="px-3 py-2">{row.student?.name || '-'}</td>
                      <td className="px-3 py-2">{row.student?.rfid_uid || row.student?.rfid || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">More</h2>
            <div className="flex gap-2">
              <Link
                to={`/store/history${student?.rollNo ? `?rollNo=${encodeURIComponent(student.rollNo)}` : ''}`}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Purchase History
              </Link>
              <Link
                to="/store/scans"
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Show All Scans
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
