import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Library from './pages/Library.jsx';
import LibraryScans from './pages/LibraryScans.jsx';
import Food from './pages/Food.jsx';
import FoodHistory from './pages/FoodHistory.jsx';
import FoodScans from './pages/FoodScans.jsx';
import Store from './pages/Store.jsx';
import Admin from './pages/Admin.jsx';
import RecentStudents from './pages/RecentStudents.jsx';
import AddBook from './pages/AddBook.jsx';
import AddFood from './pages/AddFood.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import StudentHistory from './pages/StudentHistory.jsx';
import StudentProfile from './pages/StudentProfile.jsx';
import StudentPurchaseDetails from './pages/StudentPurchaseDetails.jsx';
import AddStore from './pages/AddStore.jsx';
import StudentAnalytics from './pages/StudentAnalytics.jsx';
import StudentLibrary from './pages/StudentLibrary.jsx';
import Login from './pages/Login.jsx';
import RFIDScanner from './pages/RFIDScanner.jsx';
import AdminRFIDScanner from './pages/AdminRFIDScanner.jsx';
import ESP32Manager from './pages/ESP32Manager.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/library" element={<Library />} />
      <Route path="/library/scans" element={<LibraryScans />} />
      <Route path="/library/add" element={<AddBook />} />
      <Route path="/food" element={<Food />} />
      <Route path="/food/add" element={<AddFood />} />
      <Route path="/food/history" element={<FoodHistory />} />
      <Route path="/food/scans" element={<FoodScans />} />
      <Route path="/store" element={<Store />} />
      <Route path="/store/add" element={<AddStore />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/students" element={<RecentStudents />} />
      <Route path="/login" element={<Login />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/history" element={<StudentHistory />} />
      <Route path="/student/purchase/:receiptId" element={<StudentPurchaseDetails />} />
      <Route path="/student/profile" element={<StudentProfile />} />
      <Route path="/student/library" element={<StudentLibrary />} />
      <Route path="/student/analytics" element={<StudentAnalytics />} />
      <Route path="/rfid-scanner" element={<RFIDScanner />} />
      <Route path="/admin/rfid-scanner" element={<AdminRFIDScanner />} />
      <Route path="/admin/esp32-manager" element={<ESP32Manager />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
