import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { categories } from '../constants';
import {
  LayoutDashboard,
  HelpCircle,
  Archive,
  Calendar,
  Pill,
  Landmark,
  Package,
  Settings,
  LogOut,
  Moon,
  Sun,
  User
} from 'lucide-react';

const menuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  ...categories.map((cat) => ({
    to: `/${cat.key}`,
    icon: getCategoryIcon(cat.key),
    label: cat.label,
  })),
  { to: '/aide', icon: HelpCircle, label: 'Aide' },
  { to: '/archives', icon: Archive, label: 'Archives' },
  { to: '/rendez-vous', icon: Calendar, label: 'Rendez-vous' },
  { to: '/dispensation', icon: Pill, label: 'Dispensation' },
  { to: '/medicaments', icon: Package, label: 'Médicaments' },
  { to: '/sorties', icon: Landmark, label: 'Sorties' },
];

function getCategoryIcon(key) {
  const icons = {
    consultation: Package,
    cpn: User,
    pf: User,
    archive: Archive,
    analyse: Package,
    soin: Package,
  };
  return icons[key] || Package;
}

export default function AppLayout() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('darkMode') === 'true';
    setDarkMode(saved);
    if (saved) {
      document.body.classList.add('dark-mode');
    }
  }, []);

  const toggleTheme = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    if (newValue) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', newValue);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="./Logo.png" alt="Logo" />
          <span>Registre Medical</span>
        </div>

        <nav>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {currentUser.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => isActive ? 'nav-link active admin-link' : 'nav-link admin-link'}
            >
              <Settings size={18} />
              <span>Gestion utilisateurs</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-box">
            <User size={16} />
            <span>{currentUser.name || currentUser.username}</span>
          </div>

          <button className="theme-toggle" onClick={toggleTheme}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span>{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
          </button>

          <button className="logout" onClick={logout}>
            <LogOut size={16} />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
