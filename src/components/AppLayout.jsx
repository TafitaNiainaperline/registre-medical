import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { categories } from '../constants';

export default function AppLayout() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Etat du mode sombre
  const [darkMode, setDarkMode] = useState(false);

  // Charger le thème sauvegardé
  useEffect(() => {
    const saved = localStorage.getItem('darkMode') === 'true';

    setDarkMode(saved);

    if (saved) {
      document.body.classList.add('dark-mode');
    }
  }, []);

  // Changer thème
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
          <NavLink to="/">Tableau de bord</NavLink>

          {categories.map((cat) => (
            <NavLink key={cat.key} to={`/${cat.key}`}>
              {cat.label}
            </NavLink>
          ))}

          <NavLink to="/aide">Aide</NavLink>
          <NavLink to="/archives">Archives</NavLink>
<NavLink to="/dispensation">Dispensation</NavLink>

          <NavLink to="/medicaments">Médicaments</NavLink>

           {currentUser.role === 'admin' && (
             <NavLink
               to="/admin"
               style={{
                 marginTop: '8px',
                 borderTop: '1px solid #d8e4e8',
                 paddingTop: '12px'
               }}
             >
               ⚙ Gestion utilisateurs
             </NavLink>
           )}
        </nav>

        {/* BAS SIDEBAR */}
        <div className="sidebar-bottom">

          <div className="user-box">
            👤 {currentUser.name || currentUser.username}
          </div>

          <button className="theme-toggle" onClick={toggleTheme}>
            {darkMode
              ? '☀️ Mode clair'
              : '🌙 Mode sombre'}
          </button>

          <button className="logout" onClick={logout}>
            Se déconnecter
          </button>

        </div>

      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
