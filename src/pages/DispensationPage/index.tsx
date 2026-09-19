import { useEffect, useRef } from 'react'
import Icon from '../../components/Icon'
import DatePicker from '../../components/DatePicker'
import { formatDateTime, formatDay } from '../../utils/date'
import { useDispensationPage } from './useDispensationPage'
import './DispensationPage.scss'

const DispensationPage = () => {
  const {
    medications, filtered, lines, addLine, removeLine, updateLine, searchNumber, searchDate, changeNumber, changeDate, resetFilters, exportMonth, canExportMonth, monthTotal, periodLabel,
    message, submit, editingId, setEditingId, editForm, setEditForm, startEdit, saveEdit,
    exporting, downloadReceipt, totalPrice, unitOf, creating, saving, openCreate, closeCreate,
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
          <p>Ajoutez les médicaments et indiquez la quantité dispensée pour chacun.</p>
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
          <div className="medication-columns" aria-hidden="true">
            <span>Médicament</span><span>Quantité</span><span />
          </div>
          <div className="medication-list">
            {lines.map((line, index) => (
              <div className="medication-line" key={line.id}>
                <div className="medication-choice">
                  <select aria-label={'Médicament ' + (index + 1)} disabled={saving} value={line.medication_id} onChange={(e) => updateLine(line.id, { medication_id: e.target.value, quantity: '' })} required>
                    <option value="">Choisir un médicament…</option>
                    {medications.map((med) => (
                      <option key={med.id} value={med.id}>
                        {med.name} ({med.unit || 'comprimé'}) - Stock : {med.stock ?? 'Non suivi'}
                      </option>
                    ))}
                  </select>
                </div>
              <div className="medication-quantity">
                  <input aria-label={'Quantité du médicament ' + (index + 1) + ' (' + unitOf(line.medication_id) + ')'} disabled={saving} type="number" min="1" placeholder="Qté" value={line.quantity}
                    onChange={(e) => updateLine(line.id, { quantity: e.target.value })} required />
                  <small>{line.medication_id ? unitOf(line.medication_id) : 'Forme pharmaceutique'}</small>
              </div>
              <button type="button" className="remove-medication" disabled={saving || lines.length === 1}
                title="Retirer ce médicament" aria-label={'Retirer le médicament ' + (index + 1)} onClick={() => removeLine(line.id)}><Icon name="close" /></button>
            </div>
          ))}
          </div>
          <button type="button" className="btn-light add-medication" disabled={saving} onClick={addLine}>
            <Icon name="plus" /> Ajouter un médicament
          </button>
          <div className="dispensation-footer">
            <div className="total" aria-live="polite">
              <span className="label">Total · {lines.length} {lines.length > 1 ? 'lignes' : 'ligne'}</span>
              <span className="value">{totalPrice.toLocaleString()} Ar</span>
            </div>

            <div className="actions">
              <button type="button" className="btn-light" disabled={saving} onClick={closeCreate}>Annuler</button>
              <button type="submit" disabled={saving}><Icon name="plus" /> {saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </form>
      </dialog>

      <div className="panel" ref={listRef}>
        <h3><Icon name="file" size="md" /> Historique des achats</h3>

        <div className="purchase-period-tools">
          <div className="search-field purchase-number">
            <Icon name="search" />
            <input type="search" aria-label="Rechercher par numéro d’achat" placeholder="N° d’achat…"
              value={searchNumber} onChange={(e) => changeNumber(e.target.value)} />
          </div>
          <DatePicker value={searchDate} onChange={changeDate} label="Choisir une date" clearLabel="Effacer le filtre de date" />
          {(searchNumber || searchDate) && <button type="button" className="btn-light" onClick={resetFilters}>Réinitialiser</button>}
          <button type="button" className="btn-light export-month" disabled={exporting || !canExportMonth} onClick={exportMonth}
            title={`Exporter tous les achats de ${periodLabel}`}>
            <Icon name="excel" /> {exporting ? 'Export en cours…' : `Exporter ${periodLabel}`}
          </button>
        </div>
        <div className="purchase-month-summary" role="status">
          <span>{searchDate ? formatDay(searchDate) : searchNumber.trim() ? 'Recherche par numéro · Toutes les dates' : periodLabel} · {filtered.length} achat{filtered.length !== 1 ? 's' : ''}</span>
          <strong>Total {searchDate || searchNumber.trim() ? 'affiché' : 'du mois'} : {monthTotal.toLocaleString()} Ar</strong>
        </div>

        <div className="purchase-list">
          {filtered.length === 0 && <p className="empty">{searchDate || searchNumber.trim() ? 'Aucun achat ne correspond à ces critères.' : `Aucun achat enregistré en ${periodLabel}.`}</p>}
          {filtered.map((purchase) => (
          <article className="purchase-card" key={purchase.id} aria-labelledby={`purchase-${purchase.id}`}>
            <div className="purchase-header">
              <div>
                <h4 id={`purchase-${purchase.id}`}>Achat n° {purchase.id}</h4>
                <span>{formatDateTime(purchase.created_at)} · {purchase.items.length} {purchase.items.length > 1 ? 'médicaments' : 'médicament'}</span>
              </div>
              <div className="purchase-total">
                <span>Total de l’achat</span>
                <strong>{purchase.total.toLocaleString()} Ar</strong>
              </div>
              <button type="button" className="btn-light" disabled={exporting}
                aria-label={`Télécharger la facture de l’achat ${purchase.id}`}
                onClick={() => downloadReceipt(purchase.items[0])}>
                <Icon name="file" /> Facture PDF
              </button>
            </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Médicament</th>
                <th className="center">Forme pharmaceutique</th>
                <th className="center">Qté</th>
                <th className="num">Total</th>
                <th className="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((dispensation) => {
                const editing = editingId === Number(dispensation.id)
                const total = (Number(dispensation.unit_price || 0) * Number(dispensation.quantity)).toLocaleString()

                return (
                  <tr key={dispensation.id}>
                    {editing ? (
                      <>
                        <td>
                          <select
                            aria-label="Médicament à modifier"
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
                            aria-label="Quantité à modifier"
                            type="number"
                            min="1"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                          />
                        </td>
                        <td className="num">-</td>
                        <td className="actions">
                          <div>
                            <button className="icon-btn confirm" title="Enregistrer" aria-label="Enregistrer la modification" onClick={saveEdit}>
                              <Icon name="check" />
                            </button>
                            <button className="icon-btn cancel" title="Annuler" aria-label="Annuler la modification" onClick={() => setEditingId(null)}>
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
                            <button className="icon-btn edit" title="Modifier" aria-label={`Modifier ${dispensation.medication_name}`} onClick={() => startEdit(dispensation)}>
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
          </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DispensationPage
