import { useEffect, useState } from 'react'
import type { UserRow } from '../../../electron/types'
import { getCurrentUser } from '../../utils/currentUser'

type MessageType = 'ok' | 'err'

export const useAdminPage = () => {
  const [users, setUsers] = useState<UserRow[]>([])
  const [newPwd, setNewPwd] = useState<Record<number, string>>({})
  const [showPwd, setShowPwd] = useState<Record<number, boolean>>({})
  const [message, setMessage] = useState<{ text: string; type: MessageType }>({ text: '', type: 'ok' })

  const currentUser = getCurrentUser()

  const load = () => window.api.getAllUsers().then(setUsers).catch(() => {})

  useEffect(() => { load() }, [])

  const notify = (text: string, type: MessageType = 'ok') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: 'ok' }), 3000)
  }

  const toggleActive = async (id: number, isActive: number) => {
    await window.api.toggleUserActive(id, !isActive)
    notify(isActive ? 'Compte désactivé.' : 'Compte activé !')
    load()
  }

  const resetPassword = async (id: number) => {
    const password = newPwd[id]
    if (!password || password.length < 4) {
      notify('Mot de passe trop court (min 4 caractères).', 'err')
      return
    }
    await window.api.resetUserPassword(id, password)
    setNewPwd({ ...newPwd, [id]: '' })
    notify('Mot de passe réinitialisé avec succès !')
  }

  const remove = async (id: number) => {
    if (!window.confirm('Supprimer cet utilisateur définitivement ?')) return
    await window.api.deleteUser(id)
    notify('Utilisateur supprimé.')
    load()
  }

  return {
    users, currentUser, message, newPwd, showPwd,
    setPassword: (id: number, value: string) => setNewPwd({ ...newPwd, [id]: value }),
    togglePasswordVisibility: (id: number) => setShowPwd({ ...showPwd, [id]: !showPwd[id] }),
    toggleActive, resetPassword, remove,
  }
}
