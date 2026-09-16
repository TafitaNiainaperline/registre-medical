import { NavLink, Outlet } from 'react-router-dom'
import Icon from '../Icon'
import { useAppLayout } from './useAppLayout'
import './AppLayout.scss'

const AppLayout = () => {
  const { menuSections, currentUser, darkMode, toggleTheme, logout, menuOpen, toggleMenu, closeMenu } = useAppLayout()

  return (
    <div className="AppLayout">
      <header className="topbar">
        <button type="button" className="burger" onClick={toggleMenu} aria-label="Ouvrir le menu" aria-expanded={menuOpen}>
          <Icon name="menu" size="lg" />
        </button>

        <span className="name">Registre Medical</span>
      </header>

      {menuOpen && <div className="backdrop" onClick={closeMenu} />}

      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <span className="logo" role="img" aria-label="Logo" />
          <span className="name">Registre Medical</span>

          <button type="button" className="close" onClick={closeMenu} aria-label="Fermer le menu">
            <Icon name="close" size="md" />
          </button>
        </div>

        <nav>
          {menuSections.map((section) => (
            <div className="section" key={section.title}>
              <span className="title">{section.title}</span>

              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) => isActive ? 'link active' : 'link'}
                >
                  <Icon name={item.icon} size="md" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          {currentUser.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'link admin active' : 'link admin'}>
              <Icon name="settings" size="md" />
              <span>Gestion utilisateurs</span>
            </NavLink>
          )}
        </nav>

        <div className="bottom">
          <div className="user">
            <Icon name="user" />
            <span>{currentUser.name || currentUser.username}</span>
          </div>

          <button
            type="button"
            className="theme"
            onClick={toggleTheme}
            role="switch"
            aria-label="Mode sombre"
            aria-checked={darkMode}
            title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            <Icon name={darkMode ? 'moon' : 'sun'} />
            <span>{darkMode ? 'Mode sombre' : 'Mode clair'}</span>
          </button>

          <button className="logout" onClick={logout} title="Se déconnecter">
            <Icon name="logout" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
