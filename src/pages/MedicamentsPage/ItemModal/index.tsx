import Icon from '../../../components/Icon'
import DatePicker from '../../../components/DatePicker'
import type { ItemType } from '../../../../electron/types'
import type { MedicationForm } from '../types'
import './ItemModal.scss'

type Props = {
  itemType: ItemType
  editing: boolean
  form: MedicationForm
  isAdmin: boolean
  onChange: (form: MedicationForm) => void
  onSubmit: () => void
  onClose: () => void
}

const UNITS = [
  'comprimé', 'gélule', 'sachet', 'sirop', 'solution buvable', 'ampoule', 'injection', 'perfusion',
  'pommade', 'crème', 'gel', 'spray', 'gouttes', 'suppositoire', 'ovule', 'patch', 'inhalateur',
  'poudre', 'pastille', 'plaquette', 'boîte', 'flacon', 'tube', 'sachet individuel',
]

// Même modale pour créer et pour modifier, médicament comme acte
const ItemModal = ({ itemType, editing, form, isAdmin, onChange, onSubmit, onClose }: Props) => {
  const isAct = itemType === 'act'
  const set = (patch: Partial<MedicationForm>) => onChange({ ...form, ...patch })

  const title = editing
    ? (isAct ? 'Modifier l’acte médical' : 'Modifier le médicament')
    : (isAct ? 'Nouvel acte médical' : 'Nouveau médicament')

  return (
    <div className="modal-overlay">
      <div className="ItemModal modal">
        <div className="header">
          <h3>{title}</h3>
          <button className="close" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="fields">
          <label className="field wide">
            <span>{isAct ? 'Nom de l’acte' : 'Nom du médicament'}</span>
            <input
              placeholder={isAct ? 'Ex. Échographie' : 'Ex. Paracetamol'}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Prix (Ar)</span>
            <input type="number" min="0" placeholder="0" value={form.price} onChange={(e) => set({ price: e.target.value })} />
          </label>

          {!isAct && (
            <>
              <label className="field">
                <span>Unité</span>
                <select value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
                  {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Stock {isAdmin ? '' : '(réservé à l’administrateur)'}</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => set({ stock: e.target.value })}
                  readOnly={!isAdmin}
                />
              </label>

              <label className="field">
                <span>Seuil d’alerte</span>
                <input
                  type="number"
                  min="0"
                  value={form.stock_threshold}
                  onChange={(e) => set({ stock_threshold: e.target.value })}
                />
                <small>Alerte lorsque le stock atteint ou descend sous cette valeur.</small>
              </label>
            </>
          )}

          {!editing && (
            <div className="field wide">
              <span>Date d’ajout</span>
              <DatePicker value={form.date} onChange={(date) => set({ date })} label="Choisir une date" />
            </div>
          )}
        </div>

        <div className="actions">
          <button type="button" className="btn-light" onClick={onClose}>Annuler</button>
          <button type="button" onClick={onSubmit}>{editing ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}

export default ItemModal
