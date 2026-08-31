import { useEffect, useState } from 'react';
import { categories } from '../constants';

function parseAgeToMonths(stored) {
  const value = String(stored || '');
  if (!value) return null;

  if (!value.includes('|')) {
    const [amount, unit] = value.split(' ');
    const num = Number(amount);
    if (Number.isNaN(num)) return null;
    if (unit === 'ans') return num * 12;
    if (unit === 'mois') return num;
    if (unit === 'jours') return num / 30;
    return null;
  }

  const parts = value.split('|');
  const num = Number(parts[0]);
  if (Number.isNaN(num)) return null;

  if (parts[1] === 'mois_jours') {
    const days = parts[2] ? Number(parts[2]) : 0;
    return num + days / 30;
  }

  if (parts[1] === 'ans') return num * 12;
  if (parts[1] === 'mois') return num;
  if (parts[1] === 'jours') return num / 30;

  return null;
}

function getAgeGroup(stored) {
  const months = parseAgeToMonths(stored);
  if (months === null) return 'Non renseigné';

  if (months <= 0.93) return '0-28j';
  if (months <= 11) return '29j-11mois';
  if (months <= 48) return '1-4 ans';
  if (months <= 168) return '5-14 ans';
  if (months <= 204) return '15-17 ans';
  if (months <= 288) return '18-24 ans';
  if (months <= 708) return '25-59 ans';
  return '60 ans et plus';
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
  const [actFilter, setActFilter] = useState('');

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

  const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const totalAmount = records.reduce((sum, row) => sum + sumNumber(row.cost), 0) + (Number(dispensationTotal) || 0);

  const sexSummary = Object.entries(records.reduce((acc, row) => {
    const sex = String(row.sexe || '').trim().toUpperCase() || 'Non renseigné';
    if (!acc[sex]) acc[sex] = new Set();
    acc[sex].add(getPatientId(row));
    return acc;
  }, {})).map(([sex, set]) => [sex, set.size]);

  const ageGroupSummary = Object.entries(records.reduce((acc, row) => {
    const group = getAgeGroup(row.age);
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

  const tdrSummary = records
    .filter((row) => row.category === 'consultation' && row.tdr_result)
    .reduce((summary, row) => {
      const result = row.tdr_result.toLowerCase();
      summary[result] = (summary[result] || 0) + 1;
      return summary;
    }, {});

  const actSummary = Object.entries(records.reduce((acc, row) => {
    const treatments = Array.isArray(row.treatments) ? row.treatments : [];
    treatments.forEach((t) => {
      if (t.item_type === 'act') {
        const name = String(t.name || '').trim();
        if (!name) return;
        if (!acc[name]) acc[name] = { count: 0, total: 0 };
        acc[name].count += 1;
        acc[name].total += (Number(t.unit_price) || 0) * (Number(t.quantity) || 1);
      }
    });
    return acc;
  }, {}))
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  const diagnosticsByCategory = categories.map((category) => {
    const diagnostics = Object.entries(records
      .filter((row) => row.category === category.key)
      .reduce((acc, row) => {
        const diagnostic = String(row.diagnostic || '').trim();
        if (!diagnostic) return acc;
        if (!acc[diagnostic]) acc[diagnostic] = new Set();
        acc[diagnostic].add(getPatientId(row));
        return acc;
      }, {}))
      .map(([diagnostic, patients]) => [diagnostic, patients.size])
      .sort((a, b) => b[1] - a[1]);
    return { ...category, diagnostics };
  });

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
           Gestion Clinique
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

        <article className="stat-card" style={{ borderTop: '5px solid #d81b83' }}>
          <div className="stat-top"><h3>TDR Paludisme</h3></div>
          <div style={{ display: 'grid', gap: '4px', marginTop: '10px' }}>
            <span>Positif : {tdrSummary.positif || 0}</span>
            <span>Négatif : {tdrSummary.negatif || 0}</span>
          </div>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #8f60d0' }}>
          <div className="stat-top">
            <h3>Actes médicaux</h3>
          </div>
          <input
            type="text"
            placeholder="Filtrer les actes..."
            value={actFilter}
            onChange={(e) => setActFilter(e.target.value)}
            style={{
              width: '100%',
              marginTop: '8px',
              marginBottom: '8px',
              padding: '6px 10px',
              border: '1px solid #c8d9df',
              borderRadius: '8px',
              font: 'inherit',
              fontSize: '0.85rem'
            }}
          />
          <div style={{ display: 'grid', gap: '4px' }}>
            {actSummary.length === 0 && (
              <span style={{ fontSize: '0.92rem', color: '#888' }}>Aucun acte médical enregistré</span>
            )}
            {actSummary
              .filter((act) => !actFilter || String(act.name).toLowerCase().includes(actFilter.toLowerCase()))
              .slice(actFilter ? undefined : 0, actFilter ? undefined : 5)
              .map((act) => (
                <span key={act.name} style={{ fontSize: '0.92rem' }}>
                  <strong>{act.name}</strong> : {act.count} fois — {act.total.toLocaleString()} Ar
                </span>
              ))}
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

      <div style={{ marginBottom: '24px' }}>
        <strong>Diagnostics par registre</strong>
        <div className="cards-grid" style={{ marginTop: '10px' }}>
          {diagnosticsByCategory.map((category) => (
            <article key={category.key} className="stat-card" style={{ borderTop: `4px solid ${category.color}` }}>
              <h3>{category.label}</h3>
              <div style={{ display: 'grid', gap: '4px', marginTop: '10px' }}>
                {category.diagnostics.length > 0
                  ? category.diagnostics.map(([diagnostic, count]) => (
                    <span key={diagnostic} style={{ fontSize: '0.92rem' }}>{diagnostic} : {count}</span>
                  ))
                  : <span style={{ color: '#68818a', fontSize: '0.92rem' }}>Aucun diagnostic</span>}
              </div>
            </article>
          ))}
        </div>
      </div>


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

