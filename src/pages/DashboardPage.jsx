import { useEffect, useState } from 'react';
import { categories } from '../constants';

function parseAgeToYears(stored) {
  const value = String(stored || '');
  if (!value) return null;
  if (!value.includes('|')) {
    const [amount, unit] = value.split(' ');
    const num = Number(amount);
    if (Number.isNaN(num)) return null;
    return unit === 'mois' ? num / 12 : num;
  }

  const [amount, type] = value.split('|');
  const num = Number(amount);
  if (Number.isNaN(num)) return null;

  if (type === 'mois' || type === 'mois_jours') return num / 12;
  if (type === 'jours') return 0;
  if (type === 'ans') return num;
  return null;
}

function getAgeGroup(years) {
  if (years === null) return 'Non renseigné';
  if (years < 1) return '0-11 mois';
  if (years <= 5) return '1-5 ans';
  if (years <= 17) return '6-17 ans';
  if (years <= 30) return '18-30 ans';
  if (years <= 50) return '31-50 ans';
  return '51+ ans';
}

function sumNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getPatientId(row) {
  const nom = String(row.patient_nom || '').trim();
  const prenom = String(row.patient_prenom || '').trim();
  return normalizeText(`${nom} ${prenom}`);
}

function getDossierKey(row) {
  return `${getPatientId(row)}|${normalizeText(row.diagnostic)}`;
}

export default function DashboardPage() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [archiveLabel, setArchiveLabel] = useState('');
  const [archiveDiagnostics, setArchiveDiagnostics] = useState([]);
  const [dispensationTotal, setDispensationTotal] = useState(0);
  const [dispensationCount, setDispensationCount] = useState(0);

   useEffect(() => {
    const load = async () => {
      try {
        const current = await window.api.getCurrentArchive?.();
        if (current?.label) setArchiveLabel(current.label);

        const recordsForMonth = await window.api.fetchRecordsByArchive?.({ year: current?.year, month: current?.month });
        const allRecords = recordsForMonth || [];
        setRecords(allRecords);

        const nextStats = allRecords.reduce((acc, row) => {
          const category = row.category || 'unknown';
          if (!acc[category]) acc[category] = new Set();
          acc[category].add(getDossierKey(row));
          return acc;
        }, {});
        const statsWithSizes = {};
        Object.keys(nextStats).forEach(k => { statsWithSizes[k] = nextStats[k].size; });
        setStats(statsWithSizes);

        const dispTotal = await window.api.getDispensationTotal?.({ year: current?.year, month: current?.month });
        setDispensationTotal(Number(dispTotal || 0));

        const dispCount = await window.api.getDispensations?.() || [];
        setDispensationCount(dispCount.length);

        const archives = await window.api.listArchives?.() || [];
        const sortedArchives = [...archives].sort((a, b) => {
          if (Number(a.year) !== Number(b.year)) return Number(b.year) - Number(a.year);
          return Number(b.month) - Number(a.month);
        }).slice(0, 6);

        const archiveSummaries = await Promise.all(sortedArchives.map(async (archive) => {
          const archiveRecords = await window.api.fetchRecordsByArchive?.({ year: archive.year, month: archive.month }) || [];
          const groups = archiveRecords.reduce((acc, row) => {
            const diagnostic = String(row.diagnostic || '').trim();
            if (!diagnostic) return acc;
            if (!acc[diagnostic]) acc[diagnostic] = new Set();
            acc[diagnostic].add(getPatientId(row));
            return acc;
          }, {});
          const topDiagnostics = Object.entries(groups)
            .map(([diag, set]) => [diag, set.size])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          return {
            label: archive.label || `${archive.month}/${archive.year}`,
            topDiagnostics,
          };
        }));
        setArchiveDiagnostics(archiveSummaries);
      } catch {
        setRecords([]);
        setStats({});
        setArchiveDiagnostics([]);
        setDispensationTotal(0);
      }
    };
    load();
  }, []);

  const totalRecords = new Set(records.map(getDossierKey)).size;
  const totalAmount = records.reduce((sum, row) => sum + sumNumber(row.cost), 0) + (Number(dispensationTotal) || 0);

  const sexSummary = Object.entries(records.reduce((acc, row) => {
    const sex = String(row.sexe || '').trim().toUpperCase() || 'Non renseigné';
    if (!acc[sex]) acc[sex] = new Set();
    acc[sex].add(getPatientId(row));
    return acc;
  }, {})).map(([sex, set]) => [sex, set.size]);

  const ageGroupSummary = Object.entries(records.reduce((acc, row) => {
    const years = parseAgeToYears(row.age);
    const group = getAgeGroup(years);
    if (!acc[group]) acc[group] = new Set();
    acc[group].add(getPatientId(row));
    return acc;
  }, {}))
    .map(([group, set]) => [group, set.size])
    .sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }));

  const diagnosticSummary = Object.entries(records.reduce((acc, row) => {
    const diagnostic = String(row.diagnostic || '').trim();
    if (!diagnostic) return acc;
    if (!acc[diagnostic]) acc[diagnostic] = new Set();
    acc[diagnostic].add(getPatientId(row));
    return acc;
  }, {}))
    .map(([diag, set]) => [diag, set.size])
    .sort((a, b) => b[1] - a[1]);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>
            Aperçu général des registres{archiveLabel ? ` — ${archiveLabel}` : ''}.
          </p>
        </div>

        <div className="dashboard-badge">
          ?? Gestion Clinique
        </div>
      </div>

      <div className="cards-grid" style={{ marginBottom: '24px' }}>
        <article className="stat-card" style={{ borderTop: '5px solid #3777cc' }}>
          <div className="stat-top">
            <h3>Total dossiers</h3>
          </div>
          <strong>{totalRecords}</strong>
          <span className="stat-subtitle">Ce mois</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #28a745' }}>
          <div className="stat-top">
            <h3>Montant facturé</h3>
          </div>
          <strong>{totalAmount.toLocaleString()} Ar</strong>
          <span className="stat-subtitle">Total des coûts</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #f59f00' }}>
          <div className="stat-top">
            <h3>Sexe des patients</h3>
          </div>
          <div style={{ display: 'grid', gap: '4px', marginTop: '10px' }}>
            {sexSummary.map(([sex, count]) => (
              <span key={sex} style={{ fontSize: '0.95rem' }}>{sex} : {count}</span>
            ))}
          </div>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #6f42c1' }}>
          <div className="stat-top">
            <h3>Top diagnostics</h3>
          </div>
          <div style={{ display: 'grid', gap: '4px', marginTop: '10px' }}>
            {diagnosticSummary.slice(0, 4).map(([diagnostic, count]) => (
              <span key={diagnostic} style={{ fontSize: '0.95rem' }}>{diagnostic} : {count}</span>
            ))}
            {diagnosticSummary.length === 0 && <span style={{ fontSize: '0.95rem' }}>Aucun diagnostic</span>}
          </div>
        </article>
      </div>

      {ageGroupSummary.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <strong>Patients par tranche d'âge</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            {ageGroupSummary.map(([group, count]) => (
              <span key={group} style={{ padding: '8px 12px', background: '#f4f9fd', border: '1px solid #dceaf2', borderRadius: '10px', color: '#184a6e' }}>
                {group} : {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {archiveDiagnostics.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <strong>Diagnostics par mois</strong>
          <div style={{ display: 'grid', gap: '12px', marginTop: '10px' }}>
            {archiveDiagnostics.map((archive) => (
              <div key={archive.label} style={{ padding: '12px', border: '1px solid #e6e6e6', borderRadius: '10px', background: '#fff' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>{archive.label}</div>
                {archive.topDiagnostics.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {archive.topDiagnostics.map(([diagnostic, count]) => (
                      <span key={diagnostic} style={{ padding: '6px 10px', background: '#f4f9fd', borderRadius: '999px', color: '#184a6e', fontSize: '0.92rem' }}>
                        {diagnostic} : {count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#666' }}>Aucun diagnostic enregistré</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      <div className="cards-grid">
        {categories.map((cat) => (
          <article
            key={cat.key}
            className="stat-card"
            style={{
              borderTop: `5px solid ${cat.color}`
            }}
          >

            <div className="stat-top">
              <h3>{cat.label}</h3>

              <div
                className="stat-dot"
                style={{ background: cat.color }}
              />
            </div>

            <strong>{stats[cat.key] || 0}</strong>

            <span className="stat-subtitle">
              Dossiers enregistrés
            </span>

          </article>
        ))}

        <article className="stat-card" style={{ borderTop: '5px solid #4a90d9' }}>
          <div className="stat-top">
            <h3>Dispensations</h3>
            <div className="stat-dot" style={{ background: '#4a90d9' }} />
          </div>
          <strong>{dispensationCount}</strong>
          <span className="stat-subtitle">
            Total : {Number(dispensationTotal || 0).toLocaleString()} Ar
          </span>
        </article>
      </div>
    </section>
  );
}

