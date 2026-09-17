import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { categories } from '../../constants'
import { getCurrentUser } from '../../utils/currentUser'
import type { IconName } from '../Icon/types'
import { confirmAction } from '../../utils/notifications'

export type MenuItem = {
  to: string
  icon: IconName
  label: string
  exact?: boolean
}

export type MenuSection = {
  title: string
  items: MenuItem[]
}

// Le menu suit le déroulé du travail : suivi, registres, pharmacie, gestion
const menuSections: MenuSection[] = [
  {
    title: 'Suivi',
    items: [
      { to: '/', icon: 'dashboard', label: 'Tableau de bord', exact: true },
      { to: '/patients', icon: 'users', label: 'Patients' },
      { to: '/rendez-vous', icon: 'calendar', label: 'Rendez-vous' },
    ],
  },
  {
    title: 'Registres',
    items: categories.map((cat) => ({ to: `/${cat.key}`, icon: cat.icon, label: cat.label })),
  },
  {
    title: 'Pharmacie',
    items: [
      { to: '/dispensation', icon: 'pill', label: 'Dispensation' },
      { to: '/medicaments', icon: 'package', label: 'Médicaments' },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { to: '/sorties', icon: 'bank', label: 'Sorties de caisse' },
      { to: '/archives', icon: 'archive', label: 'Archives' },
      { to: '/aide', icon: 'help', label: 'Aide' },
    ],
  },
]

export const useAppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = getCurrentUser()
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')
  const [menuOpen, setMenuOpen] = useState(false)

  // Le tiroir se referme dès qu'on change de page
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode)
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  const toggleTheme = () => {
    setDarkMode((previous) => !previous)
  }

  const logout = () => confirmAction({
    title: 'Se déconnecter ?',
    confirmLabel: 'Se déconnecter',
  }, async () => {
    await window.api.logout()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  })

  return {
    menuSections, currentUser, darkMode, toggleTheme, logout, menuOpen,
    toggleMenu: () => setMenuOpen((previous) => !previous),
    closeMenu: () => setMenuOpen(false),
  }
}
