import Icon from '../../../components/Icon'
import { formatDateTime } from '../../../utils/date'
import { displayRegistryNumber, treatmentsLabel } from '../../../utils/record'
import type { HistoryRow } from '../../../utils/record'
import './DossierHistory.scss'

type Props = {
  rows: HistoryRow[]
  loading: boolean
}

const DossierHistory = ({ rows, loading }: Props) => (
  <div className="DossierHistory">
    <h3><Icon name="history" size="md" /> Historique du dossier</h3>

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
              <th>Coût ancien</th>
              <th>Coût présent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isCurrent = index === rows.length - 1
              return (
                <tr key={row.id}>
                  <td className={isCurrent ? 'visit current' : 'visit'}>
                    {isCurrent ? 'Présent' : `Ancien ${index + 1}`}
                  </td>
                  <td className="registry">{displayRegistryNumber(row.registry_number)}</td>
                  <td className="date">{formatDateTime(row.created_at)}</td>
                  <td>{treatmentsLabel(row.treatments) || row.traitement || '-'}</td>
                  <td>{row.observation || '-'}</td>
                  <td className="date">{isCurrent ? '-' : `${row.cost} Ar`}</td>
                  <td className="current">{isCurrent ? `${row.cost} Ar` : '-'}</td>
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
