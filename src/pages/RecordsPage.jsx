import { useEffect, useMemo, useRef, useState } from 'react';
import TreatmentSelector from '../components/TreatmentSelector';
import MonthlyArchiveBanner from '../components/MonthlyArchiveBanner';

const emptyForm = {
  patient_nom: '',
  sexe: '',
  age: '',
  age_type: 'ans',
  age_mois: '',
  age_jours: '',
  domicile: '',
  diagnostic: '',
  traitement: '',
  observation: '',
  appointment_date: '',
  cost: '',
  treatments: [],
};

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getTodayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getAppointmentStatus(date) {
  if (!date) return '';
  const today = getTodayDate();
  if (date < today) return 'Rendez-vous passé';
  if (date === today) return 'Rendez-vous aujourd’hui';
  return 'Rendez-vous à venir';
}

function formatAge(age, age_type, age_mois, age_jours) {
  if (age_type === 'ans')        return `${age}|ans||`;
  if (age_type === 'mois')       return `${age}|mois||`;
  if (age_type === 'mois_jours') return `${age_mois || 0}|mois_jours|${age_jours || 0}||`;
  if (age_type === 'jours')      return `${age_jours || 0}|jours||`;
  return '';
}

function capitalizeWords(value, preserveTrailingSpace = false) {
  const input = String(value || '');
  const trailingSpace = preserveTrailingSpace ? input.match(/\s*$/)?.[0] || '' : '';
  return input
    .trimStart()
    .toLowerCase()
    .replace(/(^|\s|[-'’])(\p{L})/gu, (_, separator, char) => `${separator}${char.toUpperCase()}`)
    + trailingSpace;
}

function formatTextField(name, value) {
  const textFields = new Set([
    'patient_nom',
    'domicile',
    'diagnostic',
    'traitement',
    'observation',
  ]);
  return textFields.has(name) ? capitalizeWords(value, true) : value;
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
  if (!match) return value || '-';
  const number = Number(match[1]) || 0;
  return String(number).padStart(3, '0');
}

function patientIllnessKey(row) {
  return [
    normalizeMedicationName(row.patient_nom),
    normalizeMedicationName(row.patient_prenom),
    normalizeMedicationName(row.diagnostic),
  ].join('|');
}

function normalizeMedicationName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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

function mergeRecords(records) {
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const grouped = {};

  const addTreatment = (group, treatment) => {
    if (!treatment || !treatment.name) return;
    const exists = group.treatments.some((existing) => (
      normalize(existing.name) === normalize(treatment.name)
      && String(existing.quantity) === String(treatment.quantity)
      && normalize(existing.unit) === normalize(treatment.unit)
    ));
    if (!exists) group.treatments.push(treatment);
  };

  records.forEach((record) => {
    const year = record.archive_year || '';
    const month = record.archive_month || '';
    const baseKey = record.registry_number
      ? `${record.registry_number}|${year}|${month}`
      : `${patientIllnessKey(record)}|${year}|${month}`;

    if (!grouped[baseKey]) {
      grouped[baseKey] = { ...record, treatments: [], cost: Number(record.cost) || 0 };
    }

    let group = grouped[baseKey];

    if (record.created_at && (!group.created_at || record.created_at > group.created_at)) {
      grouped[baseKey] = { ...group, ...record, treatments: group.treatments, cost: Number(record.cost) || 0 };
      group = grouped[baseKey];
    }

    if (Array.isArray(record.treatments) && record.treatments.length > 0) {
      record.treatments.forEach((t) => addTreatment(group, t));
    } else if (record.traitement) {
      addTreatment(group, { name: record.traitement });
    }
  });

  return Object.values(grouped).map((group) => ({
    ...group,
    cost: Number(group.cost) || 0,
  }));
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
  const [diagnosticFilter, setDiagnosticFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [medications, setMedications] = useState([]);
  const [archives, setArchives] = useState([]);
  const [activeArchive, setActiveArchive] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const [duplicateCase, setDuplicateCase] = useState(null);
  const [selectedHistoryRow, setSelectedHistoryRow] = useState(null);
  const [dossierHistory, setDossierHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toast, setToast] = useState('');
  const notifiedAppointments = useRef(new Set());

  const diagnosticOptions = useMemo(() => {
    const counts = records.reduce((acc, row) => {
      const diagnostic = String(row.diagnostic || '').trim();
      if (!diagnostic) return acc;
      acc[diagnostic] = (acc[diagnostic] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr', { sensitivity: 'base' }))
      .map(([diagnostic]) => diagnostic);
  }, [records]);

  // ── Rôle de l'utilisateur connecté ──────────────────
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  const load = (archive = activeArchive) => {
    const hasArchive = archive?.year && archive?.month;
    const fetcher = hasArchive
      ? window.api.fetchRecordsByArchive({ category: category.key, year: archive.year, month: archive.month })
      : window.api.fetchRecords(category.key);

    return fetcher
      .then(result => {
        setRecords(mergeRecords(result || []));
      })
      .catch((err) => {
        console.error('fetchRecords failed:', err);
        setRecords([]);
      });
  };

  const loadDossierHistory = async (dossierId, duplicate) => {
    if (!dossierId) {
      if (!duplicate) {
        setDossierHistory([]);
        return;
      }
      const history = records.filter((row) => patientIllnessKey(row) === patientIllnessKey(duplicate));
      setDossierHistory(history);
      setSelectedHistoryRow(duplicate || null);
      return;
    }

    setHistoryLoading(true);
    try {
      const history = await window.api.fetchRecordsByDossier(dossierId);
      setDossierHistory(history || []);
    } catch (err) {
      console.error('fetchRecordsByDossier failed:', err);
      setActionError('Impossible de charger l’historique du dossier.');
      setDossierHistory([]);
    } finally {
      setHistoryLoading(false);
    }
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
    setDiagnosticFilter('');
    setAgeFilter('');
    setDateFilter('');
    setActionError('');
    setActionOk('');
  }, [category.key]);

  useEffect(() => {
    const checkAppointments = () => {
      const appointment = records.find((row) => (
        row.appointment_date === getTodayDate()
        && !notifiedAppointments.current.has(row.id)
      ));
      if (!appointment) return;
      notifiedAppointments.current.add(appointment.id);
      setToast(`Rendez-vous aujourd’hui pour ${appointment.patient_nom || 'ce patient'}.`);
      setTimeout(() => setToast(''), 5000);
    };
    checkAppointments();
    const timer = setInterval(checkAppointments, 60000);
    return () => clearInterval(timer);
  }, [records]);

  const onChange = (e) => {
    const value = formatTextField(e.target.name, e.target.value);
    setForm({ ...form, [e.target.name]: value });
  };

  const findCurrentMonthDuplicate = () => {
    const formKey = patientIllnessKey(form);
    return records.find((row) => (
      Number(row.id) !== Number(editingId)
      && patientIllnessKey(row) === formKey
      && (!activeArchive?.year || Number(row.archive_year) === Number(activeArchive.year))
      && (!activeArchive?.month || Number(row.archive_month) === Number(activeArchive.month))
    ));
  };

  const viewHistory = async (row) => {
    setActionError('');
    setActionOk('');
    setDuplicateCase(null);
    setSelectedHistoryRow(row);
    await loadDossierHistory(row.dossier_id, row);
  };

  const submit = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionOk('');

    if (!editingId) {
      const duplicate = findCurrentMonthDuplicate();
      if (duplicate) {
        // Offer user to either open the existing dossier or continue treatment
        setDuplicateCase(duplicate);
        loadDossierHistory(duplicate.dossier_id, duplicate);
        setActionError(`Dossier existant trouvé pour ce patient ce mois-ci : ${displayRegistryNumber(duplicate.registry_number)}. Choisissez une action ci-dessous.`);
        return;
      }
    }

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
    if (!treatments.length) {
      setActionError('Veuillez sélectionner au moins un médicament ou un acte médical.');
      return;
    }
    const computedCost = treatments.reduce((sum, t) => sum + (Number(t.unit_price) * Number(t.quantity)), 0);
    const payload = {
      patient_nom:    capitalizeWords(form.patient_nom),
      patient_prenom: '',
      sexe:           form.sexe,
      age:            storedAge,
      age_type:       form.age_type,
      domicile:       capitalizeWords(form.domicile),
      diagnostic:     capitalizeWords(form.diagnostic),
      appointment_date: form.appointment_date || null,
      traitement:     capitalizeWords(form.traitement),
      treatments,
      observation:    capitalizeWords(form.observation),
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
      patient_nom:    capitalizeWords(`${row.patient_nom || ''} ${row.patient_prenom || ''}`.trim()),
      sexe:           row.sexe || '',
      age:            parsed.age,
      age_type:       parsed.age_type,
      age_mois:       parsed.age_mois,
      age_jours:      parsed.age_jours,
      domicile:       capitalizeWords(row.domicile || ''),
      diagnostic:     capitalizeWords(row.diagnostic || ''),
      appointment_date: row.appointment_date || '',
      traitement:     capitalizeWords(row.traitement || ''),
      observation:    capitalizeWords(row.observation || ''),
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
    const q = normalizeSearch(search);
    const registry = normalizeSearch(displayRegistryNumber(row.registry_number));
    const fullRegistry = normalizeSearch(row.registry_number);
    const fullName    = normalizeSearch(`${row.patient_nom || ''} ${row.patient_prenom || ''}`);
    const diagnostic = normalizeSearch(row.diagnostic);
    const diagnosticQuery = normalizeSearch(diagnosticFilter);
    const matchesSearch = !q || fullName.includes(q) || diagnostic.includes(q) || registry.includes(q) || fullRegistry.includes(q);
    const matchesDiagnostic = !diagnosticQuery || diagnostic.includes(diagnosticQuery);
    const matchesAge    = !ageFilter || normalizeSearch(displayAge(row.age)).includes(normalizeSearch(ageFilter));
    const matchesDate   = !dateFilter || (row.created_at && row.created_at.slice(0, 10) === dateFilter);
    return matchesSearch && matchesDiagnostic && matchesAge && matchesDate;
  });

  const diagnosticCounts = records.reduce((counts, row) => {
    const diagnostic = String(row.diagnostic || '').trim();
    if (!diagnostic) return counts;
    counts[diagnostic] = (counts[diagnostic] || 0) + 1;
    return counts;
  }, {});

  const diagnosticSummary = Object.entries(diagnosticCounts)
    .sort((a, b) => b[1] - a[1]);

  const liveTotal = (Array.isArray(form.treatments) ? form.treatments : [])
    .reduce((sum, t) => sum + (Number(t.unit_price) * Number(t.quantity)), 0);
  const treatmentTotal = liveTotal || previewTreatmentsTotal(form.traitement, form.treatments, medications);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Registre {category.label}</h1>
          <p>Médicaments et actes médicaux.</p>
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

      {diagnosticSummary.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <strong>Synthèse diagnostics ce mois :</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
            {diagnosticSummary.slice(0, 6).map(([diagnostic, count]) => (
              <button
                key={diagnostic}
                type="button"
                onClick={() => setDiagnosticFilter(diagnostic)}
                style={{
                  padding: '8px 12px',
                  background: diagnosticFilter === diagnostic ? '#d8e9f7' : '#f4f9fd',
                  border: diagnosticFilter === diagnostic ? '1px solid #74a7d9' : '1px solid #dceaf2',
                  borderRadius: '10px',
                  color: '#184a6e',
                  cursor: 'pointer',
                }}
              >
                {diagnostic} : {count}
              </button>
            ))}
            {diagnosticSummary.length > 6 && (
              <span style={{ padding: '8px 12px', background: '#f4f9fd', border: '1px solid #dceaf2', borderRadius: '10px', color: '#184a6e' }}>
                +{diagnosticSummary.length - 6} autres diagnostics
              </span>
            )}
          </div>
        </div>
      )}

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
      {toast && <div className="toast" role="status">🔔 {toast}</div>}

      {duplicateCase && (
        <div className="info-msg" style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>⚠ Dossier existant : {displayRegistryNumber(duplicateCase.registry_number)}</span>
          <button type="button" className="btn-light" onClick={() => { edit(duplicateCase); setDuplicateCase(null); setActionError(''); setDossierHistory([]); }}>
            Charger le dossier
          </button>
          <button type="button" onClick={async () => {
            setActionError(''); setActionOk('');
            try {
              await window.api.continueRecord(duplicateCase.id, { treatments: form.treatments, traitement: form.traitement, observation: form.observation, appointment_date: form.appointment_date, cost: form.cost });
              setActionOk('Traitement ajouté au dossier existant.');
              setForm(emptyForm);
              setDuplicateCase(null);
              setDossierHistory([]);
              await load();
            } catch (err) {
              console.error('continueRecord failed:', err);
              setActionError(err?.message || 'Impossible d\'ajouter le traitement.');
            }
          }}>
            Continuer le traitement
          </button>
        </div>
      )}
      {(duplicateCase || selectedHistoryRow) && (
        <div style={{ marginBottom: '18px', padding: '12px', border: '1px solid #e6e6e6', borderRadius: '8px', background: '#fafafa' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Historique du dossier</h3>
          {historyLoading ? (
            <p>Chargement de l'historique...</p>
          ) : dossierHistory.length === 0 ? (
            <p style={{ margin: 0 }}>Aucun historique de dossier disponible.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Visite</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>N°</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Date / Heure</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Traitement</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Observation</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Coût ancien</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Coût présent</th>
                  </tr>
                </thead>
                <tbody>
                  {dossierHistory.map((historyRow, idx) => (
                    <tr key={historyRow.id}>
                      <td style={{ padding: '6px 8px' }}>{idx === dossierHistory.length - 1 ? 'Présent' : `Ancien ${idx + 1}`}</td>
                      <td style={{ padding: '6px 8px' }}>{displayRegistryNumber(historyRow.registry_number)}</td>
                      <td style={{ padding: '6px 8px' }}>{formatMadagascarDateTime(historyRow.created_at)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {Array.isArray(historyRow.treatments) && historyRow.treatments.length > 0
                          ? historyRow.treatments.map((t) => t.item_type === 'act' ? t.name : `${t.name} x${t.quantity}${t.unit ? ` ${t.unit}` : ''}`).join(', ')
                          : historyRow.traitement || '-'}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{historyRow.observation || '-'}</td>
                      <td style={{ padding: '6px 8px' }}>{idx === dossierHistory.length - 1 ? '-' : `${historyRow.cost} Ar`}</td>
                      <td style={{ padding: '6px 8px' }}>{idx === dossierHistory.length - 1 ? `${historyRow.cost} Ar` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BARRE RECHERCHE */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Recherche par nom, diagnostic ou N° registre..."
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
        {(search || diagnosticFilter || ageFilter || dateFilter) && (
          <button type="button" className="btn-light"
            onClick={() => { setSearch(''); setDiagnosticFilter(''); setAgeFilter(''); setDateFilter(''); }}>
            ✕ Effacer
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: '#5f7b84', fontSize: '0.9rem' }}>
          {filteredRecords.length} résultat{filteredRecords.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* FORMULAIRE */}
      <form className="record-form" onSubmit={submit} style={{ borderColor: category.color }}>
        <input name="patient_nom" placeholder="Nom et prénom" value={form.patient_nom} onChange={onChange} required />

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
        <label className="appointment-field" htmlFor="appointment-date">
          <span>Rendez-vous</span>
          <input id="appointment-date" name="appointment_date" type="date" value={form.appointment_date} onChange={onChange} required />
        </label>

        <div className="treatments-wrap">
          <TreatmentSelector
            medications={medications}
            value={form.treatments}
            onChange={(next) => setForm({ ...form, treatments: next })}
          />

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
              <th>Sexe</th>
              <th>Âge</th>
              <th>Domicile</th>
              <th>Diagnostic</th>
              <th>Traitement</th>
              <th>Observation</th>
              <th>Coût</th>
              <th>Date</th>
              <th>Rendez-vous</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', color: '#5f7b84', padding: '24px' }}>
                  Aucune donnée enregistrée.
                </td>
              </tr>
            )}
            {filteredRecords.map((row) => (
              <tr key={row.id}>
                <td style={{ color: '#5f7b84', fontWeight: 700 }}>{displayRegistryNumber(row.registry_number)}</td>
                <td><strong>{row.patient_nom}</strong> {row.patient_prenom}</td>
                <td>{row.sexe || '-'}</td>
                <td>
                  <span className={`age-badge ${ageBadgeClass(row.age)}`}>
                    {displayAge(row.age)}
                  </span>
                </td>
                <td>{row.domicile}</td>
                <td>{row.diagnostic}</td>
                <td>
                  {Array.isArray(row.treatments) && row.treatments.length > 0
                    ? row.treatments.map((t) => t.item_type === 'act' ? t.name : `${t.name} x${t.quantity}${t.unit ? ` ${t.unit}` : ''}`).join(', ')
                    : row.traitement}
                </td>
                <td>{row.observation || '-'}</td>
<td>{row.cost} Ar</td>
                 <td style={{ fontSize: '0.85rem', color: '#5f7b84' }}>
                   {row.created_at ? formatMadagascarDateTime(row.created_at).slice(0, 10) : '-'}
                 </td>
                 <td style={{ fontSize: '0.85rem', color: '#5f7b84' }}>
                   {row.appointment_date ? (
                     <>
                       <strong>{row.appointment_date}</strong>
                       <span style={{ display: 'block', fontSize: '0.75rem', color: row.appointment_date <= getTodayDate() ? '#a0522d' : '#1c96a4' }}>
                         {getAppointmentStatus(row.appointment_date)}
                       </span>
                     </>
                   ) : '-'}
                 </td>
                 <td>
                  {/* Editer : visible pour tous */}
                  <button className="icon-btn" title="Modifier" aria-label="Modifier" onClick={() => edit(row)}>
                    ✏️
                  </button>
                  {' '}
                  <button className="icon-btn" title="Voir l'historique" aria-label="Voir l'historique" onClick={() => viewHistory(row)}>
                    📜
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
