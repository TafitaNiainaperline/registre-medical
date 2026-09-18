import Icon from '../../components/Icon'
import { useDashboardPage } from './useDashboardPage'
import './DashboardPage.scss'

const DashboardPage = () => {
  const {
    selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, availableYears, stats, dispensations,
    periodLabel, loading, error, ready,
    totalRecords, totalAmount, cashOutflowTotal, balance, tdr,
    sexSummary, ageGroupSummary, diagnosticSummary, pfSummary, cpnSummary, diagnosticsByCategory,
  } = useDashboardPage()

  return (
    <section className="DashboardPage">
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Aperçu mensuel des registres — {periodLabel}.</p>
        </div>

        <div className="tools">
          <select aria-label="Mois du tableau de bord" disabled={!ready} value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleDateString('fr-FR', { month: 'long' })}</option>
            ))}
          </select>
          <select aria-label="Année du tableau de bord" disabled={!ready} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>

          <div className="page-badge">
            <Icon name="activity" /> Gestion Clinique
          </div>
        </div>
      </div>

      {loading ? <p role="status">Chargement du mois…</p> : error ? <p className="error-msg" role="alert">{error}</p> : (
      <>
      <div className="cards-grid overview">
        <article className="stat-card blue">
          <div className="top">
            <Icon name="folder" size="xl" />
            <h3>Total dossiers</h3>
          </div>
          <strong className="value">{totalRecords}</strong>
          <span className="subtitle">{periodLabel}</span>
        </article>

        <article className="stat-card green">
          <div className="top">
            <span className="currency-icon" aria-hidden="true">Ar</span>
            <h3>Montant facturé</h3>
          </div>
          <strong className="value">{totalAmount.toLocaleString()} Ar</strong>
          <span className="subtitle">Total du mois</span>
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

      </div>

      <div className="cards-grid">
        <article className="stat-card amber">
          <div className="top">
            <Icon name="users" size="xl" />
            <h3>Sexe des patients (CE)</h3>
          </div>
          <div className="rows">
            {sexSummary.length === 0 && <span className="muted">Aucun patient en consultation externe ce mois.</span>}
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
        {([
          { title: 'Produits PF', icon: 'heart', tone: 'violet', entries: pfSummary },
          { title: 'CPN', icon: 'baby', tone: 'pink', entries: cpnSummary },
        ] as const).map((summary) => (
          <article className={`stat-card registry-counts ${summary.tone}`} key={summary.title}>
            <div className="top">
              <Icon name={summary.icon} size="md" />
              <h3>{summary.title}</h3>
            </div>
            <p className="scope">{periodLabel}</p>
            {summary.entries.length === 0 ? <span className="muted">Aucun produit PF enregistré pour ce mois</span> : (
              <dl className="summary-chips">
                {summary.entries.map(([label, count]) => (
                  <div className="summary-chip" key={label}>
                    <dt>{label}</dt><dd>{count.toLocaleString('fr-FR')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        ))}

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
      </>
      )}
    </section>
  )
}

export default DashboardPage
