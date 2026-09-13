import type { Medication, Treatment } from '../../../electron/types'
import { useTreatmentSelector } from './useTreatmentSelector'
import './TreatmentSelector.scss'

type Props = {
  medications: Medication[]
  value: Treatment[]
  onChange?: (next: Treatment[]) => void
}

const TreatmentSelector = ({ medications, value, onChange }: Props) => {
  const {
    treatments, byId, filteredMeds, searchName, isDropdownOpen,
    setSearchName, setIsDropdownOpen, updateQty, remove, pick, total, toNumber,
  } = useTreatmentSelector(medications, value, onChange)

  return (
    <div className="TreatmentSelector">
      <div className="top">
        <div className="finder">
          <input
            value={searchName}
            placeholder="Rechercher un médicament ou un acte à ajouter..."
            onChange={(e) => { setSearchName(e.target.value); setIsDropdownOpen(true) }}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
            autoComplete="off"
          />

          {isDropdownOpen && filteredMeds.length > 0 && (
            <div className="dropdown">
              {filteredMeds.map((m) => (
                <div
                  key={m.id}
                  className={m.item_type === 'act' ? 'option act' : 'option med'}
                  onMouseDown={() => pick(m)}
                >
                  <span className="name">{m.name}</span>
                  <span className="meta">
                    {m.item_type === 'act' ? 'Acte' : (m.unit || 'unité')}
                    {m.item_type !== 'act' && m.stock !== null && m.stock !== undefined && (
                      <span className="stock">Stock: {m.stock}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="total">Total : <strong>{total} Ar</strong></div>
      </div>

      {treatments.length > 0 && (
        <div className="list">
          {treatments.map((t) => {
            const med = byId.get(String(t.medication_id))
            const showUnit = t.item_type !== 'act' && med?.item_type !== 'act'
            return (
              <div className="row" key={String(t.medication_id)}>
                <div className="label">
                  <strong>{t.name}</strong>
                  <span className="price">
                    {toNumber(t.unit_price)} Ar{showUnit ? ` / ${t.unit || med?.unit || 'unité'}` : ''}
                  </span>
                </div>

                <div className="controls">
                  {t.item_type !== 'act' && (
                    <input
                      className="qty"
                      type="number"
                      min="1"
                      value={t.quantity}
                      onChange={(e) => updateQty(t.medication_id, e.target.value)}
                    />
                  )}
                  <span className="line-total">{toNumber(t.unit_price) * toNumber(t.quantity)} Ar</span>
                  <button type="button" className="btn-danger" onClick={() => remove(t.medication_id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TreatmentSelector
