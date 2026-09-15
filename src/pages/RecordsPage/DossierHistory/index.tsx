import Icon from '../../../components/Icon'
import { formatDateTime } from '../../../utils/date'
import { displayRegistryNumber, treatmentsLabel } from '../../../utils/record'
import type { HistoryRow } from '../../../utils/record'
import './DossierHistory.scss'

type Props = {
  rows: HistoryRow[]
  loading: boolean
  patientName: string
  onReceipt: (row: HistoryRow) => void
  onClose: () => void
}

const DossierHistory = ({ rows, loading, patientName, onReceipt, onClose }: Props) => (
  <div className="DossierHistory">
    <div className="history-header">
      <h3><Icon name="history" size="md" /> Visites de {patientName}</h3>
      <button type="button" className="btn-light" onClick={onClose} aria-label="Fermer l’historique"><Icon name="close" /></button>
    </div>

    {loading && <p>Chargement de l'historique...</p>}
    {!loading && rows.length === 0 && <p className="empty">Aucun historique de dossier disponible.</p>}

    {!loading && rows.length > 0 && (
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Visite</th>
              <th>N°</th>
              <th>Date / Heure</th>
              <th>Traitement</th>
              <th>Observation</th>
              <th>Montant de la visite</th>
              <th>Reçu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isCurrent = index === rows.length - 1
              return (
                <tr key={row.id}>
                  <td className={isCurrent ? 'visit current' : 'visit'}>
                    {`Visite ${index + 1}`}{isCurrent && <small> · Dernière</small>}
                  </td>
                  <td className="registry">{displayRegistryNumber(row.registry_number)}</td>
                  <td className="date">{formatDateTime(row.created_at)}</td>
                  <td>{treatmentsLabel(row.treatments) || row.traitement || '-'}</td>
                  <td>{row.observation || '-'}</td>
                  <td className="current">{row.cost} Ar</td>
                  <td>
                    <button type="button" className="btn-light" onClick={() => onReceipt(row)} aria-label={`Télécharger le reçu de la visite ${index + 1}`}>
                      <Icon name="file" /> PDF
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
)

export default DossierHistory
