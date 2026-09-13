import Icon from '../../components/Icon'
import { formatDay } from '../../utils/date'
import { useSortiesPage } from './useSortiesPage'
import './SortiesPage.scss'

const SortiesPage = () => {
  const {
    outflows, totals, archiveLabel, form, setForm, error, success, submit, remove,
    editing, editForm, setEditForm, openEdit, closeEdit, update,
  } = useSortiesPage()

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

      <div className="columns">
        <div className="panel">
          <h3>Enregistrer une sortie</h3>

          <form onSubmit={submit}>
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>

            <label className="field">
              <span>Désignation</span>
              <input
                type="text"
                placeholder="Ex: Achat matériel, Frais de transport..."
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </label>

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

            {error && <div className="error-msg"><Icon name="alert" /> {error}</div>}
            {success && <div className="success-msg"><Icon name="check-circle" /> {success}</div>}

            <button type="submit" className="btn-danger submit">Enregistrer la sortie</button>
          </form>
        </div>

        <div className="panel">
          <div className="list-header">
            <h3>Liste des sorties</h3>
            <span className="total">Total : {totals.outflows.toLocaleString()} Ar</span>
          </div>

          {outflows.length === 0 ? (
            <div className="empty">Aucune sortie enregistrée ce mois</div>
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
      </div>

      {editing && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="header">
              <h3>Modifier la sortie</h3>
              <button className="close" onClick={closeEdit}><Icon name="close" /></button>
            </div>

            <form onSubmit={update}>
              <label className="field">
                <span>Date</span>
                <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </label>

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
