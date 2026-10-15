import { useEffect, useRef, useState } from 'react'
import type { Medication } from '../../../electron/types'
import { medicationUsage } from '../../utils/medicationUsage'
import { errorMessage } from '../../utils/error'
import { formatDateTime } from '../../utils/date'
import Icon from '../../components/Icon'
import './MedicationUsage.scss'

export default function MedicationUsage({ medication, onClose }: { medication: Medication; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<ReturnType<typeof medicationUsage> | null>(null)
  const [stock, setStock] = useState(medication.stock)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const previous = document.activeElement
    const dialog = dialogRef.current
    dialog?.showModal()
    Promise.all([window.api.fetchRecordsByArchive({}), window.api.getDispensations(), window.api.listMedications()])
      .then(([records, dispensations, catalogue]) => {
        if (!active) return
        setData(medicationUsage(medication, records, dispensations))
        setStock(catalogue.find((item) => item.id === medication.id)?.stock ?? null)
      }).catch((err) => { if (active) setError(errorMessage(err, 'Impossible de charger les utilisations.')) })
    return () => {
      active = false
      dialog?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [medication])
  const isAct = medication.item_type === 'act'
  const unit = isAct ? 'acte(s)' : medication.unit || 'unité(s)'
  return <dialog ref={dialogRef} className="StockHistoryModal MedicationUsage modal" aria-labelledby="medication-usage-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="header">
      <div><h3 id="medication-usage-title">Quantités utilisées</h3><p className="medication-name">{medication.name} · Toutes les périodes et archives</p></div>
      <button type="button" className="close" aria-label="Fermer les utilisations" onClick={onClose}><Icon name="close" /></button>
    </div>
    {error ? <p role="alert" className="error-msg">{error}</p> : !data ? <p role="status">Chargement des utilisations…</p> : <>
      {!isAct && <div className="stock-summary"><span>Stock restant actuel</span><strong>{stock == null ? 'Non suivi' : `${stock.toLocaleString('fr-FR')} ${unit}`}</strong></div>}
      <div className="scroll">
        <table aria-label="Quantités utilisées par destination">
          <thead><tr><th>Destination</th><th className="num">Quantité ({unit})</th></tr></thead>
          <tbody>{data.totals.map((item) => <tr key={item.source}><td>{item.source}</td><td className="num">{item.quantity.toLocaleString('fr-FR')}</td></tr>)}</tbody>
          <tfoot><tr><th>Total utilisé</th><th className="num">{data.total.toLocaleString('fr-FR')}</th></tr></tfoot>
        </table>
        <p>Quantités des visites et dispensations enregistrées, après modifications et suppressions.</p>
        <h4>Détail des utilisations</h4>
        <table aria-label="Historique des utilisations">
          <thead><tr><th>Date</th><th>Destination</th><th>Patient</th><th>N°</th><th className="num">Quantité</th></tr></thead>
          <tbody>{data.entries.length === 0 && <tr><td colSpan={5} className="empty">Aucune utilisation enregistrée.</td></tr>}
            {data.entries.map((entry) => <tr key={entry.id}><td>{formatDateTime(entry.date)}</td><td>{entry.source}</td><td>{entry.patient}</td><td>{entry.reference}</td><td className="num">{entry.quantity.toLocaleString('fr-FR')}</td></tr>)}</tbody>
        </table>
      </div>
    </>}
    <div className="actions"><button type="button" className="btn-light" onClick={onClose}>Fermer</button></div>
  </dialog>
}
