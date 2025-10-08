import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './shared/MainLayout.jsx';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Library from './pages/Library.jsx';
import Scans from './pages/Scans.jsx';
import Food from './pages/Food.jsx';
import RecentStudents from './pages/RecentStudents.jsx';
import AddItem from './pages/AddItem.jsx';
import FoodHistory from './pages/FoodHistory.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import StudentHistory from './pages/StudentHistory.jsx';
import StudentProfile from './pages/StudentProfile.jsx';
import StudentLibrary from './pages/StudentLibrary.jsx';
import StudentAnalytics from './pages/StudentAnalytics.jsx';
import StudentPurchaseDetails from './pages/StudentPurchaseDetails.jsx';
import Store from './pages/Store.jsx';
import StoreHistory from './pages/StoreHistory.jsx';
import Admin from './pages/Admin.jsx';
import RFIDScanner from './pages/RFIDScanner.jsx';
import AdminRFIDScanner from './pages/AdminRFIDScanner.jsx';
import ESP32Manager from './pages/ESP32Manager.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  return (
    <Routes>
      {/* Routes without the sidebar layout */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/history" element={<StudentHistory />} />
      <Route path="/student/purchase/:receiptId" element={<StudentPurchaseDetails />} />
      <Route path="/student/profile" element={<StudentProfile />} />
      <Route path="/student/library" element={<StudentLibrary />} />
      <Route path="/student/analytics" element={<StudentAnalytics />} />
      {/* Routes with the sidebar layout */}
      <Route element={<MainLayout />}>
        <Route path="/library" element={<Library />} />
        <Route path="/library/add" element={<AddItem />} />
        <Route path="/:module/scans" element={<Scans />} />
        <Route path="/food" element={<Food />} />
        <Route path="/food/add" element={<AddItem />} />
        <Route path="/food/history" element={<FoodHistory />} />
        <Route path="/store" element={<Store />} />
        <Route path="/store/add" element={<AddItem />} />
        <Route path="/store/history" element={<StoreHistory />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/students" element={<RecentStudents />} />
        <Route path="/rfid-scanner" element={<RFIDScanner />} />
        <Route path="/admin/rfid-scanner" element={<AdminRFIDScanner />} />
        <Route path="/admin/esp32-manager" element={<ESP32Manager />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
