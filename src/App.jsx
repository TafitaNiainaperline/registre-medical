import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RecordsPage from './pages/RecordsPage';
import HelpPage from './pages/HelpPage';
import AdminPage from './pages/AdminPage';
import MedicamentsPage from './pages/MedicamentsPage';
import DispensationPage from './pages/DispensationPage';
import ArchivesPage from './pages/ArchivesPage';
import { categories } from './constants';

const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  return user ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        {categories.map((cat) => (
          <Route key={cat.key} path={cat.key} element={<RecordsPage category={cat} />} />
        ))}
        <Route path="aide" element={<HelpPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="medicaments" element={<MedicamentsPage />} />
        <Route path="dispensation" element={<DispensationPage />} />
        <Route path="archives" element={<ArchivesPage />} />
      </Route>
    </Routes>
  );
}
