import Sidebar from '../shared/Sidebar.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api.js';

export default function Admin() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' });
  const [walletInputs, setWalletInputs] = useState({});
  const [rfidReader, setRfidReader] = useState(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const loadStudents = async () => {
    try {
      const res = await api.get('/admin/students');
      setStudents(res.data || []);
    } catch (_) {}
  };

  useEffect(() => { loadStudents(); }, []);

  const deposit = async (id) => {
    try {
      setError('');
      const amt = Number(walletInputs[id] || 0);
      if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
      await api.post('/admin/wallet/deposit', { studentId: id, amount: amt });
      await loadStudents();
      setWalletInputs(v => ({ ...v, [id]: '' }));
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to deposit');
    }
  };

  const withdraw = async (id) => {
    try {
      setError('');
      const amt = Number(walletInputs[id] || 0);
      if (!amt || amt <= 0) { setError('Enter a positive amount'); return; }
      await api.post('/admin/wallet/withdraw', { studentId: id, amount: amt });
      await loadStudents();
      setWalletInputs(v => ({ ...v, [id]: '' }));
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to withdraw');
    }
  };

  const addStudent = async () => {
    try {
      setError(''); setSaving(true);
      const required = ['name', 'rollNo', 'email', 'password', 'RFIDNumber'];
      for (const field of required) {
        if (!form[field]) {
          setError(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
          return;
        }
      }
      await api.post('/admin/students', form);
      setForm({ name: '', rollNo: '', email: '', mobileNumber: '', password: '', RFIDNumber: '', department: '' });
      await loadStudents();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to add student');
    } finally { setSaving(false); }
  };

  const connectRfidReader = async () => {
    if (!('serial' in navigator)) {
      setError('Web Serial API not supported in this browser.');
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });

      const reader = port.readable.getReader();
      setRfidReader(reader);

      setError(''); // Clear previous errors

      // Listen for data from the serial port
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // Allow the serial port to be closed later.
          reader.releaseLock();
          break;
        }
        // value is a Uint8Array. Convert it to a string.
        const textDecoder = new TextDecoder();
        const rfid = textDecoder.decode(value).trim();
        if (rfid) {
          setForm(v => ({ ...v, RFIDNumber: rfid }));
          reader.releaseLock();
          port.close();
          break;
        }
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 p-0">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between px-6 py-3 bg-white border-b">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden md:block">{user?.name || 'Admin'}</span>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-black text-white rounded"
            >Logout</button>
          </div>
        </div>
        {/* Page content */}
        <div className="p-6 space-y-6">
          <h2 className="text-2xl font-semibold">Admin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-semibold mb-3">Add Student (by RFID)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Roll No" value={form.rollNo} onChange={e => setForm(v => ({ ...v, rollNo: e.target.value }))} />
                <input type="email" className="border rounded px-3 py-2" placeholder="Email ID" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Mobile Number" value={form.mobileNumber} onChange={e => setForm(v => ({ ...v, mobileNumber: e.target.value }))} />
                <input type="password" className="border rounded px-3 py-2" placeholder="New Password" value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} />
                <input className="border rounded px-3 py-2" placeholder="Department" value={form.department} onChange={e => setForm(v => ({ ...v, department: e.target.value }))} />
                <div className="flex items-center gap-2">
                  <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="RFID Number"
                    value={form.RFIDNumber}
                    onChange={e => setForm(v => ({ ...v, RFIDNumber: e.target.value }))}
                  />
                  <button onClick={connectRfidReader} className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">Scan</button>
                </div>
              </div>
              {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
              <div className="mt-3">
                <button disabled={saving} onClick={addStudent} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-60">{saving ? 'Saving...' : 'Add Student'}</button>
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Recent Students</h2>
                <button onClick={loadStudents} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh</button>
              </div>
              {students.length === 0 ? (
                <div className="text-gray-500">No students.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">RFID</th>
                        <th className="px-3 py-2 text-left">Dept</th>
                        <th className="px-3 py-2 text-left">Modules</th>
                        <th className="px-3 py-2 text-left">Wallet</th>
                        <th className="px-3 py-2 text-left">Manage</th>
                        <th className="px-3 py-2 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s._id} className="border-t">
                          <td className="px-3 py-2">{s.name}</td>
                          <td className="px-3 py-2">{s.rfid_uid || '-'}</td>
                          <td className="px-3 py-2">{s.department || '-'}</td>
                          <td className="px-3 py-2">{Array.isArray(s.modules) && s.modules.length ? s.modules.join(', ') : '-'}</td>
                          <td className="px-3 py-2">₹{s.walletBalance ?? 0}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input type="number" className="w-28 border rounded px-2 py-1" placeholder="Amount" value={walletInputs[s._id] || ''} onChange={e=>setWalletInputs(v=>({...v,[s._id]:e.target.value}))} />
                              <button onClick={()=>deposit(s._id)} className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded">Deposit</button>
                              <button onClick={()=>withdraw(s._id)} className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded">Withdraw</button>
                            </div>
                          </td>
                          <td className="px-3 py-2">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
