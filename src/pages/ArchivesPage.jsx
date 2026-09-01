import { useEffect, useMemo, useState } from 'react';
import { categories } from '../constants';

function formatArchiveKey(a) {
  if (!a) return '';
  return `${a.year}-${String(a.month).padStart(2, '0')}`;
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function renderTreatments(row) {
  const t = Array.isArray(row.treatments) ? row.treatments : null;
  if (!t || t.length === 0) return row.traitement || '-';
  return t.map((x) => x.item_type === 'act' ? x.name : `${x.name} x${x.quantity}${x.unit ? ` ${x.unit}` : ''} (${x.unit_price} Ar)`).join(' • ');
}

function formatMadagascarDateTime(utcString) {
  if (!utcString) return '-';
  const d = new Date(utcString);
  const offset = 3 * 60;
  const local = new Date(d.getTime() + offset * 60 * 1000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  const h = String(local.getHours()).padStart(2, '0');
  const min = String(local.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function displayRegistryNumber(value) {
  const match = String(value || '').match(/(\d+)$/);
  if (!match) return value || '-';
  const number = Number(match[1]) || 0;
  return String(number).padStart(3, '0');
}

export default function ArchivesPage() {
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const isAdmin = currentUser.role === 'admin';

  const [archives, setArchives] = useState([]);
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadArchives = async () => {
    const list = await window.api.listArchives();
    setArchives(list || []);

    if (!selected) {
      const current = await window.api.getCurrentArchive().catch(() => null);
      const currentKey = formatArchiveKey(current);
      const found = (list || []).find((a) => formatArchiveKey(a) === currentKey);
      setSelected(found || (list || [])[0] || current);
    }
  };

  const loadRows = async (opts) => {
    if (!opts?.year || !opts?.month) { setRows([]); return; }
    setLoading(true);
    setMsg('');
    try {
      const data = await window.api.fetchRecordsByArchive({
        year: opts.year,
        month: opts.month,
        category: category || undefined,
      });
      const query = normalizeSearch(search);
      setRows((data || []).filter((row) => !query || [
        row.patient_nom,
        row.patient_prenom,
        row.diagnostic,
        row.registry_number,
      ].some((value) => normalizeSearch(value).includes(query))));
    } catch (e) {
      setRows([]);
      setMsg(e.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArchives(); }, []);
  useEffect(() => { loadRows(selected); }, [selected, category, search]);

  const exportExcel = async () => {
    if (!selected?.year || !selected?.month) return;
    try {
      const result = await window.api.exportExcelByArchive({
        year: selected.year,
        month: selected.month,
        category: category || undefined,
      });
      if (result?.canceled) return;
      setMsg(`Export réussi : ${result.filePath}`);
      setTimeout(() => setMsg(''), 3500);
    } catch (e) {
      setMsg(e.message || 'Export impossible.');
    }
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Histoire des registres</h1>
          <p>Consultez les archives mensuelles, recherchez un patient et exportez en Excel.</p>
        </div>
        <div className="dashboard-badge">🗂 Archives</div>
      </div>

      <div className="archive-grid">
        {(archives || []).map((a) => {
          const active = selected && formatArchiveKey(a) === formatArchiveKey(selected);
          return (
            <button
              key={formatArchiveKey(a)}
              type="button"
              className={active ? 'archive-chip active' : 'archive-chip'}
              onClick={() => setSelected(a)}
            >
              {a.label} <span style={{ opacity: 0.75 }}>({a.count})</span>
            </button>
          );
        })}
        {archives.length === 0 && (
          <div style={{ color: '#5f7b84' }}>Aucune archive disponible.</div>
        )}
      </div>

      <div className="search-bar" style={{ marginTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <input
          placeholder="Rechercher un patient (nom/prénom)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadRows(selected); }}
          style={{ flex: '1', minWidth: '200px' }}
        />

        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ minWidth: '150px' }}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        <button className="btn-light" onClick={() => loadRows(selected)} disabled={loading} style={{ minWidth: '120px' }}>
          {loading ? 'Chargement...' : '🔍 Rechercher'}
        </button>

        <button
          onClick={exportExcel}
          disabled={!selected?.year || !selected?.month || loading}
          style={{
            padding: '8px 16px',
            background: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: selected?.year && selected?.month && !loading ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: selected?.year && selected?.month && !loading ? 1 : 0.6,
            minWidth: '140px'
          }}
        >
          📊 Exporter Excel
        </button>
      </div>

      {msg && (
        <div style={{
          marginTop: '12px',
          padding: '10px 16px',
          background: msg.includes('réussi') ? '#e8f5e9' : '#fdecea',
          color: msg.includes('réussi') ? '#2e7d32' : '#dc3545',
          borderRadius: '6px',
          fontSize: '0.9rem'
        }}>
          {msg}
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: '20px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#1C96A4' }}>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>N°</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Patient</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Sexe</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Âge</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Diagnostic</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Traitements</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'right' }}>Coût</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: '#5f7b84', padding: '40px', background: '#f8fafa' }}>
                  {loading ? 'Chargement...' : 'Aucune donnée trouvée.'}
                </td>
              </tr>
            )}
            {rows.map((r, index) => (
              <tr key={r.id} style={{ background: index % 2 === 0 ? '#fff' : '#f8fafa', borderBottom: '1px solid #e6eff2' }}>
                <td style={{ padding: '12px', fontWeight: 700, color: '#1C96A4', textAlign: 'center' }}>{displayRegistryNumber(r.registry_number)}</td>
                <td style={{ padding: '12px' }}>
                  <strong>{r.patient_nom}</strong> {r.patient_prenom}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>{r.sexe || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>{String(r.age || '').includes('|') ? String(r.age).split('|')[0] : r.age}</td>
                <td style={{ padding: '12px' }}>{r.diagnostic}</td>
                <td style={{ padding: '12px', color: '#244955', fontSize: '0.85rem' }}>{renderTreatments(r)}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#28a745' }}>{r.cost} Ar</td>
                <td style={{ padding: '12px', fontSize: '0.85rem', color: '#5f7b84', textAlign: 'center' }}>
                  {r.created_at ? formatMadagascarDateTime(r.created_at).slice(0, 10) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div style={{ padding: '14px 16px', background: '#1C96A4', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem' }}>{rows.length} enregistrement{rows.length > 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Total : {rows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0).toLocaleString()} Ar
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
