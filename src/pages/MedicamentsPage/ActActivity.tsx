import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../../components/Icon'
import type { ActSummaryEntry } from './types'
import './ActActivity.scss'

type Props = { entries: ActSummaryEntry[]; search: string }
const PAGE_SIZE = 12

function ActDetails({ entries, search, onClose }: Props & { onClose: () => void }) {
  const [page, setPage] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const visible = entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  return createPortal(
    <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="ActDetails modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="act-details-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); onClose() }
          if (event.key !== 'Tab') return
          const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
          if (!buttons?.length) return
          const first = buttons[0]
          const last = buttons[buttons.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }}>
        <div className="header">
          <h3 id="act-details-title"><Icon name="activity" size="md" /> Actes réalisés</h3>
          <button type="button" className="close" aria-label="Fermer les actes réalisés" onClick={onClose}><Icon name="close" /></button>
        </div>
        <p className="scope">{search ? `Recherche : « ${search} »` : 'Tous les actes enregistrés dans les consultations.'}</p>
        <div className="act-details-scroll">
          {entries.length === 0 ? <p className="empty">Aucun acte réalisé{search ? ' pour cette recherche' : ''}.</p> : (
            <table>
              <thead><tr><th>Acte médical</th><th>Réalisations</th><th>Montant (Ar)</th></tr></thead>
              <tbody>{visible.map((act) => <tr key={act.name}>
                <td>{act.name}</td><td>{act.count.toLocaleString('fr-FR')}</td><td>{act.total.toLocaleString('fr-FR')}</td>
              </tr>)}</tbody>
            </table>
          )}
        </div>
        <div className="act-pagination">
          <span role="status">{entries.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, entries.length)} sur ${entries.length} actes` : '0 acte'}</span>
          {pages > 1 && <div>
            <button type="button" className="btn-light" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Précédent</button>
            <button type="button" className="btn-light" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Suivant</button>
          </div>}
        </div>
      </div>
    </div>, document.body
  )
}

export default function ActActivity({ entries, search }: Props) {
  const [open, setOpen] = useState(false)
  const count = entries.reduce((total, entry) => total + entry.count, 0)

  return (
    <>
      <button type="button" className="act-activity-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="activity-symbol"><Icon name="activity" size="lg" /></span>
        <span className="activity-label"><strong>Actes réalisés</strong><small>{count.toLocaleString('fr-FR')} réalisation{count !== 1 ? 's' : ''}{search ? ' · Recherche en cours' : ''}</small></span>
        <span className="activity-open"><Icon name="eye" /> Voir le détail</span>
      </button>
      {open && <ActDetails entries={entries} search={search} onClose={() => setOpen(false)} />}
    </>
  )
}
