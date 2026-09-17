import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuditEntity, AuditEntry } from '../../../electron/types'
import Icon from '../../components/Icon'
import { categories } from '../../constants'
import { formatDateTime, formatDay } from '../../utils/date'
import { errorMessage } from '../../utils/error'
import { auditChanges } from './auditChanges'

const entities: Record<AuditEntity, string> = { visit: 'Visite', stock: 'Stock et tarifs', expense: 'Dépense', dispensation: 'Dispensation' }
const actions = { create: 'Ajout', update: 'Modification', delete: 'Suppression' }

function displayValue(field: string, value: unknown): string {
  if (value == null || value === '') return '—'
  if (field === 'category') return categories.find((item) => item.key === value)?.label || String(value)
  if (field === 'item_type') return value === 'act' ? 'Acte médical' : 'Médicament'
  if (field === 'outflow_date' || field === 'appointment_date') return formatDay(String(value))
  if (field === 'treatments_json') {
    try {
      const treatments = JSON.parse(String(value)) as { name: string; quantity: number; unit_price: number }[]
      return treatments.map((item) => `${item.name} × ${item.quantity} (${Number(item.unit_price || 0).toLocaleString()} Ar)`).join(' · ') || '—'
    } catch { return String(value) }
  }
  return typeof value === 'number' ? value.toLocaleString() : String(value)
}

export default function AuditPanel() {
  const [open, setOpen] = useState(false)
  const [entity, setEntity] = useState<AuditEntity | ''>('')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [more, setMore] = useState(false)
  const request = useRef(0)
  const load = useCallback(async (beforeId?: number) => {
    const current = ++request.current
    setBusy(true)
    setError('')
    if (!beforeId) { setEntries([]); setMore(false) }
    try {
      const result = await window.api.listAudit({ entity, beforeId })
      if (current !== request.current) return
      setEntries((previous) => beforeId ? [...previous, ...result.slice(0, 50)] : result.slice(0, 50))
      setMore(result.length > 50)
    } catch (err) {
      if (current === request.current) setError(errorMessage(err, 'Impossible de charger l’historique.'))
    } finally { if (current === request.current) setBusy(false) }
  }, [entity])
  useEffect(() => {
    if (open) void load()
    return () => { request.current++ }
  }, [open, load])
  return <section className="panel audit-panel">
    <button type="button" className="audit-heading" aria-expanded={open} aria-controls="audit-content" onClick={() => setOpen(!open)}>
      <Icon name="history" /><span>Historique des modifications</span><span>{open ? '−' : '+'}</span>
    </button>
    {open && <div id="audit-content">
      <p className="audit-note">Les changements sont enregistrés à partir de l’activation de cet historique.</p>
      <div className="audit-tools">
        <select aria-label="Filtrer l’historique" value={entity} onChange={(event) => setEntity(event.target.value as AuditEntity | '')}>
          <option value="">Tous les changements</option>{Object.entries(entities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button type="button" className="btn-light" disabled={busy} onClick={() => load()}>Actualiser</button>
      </div>
      {error && <p className="error-msg" role="alert">{error}</p>}
      {!busy && !error && !entries.length && <p className="audit-note">Aucun changement enregistré.</p>}
      <div className="audit-list">{entries.map((entry) => <article key={entry.id}>
        <div className="audit-entry-heading"><strong>{actions[entry.action]} · {entities[entry.entity_type]}</strong><time>{formatDateTime(entry.created_at)}</time></div>
        <p className="audit-subject">{entry.entity_label}</p>
        <p className="audit-author">Par {entry.actor_name}</p>
        <details><summary>Voir les changements</summary>
          <div className="audit-changes">{auditChanges(entry).map((change) => <div className="audit-change" key={change.field}>
            <strong>{change.label}</strong>
            <div><span>Avant</span><p>{displayValue(change.field, change.before)}</p></div>
            <div><span>Après</span><p>{displayValue(change.field, change.after)}</p></div>
          </div>)}</div>
        </details>
      </article>)}</div>
      {busy && <p role="status">Chargement…</p>}
      {more && <button type="button" className="btn-light" disabled={busy} onClick={() => load(entries[entries.length - 1]?.id)}>Voir les changements plus anciens</button>}
    </div>}
  </section>
}
