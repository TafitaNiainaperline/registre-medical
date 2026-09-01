import { useEffect, useState } from 'react';
import { categories } from '../constants';
import { FolderOpen, DollarSign, Landmark, Users, Microscope, Bug, Stethoscope, Baby, Pill, Heart, Calendar, Activity } from 'lucide-react';

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
  const [cashOutflowTotal, setCashOutflowTotal] = useState(0);
  const [actFilter, setActFilter] = useState('');
  const [pfFilter, setPfFilter] = useState('');
  const [cpnFilter, setCpnFilter] = useState('');

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

        const outflowTotal = await window.api.getCashOutflowTotal?.({ year: current?.year, month: current?.month });
        setCashOutflowTotal(Number(outflowTotal || 0));

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
        setCashOutflowTotal(0);
      }
    };
    load();
  }, []);

  const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const totalAmount = records.reduce((sum, row) => sum + sumNumber(row.cost), 0) + (Number(dispensationTotal) || 0);
  const soldeCaisse = totalAmount - cashOutflowTotal;

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

  const pfSummary = Object.entries(records.reduce((acc, row) => {
    if (row.category === 'pf') {
      const method = String(row.pf_method || '').trim();
      if (!method) return acc;
      if (!acc[method]) acc[method] = new Set();
      acc[method].add(getPatientId(row));
    }
    return acc;
  }, {}))
    .map(([method, patients]) => [method, patients.size])
    .sort((a, b) => b[1] - a[1]);

  const cpnSummary = Object.entries(records.reduce((acc, row) => {
    if (row.category === 'cpn') {
      const cpn = String(row.cpn_type || '').trim();
      if (!cpn) return acc;
      if (!acc[cpn]) acc[cpn] = new Set();
      acc[cpn].add(getPatientId(row));
    }
    return acc;
  }, {}))
    .map(([cpn, patients]) => [cpn, patients.size])
    .sort((a, b) => b[1] - a[1]);

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
          📊 Gestion Clinique
        </div>
      </div>

      <div className="cards-grid" style={{ marginBottom: '28px' }}>
        <article className="stat-card" style={{ borderTop: '5px solid #3777cc' }}>
          <div className="stat-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderOpen size={24} color="#3777cc" />
              <h3>Total dossiers</h3>
            </div>
            <strong style={{ fontSize: '1.8rem', color: '#3777cc' }}>{totalRecords}</strong>
          </div>
          <span className="stat-subtitle">Ce mois</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #28a745' }}>
          <div className="stat-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <DollarSign size={24} color="#28a745" />
              <h3>Montant facturé</h3>
            </div>
            <strong style={{ fontSize: '1.8rem', color: '#28a745' }}>{totalAmount.toLocaleString()} Ar</strong>
          </div>
          <span className="stat-subtitle">Total des coûts</span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #dc3545' }}>
          <div className="stat-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Landmark size={24} color="#dc3545" />
              <h3>Solde de caisse</h3>
            </div>
            <strong style={{ fontSize: '1.8rem', color: '#dc3545' }}>{soldeCaisse.toLocaleString()} Ar</strong>
          </div>
          <span className="stat-subtitle" style={{ fontSize: '0.8rem' }}>
            Entrées : {totalAmount.toLocaleString()} Ar | Sorties : {cashOutflowTotal.toLocaleString()} Ar
          </span>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #f59f00' }}>
          <div className="stat-top" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={24} color="#f59f00" />
            <h3>Sexe des patients</h3>
          </div>
          <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
            {sexSummary.map(([sex, count]) => (
              <span key={sex} style={{ fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{sex}</span>
                <strong style={{ background: '#f59f00', color: '#fff', padding: '2px 10px', borderRadius: '999px', fontSize: '0.85rem' }}>{count}</strong>
              </span>
            ))}
          </div>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #6f42c1' }}>
          <div className="stat-top" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Microscope size={24} color="#6f42c1" />
            <h3>Top diagnostics</h3>
          </div>
          <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
            {diagnosticSummary.slice(0, 4).map(([diagnostic, count]) => (
              <span key={diagnostic} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{diagnostic}</span>
                <strong style={{ background: '#6f42c1', color: '#fff', padding: '2px 10px', borderRadius: '999px', fontSize: '0.85rem' }}>{count}</strong>
              </span>
            ))}
            {diagnosticSummary.length === 0 && <span style={{ fontSize: '0.9rem', color: '#888' }}>Aucun diagnostic</span>}
          </div>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #d81b83' }}>
          <div className="stat-top" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bug size={24} color="#d81b83" />
            <h3>TDR Paludisme</h3>
          </div>
          <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
            <span style={{ fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#28a745' }}>Positif</span>
              <strong style={{ background: '#28a745', color: '#fff', padding: '2px 10px', borderRadius: '999px', fontSize: '0.85rem' }}>{tdrSummary.positif || 0}</strong>
            </span>
            <span style={{ fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#dc3545' }}>Négatif</span>
              <strong style={{ background: '#dc3545', color: '#fff', padding: '2px 10px', borderRadius: '999px', fontSize: '0.85rem' }}>{tdrSummary.negatif || 0}</strong>
            </span>
          </div>
        </article>
      </div>

      <div className="cards-grid" style={{ marginBottom: '28px' }}>
        <article className="stat-card" style={{ borderTop: '5px solid #8f60d0' }}>
          <div className="stat-top" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Stethoscope size={24} color="#8f60d0" />
            <h3>Actes médicaux</h3>
          </div>
          <input
            type="text"
            placeholder="Filtrer les actes..."
            value={actFilter}
            onChange={(e) => setActFilter(e.target.value)}
            style={{
              width: '100%',
              marginTop: '12px',
              marginBottom: '8px',
              padding: '10px 14px',
              border: '1px solid #c8d9df',
              borderRadius: '8px',
              font: 'inherit',
              fontSize: '0.85rem'
            }}
          />
          <div style={{ display: 'grid', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
            {actFilter && actSummary
              .filter((act) => String(act.name).toLowerCase().includes(actFilter.toLowerCase()))
              .length > 0 ? (
                actSummary
                  .filter((act) => String(act.name).toLowerCase().includes(actFilter.toLowerCase()))
                  .map((act) => (
                    <span key={act.name} style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.name}</span>
                      <strong style={{ whiteSpace: 'nowrap', background: '#8f60d0', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem' }}>{act.count}x - {act.total.toLocaleString()}Ar</strong>
                    </span>
                  ))
              ) : actFilter ? (
                <span style={{ fontSize: '0.8rem', color: '#888' }}>Aucun résultat</span>
              ) : null}
          </div>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #28a745' }}>
          <div className="stat-top">
            <Heart size={24} color="#28a745" />
            <h3>Produits PF</h3>
          </div>
          <input
            type="text"
            placeholder="Filtrer les produits..."
            value={pfFilter}
            onChange={(e) => setPfFilter(e.target.value)}
            style={{
              width: '100%',
              marginTop: '12px',
              marginBottom: '8px',
              padding: '10px 14px',
              border: '1px solid #c8d9df',
              borderRadius: '8px',
              font: 'inherit',
              fontSize: '0.85rem'
            }}
          />
          <div style={{ display: 'grid', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
            {pfFilter && pfSummary
              .filter(([method]) => String(method).toLowerCase().includes(pfFilter.toLowerCase()))
              .length > 0 ? (
                pfSummary
                  .filter(([method]) => String(method).toLowerCase().includes(pfFilter.toLowerCase()))
                  .map(([method, count]) => (
                    <span key={method} style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{method}</span>
                      <strong style={{ whiteSpace: 'nowrap', background: '#28a745', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem' }}>{count}</strong>
                    </span>
                  ))
              ) : pfFilter ? (
                <span style={{ fontSize: '0.8rem', color: '#888' }}>Aucun résultat</span>
              ) : null}
          </div>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #d81b83' }}>
          <div className="stat-top">
            <Baby size={24} color="#d81b83" />
            <h3>CPN</h3>
          </div>
          <input
            type="text"
            placeholder="Filtrer les CPN..."
            value={cpnFilter}
            onChange={(e) => setCpnFilter(e.target.value)}
            style={{
              width: '100%',
              marginTop: '12px',
              marginBottom: '8px',
              padding: '10px 14px',
              border: '1px solid #c8d9df',
              borderRadius: '8px',
              font: 'inherit',
              fontSize: '0.85rem'
            }}
          />
          <div style={{ display: 'grid', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
            {cpnFilter && cpnSummary
              .filter(([cpn]) => String(cpn).toLowerCase().includes(cpnFilter.toLowerCase()))
              .length > 0 ? (
                cpnSummary
                  .filter(([cpn]) => String(cpn).toLowerCase().includes(cpnFilter.toLowerCase()))
                  .map(([cpn, count]) => (
                    <span key={cpn} style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cpn}</span>
                      <strong style={{ whiteSpace: 'nowrap', background: '#d81b83', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem' }}>{count}</strong>
                    </span>
                  ))
              ) : cpnFilter ? (
                <span style={{ fontSize: '0.8rem', color: '#888' }}>Aucun résultat</span>
              ) : null}
          </div>
        </article>

        <article className="stat-card" style={{ borderTop: '5px solid #4a90d9' }}>
          <div className="stat-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Pill size={24} color="#4a90d9" />
              <h3>Dispensations</h3>
            </div>
            <strong style={{ fontSize: '1.8rem', color: '#4a90d9' }}>{dispensationCount}</strong>
          </div>
          <span className="stat-subtitle">
            Total : {Number(dispensationTotal || 0).toLocaleString()} Ar
          </span>
        </article>
      </div>

      {ageGroupSummary.length > 0 && (
        <div style={{ marginBottom: '28px', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '1rem' }}><Users size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Patients par tranche d'âge</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {ageGroupSummary.map(([group, count]) => (
              <span key={group} style={{ padding: '10px 16px', background: '#f4f9fd', border: '1px solid #dceaf2', borderRadius: '10px', color: '#184a6e', fontWeight: 500 }}>
                {group} <strong style={{ color: '#3777cc' }}>({count})</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {archiveDiagnostics.length > 0 && (
        <div style={{ marginBottom: '28px', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '1rem' }}><Calendar size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Diagnostics par mois</h3>
          <div style={{ display: 'grid', gap: '14px' }}>
            {archiveDiagnostics.map((archive) => (
              <div key={archive.label} style={{ padding: '16px', border: '1px solid #e6e6e6', borderRadius: '10px', background: '#fafafa' }}>
                <div style={{ fontWeight: 600, marginBottom: '10px', color: '#333' }}>{archive.label}</div>
                {archive.topDiagnostics.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {archive.topDiagnostics.map(([diagnostic, count]) => (
                      <span key={diagnostic} style={{ padding: '6px 12px', background: '#e8f4f6', borderRadius: '999px', color: '#1C96A4', fontSize: '0.9rem', fontWeight: 500 }}>
                        {diagnostic} ({count})
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#888', fontSize: '0.9rem' }}>Aucun diagnostic enregistré</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '28px', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '1rem' }}><Activity size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Diagnostics par registre</h3>
        <div className="cards-grid" style={{ marginTop: '10px' }}>
          {diagnosticsByCategory.map((category) => (
            <article key={category.key} className="stat-card" style={{ borderTop: `4px solid ${category.color}` }}>
              <h4 style={{ marginBottom: '8px' }}>{category.label}</h4>
              <div style={{ display: 'grid', gap: '4px', marginTop: '10px', maxHeight: '120px', overflowY: 'auto' }}>
                {category.diagnostics.length > 0
                  ? category.diagnostics.map(([diagnostic, count]) => (
                    <span key={diagnostic} style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{diagnostic}</span>
                      <strong style={{ whiteSpace: 'nowrap', background: category.color, color: '#fff', padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem' }}>{count}</strong>
                    </span>
                  ))
                  : <span style={{ color: '#888', fontSize: '0.8rem' }}>Aucun diagnostic</span>}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '1rem' }}><FolderOpen size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Registres</h3>
        <div className="cards-grid" style={{ marginTop: '10px' }}>
          {categories.map((cat) => (
            <article
              key={cat.key}
              className="stat-card"
              style={{
                borderTop: `5px solid ${cat.color}`,
                textAlign: 'center'
              }}
            >
              <div style={{ marginBottom: '8px', color: cat.color }}>
                {cat.key === 'consultation' && <Stethoscope size={28} />}
                {cat.key === 'cpn' && <Baby size={28} />}
                {cat.key === 'pf' && <Heart size={28} />}
                {cat.key === 'analyse' && <Microscope size={28} />}
                {cat.key === 'soin' && <Pill size={28} />}
              </div>
              <h4 style={{ marginBottom: '8px' }}>{cat.label}</h4>
              <strong style={{ fontSize: '1.5rem', display: 'block' }}>{stats[cat.key] || 0}</strong>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>dossiers</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

