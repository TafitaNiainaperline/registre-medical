import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RecordsPage from './pages/RecordsPage'
import HelpPage from './pages/HelpPage'
import AdminPage from './pages/AdminPage'
import MedicamentsPage from './pages/MedicamentsPage'
import DispensationPage from './pages/DispensationPage'
import ArchivesPage from './pages/ArchivesPage'
import AppointmentsPage from './pages/AppointmentsPage'
import PatientsPage from './pages/PatientsPage'
import SortiesPage from './pages/SortiesPage'
import { categories } from './constants'
import Notifications from './components/Notifications'

type Props = {
  children: ReactNode
}

const ProtectedRoute = ({ children }: Props) => {
  const user = localStorage.getItem('user')
  return user ? children : <Navigate to="/login" replace />
}

const App = () => {
  return (
    <>
    <Notifications />
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
        <Route path="patients" element={<PatientsPage />} />
        <Route path="archives" element={<ArchivesPage />} />
        <Route path="rendez-vous" element={<AppointmentsPage />} />
        <Route path="sorties" element={<SortiesPage />} />
      </Route>
    </Routes>
    </>
  )
}

export default App
