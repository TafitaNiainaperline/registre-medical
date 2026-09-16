import { notify as showToast, confirmAction } from '../../utils/notifications'
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
    showToast(text, type)
    setTimeout(() => setMessage({ text: '', type: 'ok' }), 3000)
  }

  const toggleActive = (id: number, isActive: number) => confirmAction({
    title: isActive ? 'Désactiver ce compte ?' : 'Activer ce compte ?',
    message: isActive ? 'Cet utilisateur ne pourra plus se connecter.' : 'Cet utilisateur pourra accéder à l’application.',
    confirmLabel: isActive ? 'Désactiver' : 'Activer', danger: Boolean(isActive),
  }, async () => {
    await window.api.toggleUserActive(id, !isActive)
    notify(isActive ? 'Compte désactivé.' : 'Compte activé !')
    load()
  })

  const resetPassword = async (id: number) => {
    const password = newPwd[id]
    if (!password || password.length < 4) {
      notify('Mot de passe trop court (min 4 caractères).', 'err')
      return
    }
    await confirmAction({ title: 'Réinitialiser le mot de passe ?',
      message: 'L’ancien mot de passe de cet utilisateur sera remplacé.', confirmLabel: 'Réinitialiser',
    }, async () => {
      await window.api.resetUserPassword(id, password)
      setNewPwd({ ...newPwd, [id]: '' })
      notify('Mot de passe réinitialisé avec succès !')
    })
  }

  const remove = (id: number) => confirmAction({
    title: 'Confirmer la suppression', message: 'Supprimer cet utilisateur définitivement ?', confirmLabel: 'Supprimer', danger: true,
  }, async () => {
    await window.api.deleteUser(id)
    notify('Utilisateur supprimé.')
    load()
  })

  return {
    users, currentUser, message, newPwd, showPwd,
    setPassword: (id: number, value: string) => setNewPwd({ ...newPwd, [id]: value }),
    togglePasswordVisibility: (id: number) => setShowPwd({ ...showPwd, [id]: !showPwd[id] }),
    toggleActive, resetPassword, remove,
  }
}
