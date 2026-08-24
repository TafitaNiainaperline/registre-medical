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
  return t.map((x) => `${x.name} x${x.quantity}${x.unit ? ` ${x.unit}` : ''} (${x.unit_price} Ar)`).join(' • ');
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

      {msg && (
        <div className="success-msg" style={{ marginBottom: '12px' }}>
          {msg}
        </div>
      )}

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

      <div className="search-bar" style={{ marginTop: '12px' }}>
        <input
          placeholder="Rechercher un patient (nom/prénom)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadRows(selected); }}
        />

        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>

        <button className="btn-light" onClick={() => loadRows(selected)} disabled={loading}>
          {loading ? 'Chargement...' : 'Rechercher'}
        </button>

        <button onClick={exportExcel} disabled={!selected?.year || !selected?.month}>
          Exporter en Excel
        </button>

        {!isAdmin && (
          <span style={{ color: '#5f7b84', fontSize: '0.9rem' }}>
            (export disponible pour tous)
          </span>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° registre</th>
              <th>Patient</th>
              <th>Sexe</th>
              <th>Âge</th>
              <th>Diagnostic</th>
              <th>Traitements</th>
              <th>Coût</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: '#5f7b84', padding: '24px' }}>
                  {loading ? 'Chargement...' : 'Aucune donnée.'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ color: '#5f7b84', fontWeight: 700 }}>{displayRegistryNumber(r.registry_number)}</td>
                <td><strong>{r.patient_nom}</strong> {r.patient_prenom}</td>
                <td>{r.sexe || '-'}</td>
                <td>{String(r.age || '').includes('|') ? String(r.age).split('|')[0] : r.age}</td>
                <td>{r.diagnostic}</td>
                <td style={{ color: '#244955' }}>{renderTreatments(r)}</td>
<td><strong>{r.cost} Ar</strong></td>
                 <td style={{ fontSize: '0.85rem', color: '#5f7b84' }}>
                   {r.created_at ? formatMadagascarDateTime(r.created_at).slice(0, 10) : '-'}
                 </td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
