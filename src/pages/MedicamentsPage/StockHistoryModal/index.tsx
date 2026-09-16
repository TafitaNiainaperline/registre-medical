import { useEffect, useRef } from 'react'
import Icon from '../../../components/Icon'
import type { Medication, StockHistoryEntry } from '../../../../electron/types'
import { formatDateTime, formatDay } from '../../../utils/date'
import './StockHistoryModal.scss'

type Props = { medication: Medication; history: StockHistoryEntry[]; onClose: () => void }

const StockHistoryModal = ({ medication, history, onClose }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog ref={dialogRef} className="StockHistoryModal modal" aria-labelledby="stock-history-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      <div className="header">
        <div><h3 id="stock-history-title">Historique du stock</h3><p className="medication-name">{medication.name}</p></div>
        <button type="button" className="close" aria-label="Fermer l’historique du stock" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="stock-summary"><span>Stock actuel</span><strong>{medication.stock == null ? 'Non suivi' : `${medication.stock.toLocaleString()} ${medication.unit || 'unité(s)'}`}</strong></div>
      <div className="scroll">
        <table>
          <thead><tr><th>Date et heure</th><th>Mouvement</th><th className="num">Quantité</th></tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan={3} className="empty">Aucun mouvement enregistré.</td></tr>}
            {history.map((entry, index) => {
              const isEntry = entry.movement_type === 'entry'
              const dateOnly = /^\d{4}-\d{2}-\d{2}(?:[ T]00:00:00)?$/.test(entry.created_at)
              return <tr key={entry.id ?? `initial-${index}`}>
                <td className="movement-date">{dateOnly ? formatDay(entry.created_at.slice(0, 10)) : formatDateTime(entry.created_at)}</td>
                <td><span className={`movement-label ${entry.initial ? 'initial' : isEntry ? 'entry' : 'exit'}`}>{entry.initial ? 'Stock initial' : isEntry ? 'Entrée' : 'Sortie'}</span></td>
                <td className={`num movement-quantity ${isEntry ? 'entry' : 'exit'}`}>{isEntry ? '+' : '−'}{Number(entry.quantity).toLocaleString()}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      <div className="actions"><button type="button" className="btn-light" onClick={onClose}>Fermer</button></div>
    </dialog>
  )
}
export default StockHistoryModal
