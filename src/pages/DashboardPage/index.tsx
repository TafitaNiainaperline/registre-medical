import Icon from '../../components/Icon'
import FilterCard from '../../components/FilterCard'
import { useDashboardPage } from './useDashboardPage'
import './DashboardPage.scss'

const DashboardPage = () => {
  const {
    selectedYear, setSelectedYear, availableYears, stats, archiveDiagnostics, dispensations,
    totalRecords, totalAmount, cashOutflowTotal, balance, tdr,
    sexSummary, ageGroupSummary, diagnosticSummary, pfSummary, cpnSummary, diagnosticsByCategory,
  } = useDashboardPage()

  return (
    <section className="DashboardPage">
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Aperçu général des registres — {selectedYear}.</p>
        </div>

        <div className="tools">
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>

          <div className="page-badge">
            <Icon name="activity" /> Gestion Clinique
          </div>
        </div>
      </div>

      <div className="cards-grid">
        <article className="stat-card blue">
          <div className="top">
            <Icon name="folder" size="xl" />
            <h3>Total dossiers</h3>
          </div>
          <strong className="value">{totalRecords}</strong>
          <span className="subtitle">Cette année</span>
        </article>

        <article className="stat-card green">
          <div className="top">
            <Icon name="money" size="xl" />
            <h3>Montant facturé</h3>
          </div>
          <strong className="value">{totalAmount.toLocaleString()} Ar</strong>
          <span className="subtitle">Total des coûts</span>
        </article>

        <article className="stat-card red">
          <div className="top">
            <Icon name="bank" size="xl" />
            <h3>Solde de caisse</h3>
          </div>
          <strong className="value">{balance.toLocaleString()} Ar</strong>
          <span className="subtitle">
            Entrées : {totalAmount.toLocaleString()} Ar | Sorties : {cashOutflowTotal.toLocaleString()} Ar
          </span>
        </article>

        <article className="stat-card amber">
          <div className="top">
            <Icon name="users" size="xl" />
            <h3>Sexe des patients</h3>
          </div>
          <div className="rows">
            {sexSummary.map(([sex, count]) => (
              <span className="row" key={sex}>
                <span>{sex}</span>
                <strong className="count-badge">{count}</strong>
              </span>
            ))}
          </div>
        </article>

        <article className="stat-card purple">
          <div className="top">
            <Icon name="microscope" size="xl" />
            <h3>Top diagnostics</h3>
          </div>
          <div className="rows">
            {diagnosticSummary.slice(0, 4).map(([diagnostic, count]) => (
              <span className="row" key={diagnostic}>
                <span>{diagnostic}</span>
                <strong className="count-badge">{count}</strong>
              </span>
            ))}
            {diagnosticSummary.length === 0 && <span className="muted">Aucun diagnostic</span>}
          </div>
        </article>

        <article className="stat-card pink">
          <div className="top">
            <Icon name="bug" size="xl" />
            <h3>TDR Paludisme</h3>
          </div>
          <div className="rows">
            <span className="row">
              <span className="positive">Positif</span>
              <strong className="count-badge red">{tdr.positif || 0}</strong>
            </span>
            <span className="row">
              <span className="negative">Négatif</span>
              <strong className="count-badge blue">{tdr.negatif || 0}</strong>
            </span>
          </div>
        </article>
      </div>

      <div className="cards-grid">
        <FilterCard
          title="Produits PF"
          icon="heart"
          tone="green"
          placeholder="Filtrer les produits..."
          entries={pfSummary.map(([label, value]) => ({ label, value }))}
        />

        <FilterCard
          title="CPN"
          icon="baby"
          tone="pink"
          placeholder="Filtrer les CPN..."
          entries={cpnSummary.map(([label, value]) => ({ label, value }))}
        />

        <article className="stat-card sky">
          <div className="top">
            <Icon name="pill" size="xl" />
            <h3>Dispensations</h3>
          </div>
          <strong className="value">{dispensations.count}</strong>
          <span className="subtitle">Total : {dispensations.total.toLocaleString()} Ar</span>
        </article>
      </div>

      {ageGroupSummary.length > 0 && (
        <div className="panel">
          <h3><Icon name="users" size="md" /> Patients par tranche d'âge</h3>
          <div className="age-groups">
            {ageGroupSummary.map(([group, count]) => (
              <span className="group" key={group}>
                {group} <strong>({count})</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {archiveDiagnostics.length > 0 && (
        <div className="panel">
          <h3><Icon name="calendar" size="md" /> Diagnostics par mois</h3>
          <div className="months">
            {archiveDiagnostics.map((archive) => (
              <div className="month" key={archive.label}>
                <div className="label">{archive.label}</div>

                {archive.topDiagnostics.length === 0 ? (
                  <span className="muted">Aucun diagnostic enregistré</span>
                ) : (
                  <div className="tags">
                    {archive.topDiagnostics.map(([diagnostic, count]) => (
                      <span className="tag" key={diagnostic}>{diagnostic} ({count})</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h3><Icon name="activity" size="md" /> Diagnostics par registre</h3>
        <div className="cards-grid">
          {diagnosticsByCategory.map((category) => (
            <article className={`stat-card ${category.key}`} key={category.key}>
              <h4>{category.label}</h4>
              <div className="rows scroll">
                {category.diagnostics.length === 0
                  ? <span className="muted">Aucun diagnostic</span>
                  : category.diagnostics.map(([diagnostic, count]) => (
                    <span className="row" key={diagnostic}>
                      <span>{diagnostic}</span>
                      <strong className="count-badge">{count}</strong>
                    </span>
                  ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3><Icon name="folder" size="md" /> Registres</h3>
        <div className="cards-grid">
          {diagnosticsByCategory.map((category) => (
            <article className={`stat-card register ${category.key}`} key={category.key}>
              <Icon name={category.icon} size="xxl" />
              <h4>{category.label}</h4>
              <strong className="value">{stats[category.key] || 0}</strong>
              <span className="subtitle">dossiers</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
