import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rfid, setRfid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/signup', { name, email, password, rfid_uid: rfid });
      navigate('/login');
    } catch (err) {
      setError(err?.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Student Sign up</h1>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <form onSubmit={onSubmit}>
          <input className="input" placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} />
          <input className="input mt-3" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="input mt-3" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
          <input className="input mt-3" placeholder="RFID UID" value={rfid} onChange={e=>setRfid(e.target.value)} />
          <button type="submit" className="btn-primary w-full mt-4" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
        </form>
        <p className="text-sm mt-3">Have an account? <Link className="text-blue-600" to="/login">Login</Link></p>
      </div>
    </div>
  );
}
