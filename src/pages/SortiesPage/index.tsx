import { useEffect, useRef } from 'react'
import Icon from '../../components/Icon'
import DatePicker from '../../components/DatePicker'
import { formatDay } from '../../utils/date'
import { useSortiesPage } from './useSortiesPage'
import './SortiesPage.scss'

const SortiesPage = () => {
  const {
    creating, openCreate, closeCreate, outflows, totals, archiveLabel, form, setForm, error, success, submit, remove,
    editing, editForm, setEditForm, openEdit, closeEdit, update,
  } = useSortiesPage()
  const createDialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!creating) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    createDialogRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    return () => {
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [creating])

  return (
    <section className="SortiesPage">
      <div className="page-header">
        <div>
          <h1>Sorties de caisse</h1>
          <p>Gestion des dépenses{archiveLabel ? ` — ${archiveLabel}` : ''}.</p>
        </div>
        <div className="page-badge">
          <Icon name="bank" /> Finance
        </div>
      </div>

      <div className="cards-grid totals">
        <article className="stat-card green">
          <div className="top"><h3>Entrées</h3></div>
          <strong className="value">{totals.entries.toLocaleString()} Ar</strong>
          <span className="subtitle">Total recettes du mois</span>
        </article>

        <article className="stat-card red">
          <div className="top"><h3>Sorties</h3></div>
          <strong className="value">{totals.outflows.toLocaleString()} Ar</strong>
          <span className="subtitle">Total dépenses du mois</span>
        </article>

        <article className="stat-card blue">
          <div className="top"><h3>Solde de caisse</h3></div>
          <strong className="value">{totals.balance.toLocaleString()} Ar</strong>
          <span className="subtitle">Entrées - Sorties</span>
        </article>
      </div>

      <div className="outflow-tools">
        <button type="button" aria-haspopup="dialog" onClick={openCreate}>
          <Icon name="plus" /> Nouvelle sortie
        </button>
      </div>

      {success && <div className="success-msg" role="status"><Icon name="check-circle" /> {success}</div>}

      {creating && <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreate() }}>
        <div className="modal creation-modal" ref={createDialogRef} role="dialog" aria-modal="true" aria-labelledby="outflow-create-title"
          onKeyDown={(event) => {
            if (!event.currentTarget.contains(event.target as Node)) return
            if (event.key === 'Escape') { event.preventDefault(); closeCreate() }
            if (event.key !== 'Tab') return
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
          }}>
          <div className="form-heading">
            <span className="form-icon"><Icon name="bank" size="lg" /></span>
            <div><h3 id="outflow-create-title">Nouvelle sortie</h3><p>Renseignez la date, le montant et le motif de la dépense.</p></div>
            <button type="button" className="close" aria-label="Fermer la nouvelle sortie" onClick={closeCreate}><Icon name="close" /></button>
          </div>

          <form className="entry-form" onSubmit={submit}>
            <div className="field">
              <span>Date</span>
              <DatePicker value={form.date} onChange={(date) => setForm({ ...form, date })} label="Date de la dépense" clearLabel="Effacer la date de la dépense" />
            </div>

            <label className="field">
              <span>Montant (Ar)</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>

            <label className="field wide">
              <span>Désignation</span>
              <input type="text" placeholder="Ex. Achat de matériel, frais de transport…"
                value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </label>

            {error && <div className="error-msg wide" role="alert"><Icon name="alert" /> {error}</div>}
            <div className="form-actions wide">
              <button type="button" className="btn-light" onClick={closeCreate}>Annuler</button>
              <button type="submit" className="btn-danger"><Icon name="check" /> Enregistrer la sortie</button>
            </div>
          </form>
        </div>
      </div>}

        <div className="panel list-panel">
          <div className="list-header">
            <h3>Liste des sorties</h3>
            <span className="total">Total : {totals.outflows.toLocaleString()} Ar</span>
          </div>

          {outflows.length === 0 ? (
            <div className="empty"><Icon name="bank" size="xl" /><p>Aucune sortie enregistrée ce mois.</p><button type="button" className="btn-light" onClick={openCreate}><Icon name="plus" /> Ajouter une sortie</button></div>
          ) : (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Désignation</th>
                    <th className="num">Montant</th>
                    <th className="center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outflows.map((outflow) => (
                    <tr key={outflow.id}>
                      <td>{formatDay(outflow.outflow_date)}</td>
                      <td>{outflow.designation}</td>
                      <td className="num amount">-{Number(outflow.amount).toLocaleString()} Ar</td>
                      <td className="actions">
                        <div>
                          <button className="icon-btn edit" title="Modifier" onClick={() => openEdit(outflow)}>
                            <Icon name="edit" />
                          </button>
                          <button className="icon-btn remove" title="Supprimer" onClick={() => remove(outflow.id)}>
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {editing && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="header">
              <h3>Modifier la sortie</h3>
              <button className="close" onClick={closeEdit}><Icon name="close" /></button>
            </div>

            <form onSubmit={update}>
              <div className="field">
                <span>Date</span>
                <DatePicker value={editForm.date} onChange={(date) => setEditForm({ ...editForm, date })} label="Date de la dépense" clearLabel="Effacer la date de la dépense" />
              </div>

              <label className="field">
                <span>Désignation</span>
                <input type="text" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
              </label>

              <label className="field">
                <span>Montant (Ar)</span>
                <input type="number" min="0" step="any" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </label>

              <div className="actions">
                <button type="button" className="btn-light" onClick={closeEdit}>Annuler</button>
                <button type="submit">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default SortiesPage
