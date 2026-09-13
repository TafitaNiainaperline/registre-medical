import Icon from '../../components/Icon'
import { categories } from '../../constants'
import { formatDate } from '../../utils/date'
import { displayAge, displayRegistryNumber, treatmentsLabel } from '../../utils/record'
import { archiveKey, useArchivesPage } from './useArchivesPage'
import './ArchivesPage.scss'

const ArchivesPage = () => {
  const {
    archives, selected, setSelected, category, setCategory, search, setSearch,
    rows, loading, message, reload, exportExcel, total, canExport,
  } = useArchivesPage()

  return (
    <section className="ArchivesPage">
      <div className="page-header">
        <div>
          <h1>Histoire des registres</h1>
          <p>Consultez les archives mensuelles, recherchez un patient et exportez en Excel.</p>
        </div>
        <div className="page-badge">
          <Icon name="archive" /> Archives
        </div>
      </div>

      <div className="months">
        {archives.map((archive) => (
          <button
            key={archiveKey(archive)}
            type="button"
            className={archiveKey(archive) === archiveKey(selected) ? 'chip active' : 'chip'}
            onClick={() => setSelected(archive)}
          >
            {archive.label} <span className="count">({archive.count})</span>
          </button>
        ))}

        {archives.length === 0 && <div className="empty">Aucune archive disponible.</div>}
      </div>

      <div className="search-bar">
        <input
          placeholder="Rechercher un patient (nom/prénom)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') reload() }}
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        <button className="btn-light" onClick={reload} disabled={loading}>
          <Icon name="search" /> {loading ? 'Chargement...' : 'Rechercher'}
        </button>

        <button className="btn-success" onClick={exportExcel} disabled={!canExport}>
          <Icon name="excel" /> Exporter Excel
        </button>
      </div>

      {message && (
        <div className={message.includes('réussi') ? 'success-msg' : 'error-msg'}>
          <Icon name={message.includes('réussi') ? 'check-circle' : 'alert'} /> {message}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="center">N°</th>
              <th>Patient</th>
              <th className="center">Sexe</th>
              <th className="center">Âge</th>
              <th>Diagnostic</th>
              <th>Traitements</th>
              <th className="num">Coût</th>
              <th className="center">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="empty" colSpan={8}>{loading ? 'Chargement...' : 'Aucune donnée trouvée.'}</td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.id}>
                <td className="center registry">{displayRegistryNumber(row.registry_number)}</td>
                <td><strong>{row.patient_nom}</strong> {row.patient_prenom}</td>
                <td className="center">{row.sexe || '-'}</td>
                <td className="center">{displayAge(row.age)}</td>
                <td>{row.diagnostic}</td>
                <td className="treatments">
                  {treatmentsLabel(row.treatments, { separator: ' • ', withPrice: true }) || row.traitement || '-'}
                </td>
                <td className="num amount">{row.cost} Ar</td>
                <td className="center date">{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length > 0 && (
          <div className="summary">
            <span>{rows.length} enregistrement{rows.length > 1 ? 's' : ''}</span>
            <strong>Total : {total.toLocaleString()} Ar</strong>
          </div>
        )}
      </div>
    </section>
  )
}

export default ArchivesPage
