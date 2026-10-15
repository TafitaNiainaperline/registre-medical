import { Fragment, useState } from 'react'
import Icon from '../../components/Icon'
import { categories } from '../../constants'
import { formatDate } from '../../utils/date'
import { displayAge, displayRegistryNumber } from '../../utils/record'
import { archiveKey, useArchivesPage } from './useArchivesPage'
import './ArchivesPage.scss'

const ArchivesPage = () => {
  const { archives, selected, setSelected, category, setCategory, search, setSearch,
    rows, groups, loading, message, reload, exportExcel, total, canExport } = useArchivesPage()
  const [expanded, setExpanded] = useState<string | null>(null)
  const years = [...new Set(archives.map((archive) => archive.year))].sort((a, b) => b - a)
  const months = archives.filter((archive) => archive.year === selected?.year).sort((a, b) => a.month - b.month)
  const categoryLabel = (key: string) => categories.find((item) => item.key === key)?.label || key
  return <section className="ArchivesPage">
    <div className="page-header"><div><h1>Archives des registres</h1><p>Retrouvez les patients et le détail de leurs visites.</p></div></div>
    <div className="archive-tools">
      <label>Année<select aria-label="Année des archives" value={selected?.year || ''} disabled={!archives.length}
        onChange={(event) => { setExpanded(null); setSelected(archives.find((archive) => archive.year === Number(event.target.value) && archive.month === selected?.month) || archives.find((archive) => archive.year === Number(event.target.value)) || null) }}>
        {!years.length && <option value="">Aucune archive</option>}
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select></label>
      <label>Mois<select aria-label="Mois des archives" value={archiveKey(selected)} disabled={!months.length}
        onChange={(event) => { setExpanded(null); setSelected(archives.find((archive) => archiveKey(archive) === event.target.value) || null) }}>
        {!months.length && <option value={archiveKey(selected)}>Aucune archive</option>}
        {months.map((archive) => <option key={archiveKey(archive)} value={archiveKey(archive)}>{new Date(archive.year, archive.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}</option>)}
      </select></label>
      <label>Registre<select value={category} onChange={(event) => { setExpanded(null); setCategory(event.target.value) }}>
        <option value="">Tous les registres</option>{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select></label>
      <label className="archive-search">Recherche<input type="search" placeholder="Patient, diagnostic, numéro, médicament ou acte…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <button type="button" className="btn-light" onClick={reload} disabled={loading} aria-label="Actualiser les archives"><Icon name="history" /></button>
      <button type="button" className="btn-light" onClick={exportExcel} disabled={!canExport}><Icon name="excel" /> {search.trim() ? 'Exporter les résultats' : 'Exporter le mois'}</button>
    </div>
    {message && <div role="status">{message}</div>}
    <div className="table-wrap">
      <table><thead><tr><th>N° registre</th><th>Patient</th>{!category && <th>Registre</th>}<th className="center">Visites</th><th>Dernière visite</th><th className="num">Total (Ar)</th><th>Details</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={category ? 6 : 7} className="empty" role="status">Chargement…</td></tr> : groups.length === 0 ?
            <tr><td colSpan={category ? 6 : 7} className="empty">{archives.length ? 'Aucune donnée trouvée.' : 'Aucune archive disponible.'}</td></tr> :
            groups.map((group) => {
              const row = group.latest
              const open = expanded === group.key
              return <Fragment key={group.key}>
                <tr>
                  <td className="registry">{displayRegistryNumber(row.registry_number, row.category)}</td>
                  <td><strong>{row.patient_nom} {row.patient_prenom}</strong><small className="patient-meta">{row.sexe || 'Sexe non renseigné'} · {displayAge(row.age)}</small></td>
                  {!category && <td>{categoryLabel(row.category)}</td>}
                  <td className="center">{group.visits.length}</td><td className="date">{formatDate(row.created_at)}</td>
                  <td className="num amount">{group.total.toLocaleString()}</td>
                  <td><button type="button" className="btn-light" aria-expanded={open} aria-controls={`archive-visits-${row.id}`}
                    onClick={() => setExpanded(open ? null : group.key)}>{open ? 'Masquer' : 'Voir les visites'}</button></td>
                </tr>
                {open && <tr className="visit-details"><td colSpan={category ? 6 : 7}>
                  <div id={`archive-visits-${row.id}`} className="visit-list">
                    {group.visits.map((visit) => <article key={visit.id}>
                      <div className="visit-heading"><strong>{formatDate(visit.created_at)}</strong><strong>{Number(visit.cost || 0).toLocaleString()} Ar</strong></div>
                      <p><span>{visit.category === 'echographie' ? 'RC (renseignement clinique)' : 'Diagnostic'}</span> {visit.diagnostic || 'Non renseigné'}</p>
                      {visit.treatments?.length ? (
                        <div className="table-wrap visit-treatments">
                          <table aria-label="Détail des médicaments et actes médicaux de la visite">
                            <thead><tr><th>Médicament / acte médical</th><th>Type</th><th>Quantité</th><th className="num">Prix unitaire (Ar)</th><th className="num">Total (Ar)</th></tr></thead>
                            <tbody>{visit.treatments.map((treatment, index) => (
                              <tr key={index}>
                                <td>{treatment.name}</td>
                                <td>{treatment.item_type === 'act' ? 'Acte médical' : 'Médicament'}</td>
                                <td>{treatment.quantity.toLocaleString('fr-FR')}{treatment.unit ? ` ${treatment.unit}` : ''}</td>
                                <td className="num">{Number(treatment.unit_price || 0).toLocaleString('fr-FR')}</td>
                                <td className="num amount">{(Number(treatment.quantity) * Number(treatment.unit_price || 0)).toLocaleString('fr-FR')}</td>
                              </tr>
                            ))}</tbody>
                            <tfoot>
                              <tr><th colSpan={4}>Total médicaments</th><td className="num">{visit.treatments.filter((item) => item.item_type !== 'act').reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price || 0), 0).toLocaleString('fr-FR')}</td></tr>
                              <tr><th colSpan={4}>Total actes médicaux</th><td className="num">{visit.treatments.filter((item) => item.item_type === 'act').reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price || 0), 0).toLocaleString('fr-FR')}</td></tr>
                              <tr><th colSpan={4}>Total de la visite</th><td className="num amount">{Number(visit.cost || 0).toLocaleString('fr-FR')}</td></tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : <p><span>Médicaments et actes médicaux</span> {visit.traitement || 'Aucun traitement ni acte médical'}</p>}
                      {visit.observation && <p><span>Observation</span> {visit.observation}</p>}
                    </article>)}
                  </div>
                </td></tr>}
              </Fragment>
            })}
        </tbody>
      </table>
      {!loading && rows.length > 0 && <div className="summary"><span>{groups.length} dossier{groups.length > 1 ? 's' : ''} · {rows.length} visite{rows.length > 1 ? 's' : ''}</span><strong>Total : {total.toLocaleString()} Ar</strong></div>}
    </div>
  </section>
}
export default ArchivesPage
