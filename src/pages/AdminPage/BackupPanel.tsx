import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { errorMessage } from '../../utils/error'
import { notify } from '../../utils/notifications'

export default function BackupPanel() {
  const [busy, setBusy] = useState<'save' | 'restore' | null>(null)
  const busyRef = useRef(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const run = async (action: 'save' | 'restore') => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(action)
    setMessage('')
    try {
      if (action === 'save') {
        const result = await window.api.backupDatabase()
        if (result.canceled) return
        setMessage(`Sauvegarde créée : ${result.filePath}`)
        notify('Sauvegarde complète créée.')
      } else {
        const result = await window.api.restoreDatabase()
        if (result.canceled) return
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        notify(`Restauration terminée. Copie des anciennes données : ${result.previousPath}. Reconnectez-vous avec un compte de la sauvegarde.`, 'info')
        navigate('/login', { replace: true })
      }
    } catch (error) {
      const text = errorMessage(error, 'Impossible de terminer cette opération.')
      setMessage(text)
      notify(text, 'err')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }
  return <section className="panel backup-panel" aria-labelledby="backup-title" aria-busy={Boolean(busy)}>
    <div><h2 id="backup-title"><Icon name="archive" /> Sauvegarde et restauration</h2>
      <p>Conservez toutes les données et les comptes dans un seul fichier. Gardez une copie sur une clé USB ou un autre ordinateur.</p></div>
    <div className="backup-actions">
      <button type="button" disabled={Boolean(busy)} onClick={() => run('save')}><Icon name="folder" /> {busy === 'save' ? 'Sauvegarde en cours…' : 'Sauvegarder'}</button>
      <button type="button" className="btn-light" disabled={Boolean(busy)} onClick={() => run('restore')}><Icon name="history" /> {busy === 'restore' ? 'Restauration en cours…' : 'Restaurer une sauvegarde'}</button>
    </div>
    <small>La restauration remplace les données actuelles et en conserve une copie automatiquement.</small>
    {message && <p className="backup-result" role="status">{message}</p>}
  </section>
}
