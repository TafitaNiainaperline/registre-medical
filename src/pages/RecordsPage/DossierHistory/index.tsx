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
  onPrint: (row: HistoryRow) => void
  printingId: number | null
  onClose: () => void
}

const DossierHistory = ({ rows, loading, patientName, onReceipt, onPrint, printingId, onClose }: Props) => (
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
              <th>{rows[0].category === 'echographie' ? 'Id' : 'N°'}</th>
              <th>Date / Heure</th>
              {rows[0].category === 'cpn' && <th>N° CPN</th>}
              {rows[0].category === 'pf' && <th>Produit PF</th>}
              {rows[0].category === 'echographie' && <th>RC (renseignement clinique)</th>}
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
                  <td className="registry">{displayRegistryNumber(row.registry_number, row.category)}</td>
                  <td className="date">{formatDateTime(row.created_at)}</td>
                  {rows[0].category === 'cpn' && <td>{row.cpn_type || '-'}</td>}
                  {rows[0].category === 'pf' && <td>{row.pf_method || '-'}</td>}
                  {rows[0].category === 'echographie' && <td>{row.diagnostic}</td>}
                  <td>{treatmentsLabel(row.treatments) || row.traitement || '-'}</td>
                  <td>{row.observation || '-'}</td>
                  <td className="current">{row.cost} Ar</td>
                  <td>
                    <button type="button" className="btn-light" disabled={printingId !== null} onClick={() => onPrint(row)} aria-label={`Imprimer le reçu de la visite ${index + 1}`}>
                      {printingId === row.id ? 'Impression…' : 'Imprimer'}
                    </button>
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
