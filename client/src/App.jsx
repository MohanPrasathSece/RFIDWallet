import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Library from './pages/Library.jsx';
import Food from './pages/Food.jsx';
import FoodHistory from './pages/FoodHistory.jsx';
import FoodScans from './pages/FoodScans.jsx';
import Store from './pages/Store.jsx';
import Admin from './pages/Admin.jsx';
import AddBook from './pages/AddBook.jsx';
import AddFood from './pages/AddFood.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import AddStore from './pages/AddStore.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/library" element={<Library />} />
      <Route path="/library/add" element={<AddBook />} />
      <Route path="/food" element={<Food />} />
      <Route path="/food/add" element={<AddFood />} />
      <Route path="/food/history" element={<FoodHistory />} />
      <Route path="/food/scans" element={<FoodScans />} />
      <Route path="/store" element={<Store />} />
      <Route path="/store/add" element={<AddStore />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/login" element={<Login />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
