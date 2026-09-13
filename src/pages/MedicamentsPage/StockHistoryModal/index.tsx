import Icon from '../../../components/Icon'
import type { Medication, StockHistoryEntry } from '../../../../electron/types'
import { formatDate } from '../../../utils/date'
import './StockHistoryModal.scss'

type Props = {
  medication: Medication
  history: StockHistoryEntry[]
  onClose: () => void
}

const sumBy = (history: StockHistoryEntry[], type: StockHistoryEntry['movement_type']) =>
  history.filter((entry) => entry.movement_type === type).reduce((sum, entry) => sum + entry.quantity, 0)

// Historique présenté en colonnes : une colonne par mouvement
const StockHistoryModal = ({ medication, history, onClose }: Props) => (
  <div className="modal-overlay">
    <div className="StockHistoryModal modal">
      <div className="header">
        <h3>Historique du stock – {medication.name}</h3>
        <button className="close" onClick={onClose}><Icon name="close" /></button>
      </div>

      <div className="summary">
        <span className="item">Stock actuel : <strong className="current">{medication.stock ?? 0}</strong></span>
        <span className="item entry">Entrées : <strong>{sumBy(history, 'entry')}</strong></span>
        <span className="item exit">Sorties : <strong>{sumBy(history, 'exit')}</strong></span>
      </div>

      <div className="scroll">
        <table>
          <tbody>
            <tr className="date">
              <th>Date</th>
              {history.map((entry, index) => <td key={entry.id ?? `initial-${index}`}>{formatDate(entry.created_at)}</td>)}
            </tr>
            <tr className="type">
              <th>Type</th>
              {history.map((entry, index) => (
                <td key={entry.id ?? `initial-${index}`}>
                  <span className={`badge ${entry.initial ? 'info' : entry.movement_type}`}>
                    {entry.initial ? 'Init' : (entry.movement_type === 'entry' ? 'Entrée' : 'Sortie')}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="entry">
              <th>Entrée</th>
              {history.map((entry, index) => (
                <td key={entry.id ?? `initial-${index}`}>{entry.movement_type === 'entry' ? `+${entry.quantity}` : '-'}</td>
              ))}
            </tr>
            <tr className="exit">
              <th>Sortie</th>
              {history.map((entry, index) => (
                <td key={entry.id ?? `initial-${index}`}>{entry.movement_type === 'exit' ? `-${entry.quantity}` : '-'}</td>
              ))}
            </tr>
            <tr className="stock">
              <th>Stock</th>
              {history.map((entry, index) => <td key={entry.id ?? `initial-${index}`}>{entry.stock_after}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="actions">
        <button className="btn-light" onClick={onClose}>Fermer</button>
      </div>
    </div>
  </div>
)

export default StockHistoryModal
