import { useEffect, useRef } from 'react'
import Icon from '../../components/Icon'
import { formatDateTime } from '../../utils/date'
import { useDispensationPage } from './useDispensationPage'
import './DispensationPage.scss'

const DispensationPage = () => {
  const {
    medications, filtered, selectedId, setSelectedId, quantity, setQuantity, search, setSearch,
    message, submit, editingId, setEditingId, editForm, setEditForm, startEdit, saveEdit,
    unit, totalPrice, unitOf, creating, saving, openCreate, closeCreate,
  } = useDispensationPage()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!creating) return
    const dialog = dialogRef.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    dialog?.showModal()
    dialog?.querySelector('select')?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [creating])

  return (
    <section className="DispensationPage">
      <div className="page-header">
        <div>
          <h1>Dispensation de médicaments</h1>
          <p>Sélectionnez un médicament et indiquez la quantité dispensée.</p>
        </div>
        <div className="page-badge blue">
          <Icon name="pill" /> Dispensation
        </div>
      </div>

      {!creating && message.text && (
        <div className={message.type === 'err' ? 'error-msg' : 'success-msg'}>
          <Icon name={message.type === 'err' ? 'alert' : 'check-circle'} />
          {message.text}
        </div>
      )}

      <div className="dispensation-actions">
        <button type="button" className="btn-light" onClick={() => listRef.current?.scrollIntoView({ block: 'start' })}>
          <Icon name="history" /> Liste des dispensations
        </button>
        <button type="button" aria-haspopup="dialog" aria-expanded={creating} onClick={openCreate}>
          <Icon name="plus" /> Nouvelle dispensation
        </button>
      </div>

      <dialog ref={dialogRef} className="modal form creation-modal" aria-labelledby="dispensation-create-title"
        onCancel={(event) => { event.preventDefault(); closeCreate() }}>
        <div className="header">
          <h3 id="dispensation-create-title"><Icon name="plus" size="md" /> Nouvelle dispensation</h3>
          <button type="button" className="close" aria-label="Fermer la nouvelle dispensation" disabled={saving} onClick={closeCreate}><Icon name="close" /></button>
        </div>

        {creating && message.text && <div className={message.type === 'err' ? 'error-msg' : 'success-msg'} role="alert">{message.text}</div>}

        <form onSubmit={submit}>
          <label className="field">
            <span>Médicament</span>
            <select value={selectedId} disabled={saving} onChange={(e) => { setSelectedId(e.target.value); setQuantity('') }} required>
              <option value="">-- Sélectionner un médicament --</option>
              {medications.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.name} ({med.unit || 'comprimé'}) - Stock: {med.stock ?? 'Non suivi'}
                </option>
              ))}
            </select>
          </label>

          <div className="row">
            <label className="field">
              <span>Quantité ({unit})</span>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={quantity}
                disabled={saving}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </label>

            <div className="total">
              <span className="label">Total</span>
              <span className="value">{totalPrice.toLocaleString()} Ar</span>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="btn-light" disabled={saving} onClick={closeCreate}>Annuler</button>
            <button type="submit" disabled={saving}><Icon name="plus" /> {saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </dialog>

      <div className="panel" ref={listRef}>
        <h3><Icon name="file" size="md" /> Historique des dispensations</h3>

        <div className="search-field">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Rechercher une dispensation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Médicament</th>
                <th className="center">Unité</th>
                <th className="center">Qté</th>
                <th className="num">Total</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td className="empty" colSpan={6}>Aucune dispensation enregistrée.</td></tr>
              )}

              {filtered.map((dispensation) => {
                const editing = editingId === Number(dispensation.id)
                const total = (Number(dispensation.unit_price || 0) * Number(dispensation.quantity)).toLocaleString()

                return (
                  <tr key={dispensation.id}>
                    <td className="date">{formatDateTime(dispensation.created_at)}</td>

                    {editing ? (
                      <>
                        <td>
                          <select
                            value={editForm.medication_id}
                            onChange={(e) => setEditForm({ ...editForm, medication_id: e.target.value })}
                          >
                            <option value="">--</option>
                            {medications.map((m) => (
                              <option key={m.id} value={String(m.id)}>{m.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="center">{unitOf(editForm.medication_id)}</td>
                        <td className="center">
                          <input
                            className="qty"
                            type="number"
                            min="1"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                          />
                        </td>
                        <td className="num">-</td>
                        <td className="actions">
                          <div>
                            <button className="icon-btn confirm" title="Enregistrer" onClick={saveEdit}>
                              <Icon name="check" />
                            </button>
                            <button className="icon-btn cancel" title="Annuler" onClick={() => setEditingId(null)}>
                              <Icon name="close" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{dispensation.medication_name}</strong></td>
                        <td className="center">{dispensation.unit || 'comprimé'}</td>
                        <td className="center">{dispensation.quantity}</td>
                        <td className="num amount">{total} Ar</td>
                        <td className="actions">
                          <div>
                            <button className="icon-btn edit" title="Modifier" onClick={() => startEdit(dispensation)}>
                              <Icon name="edit" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default DispensationPage
