import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import {
  acceptConfirmation, cancelConfirmation, dismissNotice, getConfirmation, getNotices, subscribe,
} from '../../utils/notifications'
import type { Confirmation, Notice } from '../../utils/notifications'
import './Notifications.scss'

function Toast({ notice }: { notice: Notice }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || notice.type === 'err') return
    const timer = window.setTimeout(() => dismissNotice(notice.id), 6500)
    return () => window.clearTimeout(timer)
  }, [notice.id, notice.type, paused])

  return (
    <div className={`notice-card ${notice.type}`} role={notice.type === 'err' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}>
      <span className="notice-icon"><Icon name={notice.type === 'ok' ? 'check-circle' : notice.type === 'err' ? 'alert' : 'calendar'} size="md" /></span>
      <div className="notice-copy">
        <strong>{notice.type === 'ok' ? 'Action réussie' : notice.type === 'err' ? 'Action impossible' : 'Information'}</strong>
        <p>{notice.text}</p>
      </div>
      <button type="button" className="notice-close" aria-label="Fermer la notification" onClick={() => dismissNotice(notice.id)}><Icon name="close" /></button>
    </div>
  )
}

function ConfirmationDialog({ pending }: { pending: Confirmation }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element?.showModal()
    cancel.current?.focus()
    return () => {
      element?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  return (
    <dialog ref={dialog} className={`action-confirmation${pending.danger ? ' danger' : ''}`}
      aria-labelledby="action-confirmation-title" aria-describedby={pending.message ? 'action-confirmation-description' : undefined}
      aria-busy={pending.busy} onCancel={(event) => { event.preventDefault(); cancelConfirmation() }}>
      <div className="confirmation-symbol"><Icon name={pending.danger ? 'trash' : 'check-circle'} size="lg" /></div>
      <span className="confirmation-eyebrow">Confirmation requise</span>
      <h2 id="action-confirmation-title">{pending.title}</h2>
      {pending.message && <p id="action-confirmation-description">{pending.message}</p>}
      <div className="confirmation-actions">
        <button ref={cancel} type="button" className="btn-light" disabled={pending.busy} onClick={cancelConfirmation}>Annuler</button>
        <button type="button" className={pending.danger ? 'btn-danger' : ''} disabled={pending.busy} onClick={() => { void acceptConfirmation() }}>
          {pending.busy ? 'En cours…' : pending.confirmLabel || 'Confirmer'}
        </button>
      </div>
    </dialog>
  )
}

export default function Notifications() {
  const notices = useSyncExternalStore(subscribe, getNotices)
  const pending = useSyncExternalStore(subscribe, getConfirmation)
  return createPortal(<>
    <section className="notification-stack" aria-label="Notifications">
      {notices.map((notice) => <Toast key={notice.id} notice={notice} />)}
    </section>
    {pending && <ConfirmationDialog pending={pending} />}
  </>, document.body)
}
