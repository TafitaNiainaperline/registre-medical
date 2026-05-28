import { useEffect, useState } from 'react';
import TreatmentSelector from '../components/TreatmentSelector';
import MonthlyArchiveBanner from '../components/MonthlyArchiveBanner';

const emptyForm = {
  patient_nom: '',
  patient_prenom: '',
  sexe: '',
  age: '',
  age_type: 'ans',
  age_mois: '',
  age_jours: '',
  domicile: '',
  diagnostic: '',
  traitement: '',
  observation: '',
  cost: '',
  treatments: [],
};

function formatAge(age, age_type, age_mois, age_jours) {
  if (age_type === 'ans')        return `${age}|ans||`;
  if (age_type === 'mois')       return `${age}|mois||`;
  if (age_type === 'mois_jours') return `${age_mois || 0}|mois_jours|${age_jours || 0}||`;
  if (age_type === 'jours')      return `${age_jours || 0}|jours||`;
  return '';
}

function parseStoredAge(stored) {
  const value = String(stored || '');
  if (!value) return { age: '', age_type: 'ans', age_mois: '', age_jours: '' };
  if (!value.includes('|')) {
    const sp = value.split(' ');
    return { age: sp[0] || '', age_type: sp[1] === 'mois' ? 'mois' : 'ans', age_mois: '', age_jours: '' };
  }
  const [v, type, j] = value.split('|');
  if (type === 'mois_jours') return { age: '', age_type: 'mois_jours', age_mois: v, age_jours: j };
  if (type === 'jours')      return { age: '', age_type: 'jours', age_mois: '', age_jours: v };
  return { age: v, age_type: type || 'ans', age_mois: '', age_jours: '' };
}

function displayAge(stored) {
  const value = String(stored || '');
  if (!value) return '-';
  if (!value.includes('|')) return value;
  const [v, type, j] = value.split('|');
  if (type === 'ans')        return `${v} ${Number(v) > 1 ? 'ans' : 'an'}`;
  if (type === 'mois')       return `${v} mois`;
  if (type === 'mois_jours') return `${v} mois ${j} jour${Number(j) > 1 ? 's' : ''}`;
  if (type === 'jours')      return `${v} jour${Number(v) > 1 ? 's' : ''}`;
  return value;
}

function ageBadgeClass(stored) {
  const value = String(stored || '');
  if (value.includes('jours')) return 'jours';
  if (value.includes('mois'))  return 'mois';
  return 'ans';
}

function displayRegistryNumber(value) {
  const match = String(value || '').match(/(\d+)$/);
  return match ? match[1] : (value || '-');
}

function normalizeMedicationName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findMedicationByText(text, medications) {
  const wanted = normalizeMedicationName(text);
  const candidates = (Array.isArray(medications) ? medications : [])
    .map((med) => ({ med, normalized: normalizeMedicationName(med.name) }))
    .filter(({ normalized }) => normalized);

  const exact = candidates.find(({ normalized }) => normalized === wanted);
  if (exact) return exact.med;

  const prefixMatches = candidates
    .filter(({ normalized }) => wanted.startsWith(`${normalized} `))
    .sort((a, b) => b.normalized.length - a.normalized.length);

  return prefixMatches[0]?.med || null;
}

function parseTreatmentPart(part, medications) {
  const text = String(part || '').trim();
  const med = findMedicationByText(text, medications);
  if (!text || !med) return { med: null, quantity: 1, unitOk: true };

  const normalizedText = normalizeMedicationName(text);
  const normalizedName = normalizeMedicationName(med.name);
  let rest = normalizedText.slice(normalizedName.length).trim();
  let quantity = 1;

  if (rest) {
    const qtyMatch = rest.match(/^(?:x\s*)?(\d+)\s*(.*)$/i);
    if (qtyMatch) {
      quantity = Number(qtyMatch[1]) || 1;
      rest = String(qtyMatch[2] || '').trim();
    } else if (rest.startsWith('x')) {
      const afterX = rest.slice(1).trim();
      const xMatch = afterX.match(/^(\d+)\s*(.*)$/);
      if (xMatch) {
        quantity = Number(xMatch[1]) || 1;
        rest = String(xMatch[2] || '').trim();
      }
    }
  }

  const expectedUnit = normalizeMedicationName(med.unit || '');
  const writtenUnit = normalizeMedicationName(rest).replace(/s$/, '');
  const expectedUnitSingular = expectedUnit.replace(/s$/, '');
  const unitOk = !writtenUnit || !expectedUnit || writtenUnit === expectedUnitSingular;

  return { med, quantity, unitOk, writtenUnit: rest };
}

function buildTreatmentsFromText(text, medications) {
  const parts = String(text || '')
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return [];

  const byMedicationId = new Map();
  const unknown = [];
  const wrongUnits = [];

  parts.forEach((part) => {
    const parsed = parseTreatmentPart(part, medications);
    const med = parsed.med;
    if (!med) {
      unknown.push(part);
      return;
    }
    if (!parsed.unitOk) {
      wrongUnits.push(`${med.name} (${med.unit || 'unité'})`);
      return;
    }

    const id = String(med.id);
    const current = byMedicationId.get(id);
    const quantity = Math.max(1, Number(parsed.quantity) || 1);
    if (current) {
      current.quantity += quantity;
    } else {
      byMedicationId.set(id, {
        medication_id: med.id,
        name: med.name,
        unit: med.unit || 'unité',
        unit_price: Number(med.price) || 0,
        quantity,
      });
    }
  });

  if (unknown.length) {
    throw new Error(`Médicament non disponible dans le stock : ${unknown.join(', ')}. Écrivez le nom enregistré, par exemple : Cerum x2 sachet.`);
  }

  if (wrongUnits.length) {
    throw new Error(`Unité incorrecte. Utilisez l'unité enregistrée : ${wrongUnits.join(', ')}.`);
  }

  const treatments = Array.from(byMedicationId.values());
  const stockError = treatments.find((t) => {
    const med = (medications || []).find((m) => String(m.id) === String(t.medication_id));
    return med && med.stock !== null && med.stock !== undefined && Number(t.quantity) > Number(med.stock);
  });

  if (stockError) {
    const med = (medications || []).find((m) => String(m.id) === String(stockError.medication_id));
    throw new Error(`Stock insuffisant pour "${stockError.name}". Disponible : ${med?.stock ?? 0}. Demandé : ${stockError.quantity}.`);
  }

  return treatments;
}

function previewTreatmentsTotal(text, selectedTreatments, medications) {
  const selected = Array.isArray(selectedTreatments) ? selectedTreatments : [];
  try {
    const treatments = selected.length ? selected : buildTreatmentsFromText(text, medications);
    return treatments.reduce((sum, t) => sum + (Number(t.unit_price) * Number(t.quantity)), 0);
  } catch {
    return 0;
  }
}

export default function RecordsPage({ category }) {
  const [records, setRecords]     = useState([]);
  const [form, setForm]           = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch]       = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [medications, setMedications] = useState([]);
  const [archives, setArchives] = useState([]);
  const [activeArchive, setActiveArchive] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');

  // ── Rôle de l'utilisateur connecté ──────────────────
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  const load = (archive = activeArchive) => {
    const hasArchive = archive?.year && archive?.month;
    const fetcher = hasArchive
      ? window.api.fetchRecordsByArchive({ category: category.key, year: archive.year, month: archive.month })
      : window.api.fetchRecords(category.key);

    return fetcher
      .then(result => setRecords(result || []))
      .catch((err) => {
        console.error('fetchRecords failed:', err);
        setRecords([]);
      });
  };

  useEffect(() => {
    window.api.listMedications()
      .then((r) => setMedications(r || []))
      .catch((err) => {
        console.error('listMedications failed:', err);
        setMedications([]);
      });

    window.api.listArchives()
      .then((r) => setArchives(r || []))
      .catch((err) => {
        console.error('listArchives failed:', err);
        setArchives([]);
      });

    window.api.getCurrentArchive()
      .then((a) => { setActiveArchive(a); return load(a); })
      .catch((err) => {
        console.error('getCurrentArchive failed:', err);
        return load(null);
      });

    setForm(emptyForm);
    setEditingId(null);
    setSearch('');
    setAgeFilter('');
    setDateFilter('');
    setActionError('');
    setActionOk('');
  }, [category.key]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionOk('');
    const storedAge = formatAge(form.age, form.age_type, form.age_mois, form.age_jours);
    let treatments = Array.isArray(form.treatments) ? form.treatments : [];
    try {
      if (!treatments.length && String(form.traitement || '').trim()) {
        treatments = buildTreatmentsFromText(form.traitement, medications);
      }
    } catch (err) {
      setActionError(err?.message || 'Traitement invalide.');
      return;
    }
    const computedCost = treatments.reduce((sum, t) => sum + (Number(t.unit_price) * Number(t.quantity)), 0);
    const payload = {
      patient_nom:    form.patient_nom,
      patient_prenom: form.patient_prenom,
      sexe:           form.sexe,
      age:            storedAge,
      age_type:       form.age_type,
      domicile:       form.domicile,
      diagnostic:     form.diagnostic,
      traitement:     form.traitement,
      treatments,
      observation:    form.observation,
      cost:           computedCost,
    };
    try {
      if (editingId) {
        await window.api.updateRecord(editingId, payload);
        setActionOk('Dossier modifié.');
      } else {
        await window.api.createRecord({
          category: category.key,
          archive_year: activeArchive?.year,
          archive_month: activeArchive?.month,
          ...payload
        });
        setActionOk('Dossier ajouté.');
      }

      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      console.error('submit failed:', err);
      setActionError(err?.message || 'Erreur lors de l’enregistrement.');
    }
  };

  const edit = (row) => {
    setEditingId(row.id);
    const parsed = parseStoredAge(row.age);
    const treatments = Array.isArray(row.treatments) ? row.treatments : [];
    setForm({
      patient_nom:    row.patient_nom    || '',
      patient_prenom: row.patient_prenom || '',
      sexe:           row.sexe || '',
      age:            parsed.age,
      age_type:       parsed.age_type,
      age_mois:       parsed.age_mois,
      age_jours:      parsed.age_jours,
      domicile:       row.domicile    || '',
      diagnostic:     row.diagnostic  || '',
      traitement:     row.traitement  || '',
      observation:    row.observation || '',
      cost:           row.cost        || '',
      treatments,
    });
  };

  const downloadReceipt = async (row) => {
    setActionError('');
    setActionOk('');
    try {
      const result = await window.api.exportReceiptPdf(row.id);
      if (result?.canceled) return;
      setActionOk(`Reçu téléchargé : ${result.filePath}`);
    } catch (err) {
      console.error('exportReceiptPdf failed:', err);
      setActionError(err?.message || 'Impossible de générer le reçu.');
    }
  };

  const filteredRecords = records.filter((row) => {
    const fullName    = `${row.patient_nom || ''} ${row.patient_prenom || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase());
    const matchesAge    = !ageFilter || displayAge(row.age).toLowerCase().includes(ageFilter.toLowerCase());
    const matchesDate   = !dateFilter || (row.created_at && row.created_at.slice(0, 10) === dateFilter);
    return matchesSearch && matchesAge && matchesDate;
  });

  const liveTotal = (Array.isArray(form.treatments) ? form.treatments : [])
    .reduce((sum, t) => sum + (Number(t.unit_price) * Number(t.quantity)), 0);
  const treatmentTotal = liveTotal || previewTreatmentsTotal(form.traitement, form.treatments, medications);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Registre {category.label}</h1>
          <p>Gestion complète des dossiers médicaux et des informations des patients.</p>
        </div>
        <div className="dashboard-badge" style={{ background: category.color }}>
          📁 {category.label}
        </div>
      </div>

      <MonthlyArchiveBanner
        current={activeArchive}
        archives={archives}
        onChange={(a) => { setActiveArchive(a); load(a); }}
      />

      {actionError && (
        <p className="error-msg" style={{ marginBottom: '12px' }}>
          ⚠ {actionError}
        </p>
      )}
      {actionOk && (
        <p className="success-msg" style={{ marginBottom: '12px' }}>
          ✓ {actionOk}
        </p>
      )}

      {/* BARRE RECHERCHE */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Recherche par nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="text"
          placeholder="Filtrer par âge"
          value={ageFilter}
          onChange={(e) => setAgeFilter(e.target.value)}
          style={{ maxWidth: '200px' }}
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        {(search || ageFilter || dateFilter) && (
          <button type="button" className="btn-light"
            onClick={() => { setSearch(''); setAgeFilter(''); setDateFilter(''); }}>
            ✕ Effacer
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: '#5f7b84', fontSize: '0.9rem' }}>
          {filteredRecords.length} résultat{filteredRecords.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* FORMULAIRE */}
      <form className="record-form" onSubmit={submit} style={{ borderColor: category.color }}>
        <input name="patient_nom" placeholder="Nom" value={form.patient_nom} onChange={onChange} required />
        <input name="patient_prenom" placeholder="Prénom" value={form.patient_prenom} onChange={onChange} required />

        {/* CHAMP ÂGE */}
        <div className="age-group">
          <select name="age_type" value={form.age_type || 'ans'} onChange={onChange}>
            <option value="ans">Ans</option>
            <option value="mois">Mois</option>
            <option value="mois_jours">Mois + Jours</option>
            <option value="jours">Jours seulement</option>
          </select>

          {form.age_type === 'ans' && (
            <input name="age" type="number" min="0" placeholder="Années"
              value={form.age} onChange={onChange} required />
          )}
          {form.age_type === 'mois' && (
            <input name="age" type="number" min="0" max="23" placeholder="Mois"
              value={form.age} onChange={onChange} required />
          )}
          {form.age_type === 'mois_jours' && (
            <>
              <input name="age_mois" type="number" min="0" max="23" placeholder="Mois"
                value={form.age_mois} onChange={onChange} required style={{ maxWidth: '120px' }} />
              <span style={{ color: '#5f7b84', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>mois</span>
              <input name="age_jours" type="number" min="0" max="30" placeholder="Jours"
                value={form.age_jours} onChange={onChange} required style={{ maxWidth: '120px' }} />
              <span style={{ color: '#5f7b84', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>jours</span>
            </>
          )}
          {form.age_type === 'jours' && (
            <input name="age_jours" type="number" min="0" max="31" placeholder="Jours"
              value={form.age_jours} onChange={onChange} required />
          )}
        </div>

        <select name="sexe" value={form.sexe || ''} onChange={onChange} className="select">
          <option value="">Sexe (optionnel)</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>

        <input name="domicile"   placeholder="Domicile"   value={form.domicile}   onChange={onChange} required />
        <input name="diagnostic" placeholder="Diagnostic" value={form.diagnostic} onChange={onChange} required />

        <div className="treatments-wrap">
          <TreatmentSelector
            medications={medications}
            value={form.treatments}
            onChange={(next) => setForm({ ...form, treatments: next })}
          />

          {(!Array.isArray(form.treatments) || form.treatments.length === 0) && (
            <input
              name="traitement"
              placeholder="Traitement : ex. Cerum x2 sachet, Paracetamol x1 boîte"
              value={form.traitement}
              onChange={onChange}
              required
            />
          )}
        </div>

        <div className="dashboard-badge" style={{ justifySelf: 'start' }}>
          Total : {treatmentTotal} Ar
        </div>

        <textarea name="observation" placeholder="Observation" value={form.observation} onChange={onChange} />

        <div className="actions-row">
          <button type="submit">{editingId ? 'Modifier' : 'Ajouter'}</button>
          {editingId && (
            <button type="button" className="btn-light"
              onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* TABLEAU */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° registre</th>
              <th>Patient</th>
              <th>Âge</th>
              <th>Domicile</th>
              <th>Diagnostic</th>
              <th>Traitement</th>
              <th>Observation</th>
              <th>Coût</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', color: '#5f7b84', padding: '24px' }}>
                  Aucune donnée enregistrée.
                </td>
              </tr>
            )}
            {filteredRecords.map((row) => (
              <tr key={row.id}>
                <td style={{ color: '#5f7b84', fontWeight: 700 }}>{displayRegistryNumber(row.registry_number)}</td>
                <td><strong>{row.patient_nom}</strong> {row.patient_prenom}</td>
                <td>
                  <span className={`age-badge ${ageBadgeClass(row.age)}`}>
                    {displayAge(row.age)}
                  </span>
                </td>
                <td>{row.domicile}</td>
                <td>{row.diagnostic}</td>
                <td>
                  {Array.isArray(row.treatments) && row.treatments.length > 0
                    ? row.treatments.map((t) => `${t.name} x${t.quantity}${t.unit ? ` ${t.unit}` : ''}`).join(', ')
                    : row.traitement}
                </td>
                <td>{row.observation || '-'}</td>
                <td>{row.cost} Ar</td>
                <td style={{ fontSize: '0.85rem', color: '#5f7b84' }}>
                  {row.created_at ? row.created_at.slice(0, 10) : '-'}
                </td>
                <td>
                  {/* Editer : visible pour tous */}
                  <button className="icon-btn" title="Modifier" aria-label="Modifier" onClick={() => edit(row)}>
                    ✏️
                  </button>
                  {' '}
                  <button className="icon-btn" title="Télécharger le reçu" aria-label="Télécharger le reçu" onClick={() => downloadReceipt(row)}>
                    🧾
                  </button>

                  {/* Supprimer : visible uniquement pour l'admin */}
                  {isAdmin && (
                    <>
                      {' '}
                      <button className="icon-btn danger" title="Supprimer" aria-label="Supprimer"
                        onClick={() => window.api.deleteRecord(row.id).then(load)}>
                        🗑️
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
