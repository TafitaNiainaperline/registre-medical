import Icon from '../../../components/Icon'
import type { Medication } from '../../../../electron/types'
import './StockModal.scss'

type Props = {
  medication: Medication
  quantity: string
  date: string
  author: string
  onQuantityChange: (value: string) => void
  onDateChange: (value: string) => void
  onConfirm: () => void
  onClose: () => void
}

const StockModal = ({
  medication, quantity, date, author,
  onQuantityChange, onDateChange, onConfirm, onClose,
}: Props) => (
  <div className="modal-overlay">
    <div className="StockModal modal">
      <div className="header">
        <h3>Ajouter au stock – {medication.name}</h3>
        <button className="close" onClick={onClose}><Icon name="close" /></button>
      </div>

      <p>Stock actuel : <strong>{medication.stock ?? 0}</strong></p>

      <label className="field">
        <span>Quantité à ajouter</span>
        <input type="number" min="1" placeholder="Ex: 100" value={quantity} onChange={(e) => onQuantityChange(e.target.value)} />
      </label>

      <label className="field">
        <span>Date d'ajout</span>
        <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
      </label>

      <div className="author">Ajouté par : <strong>{author}</strong></div>

      <div className="actions">
        <button className="btn-light" onClick={onClose}>Annuler</button>
        <button onClick={onConfirm}>Ajouter au stock</button>
      </div>
    </div>
  </div>
)

export default StockModal
