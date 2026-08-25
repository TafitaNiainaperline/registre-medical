const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db = null;
let DB_PATH = null;

function getArchiveFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  return { year, month };
}

function archiveLabelFr(year, month) {
  const date = new Date(year, Math.max(0, month - 1), 1);
  const monthName = date.toLocaleString('fr-FR', { month: 'long' });
  const label = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
  return label;
}

async function getDB() {
  if (db) return db;

  const { app } = require('electron');

  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');

  const SQL = await require('sql.js')({ locateFile: () => wasmPath });

  DB_PATH = path.join(app.getPath('userData'), 'registre-medical.db');

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initTables();
  const schemaChanged = ensureMedicalRecordsSchema(db) || ensureMedicationsSchema(db) || ensureDispensationsSchema(db);
  if (schemaChanged) {
    try { saveDB(); } catch { /* ignore */ }
  }

  return db;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initTables() {
   db.run(`
     CREATE TABLE IF NOT EXISTS users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       username TEXT NOT NULL UNIQUE,
       name TEXT NOT NULL,
       password_hash TEXT NOT NULL,
       role TEXT NOT NULL DEFAULT 'user',
       is_active INTEGER NOT NULL DEFAULT 0,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );

     CREATE TABLE IF NOT EXISTS medical_records (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       category TEXT NOT NULL,
       dossier_id INTEGER,
       patient_nom TEXT NOT NULL,
       patient_prenom TEXT NOT NULL,
       sexe TEXT,
       age INTEGER NOT NULL,
       age_type TEXT DEFAULT 'ans',
       domicile TEXT NOT NULL,
       diagnostic TEXT NOT NULL,
       traitement TEXT NOT NULL,
       observation TEXT,
       cost REAL NOT NULL DEFAULT 0,
       created_by INTEGER,
       registry_number TEXT,
       archive_year INTEGER,
       archive_month INTEGER,
       treatments_json TEXT,
      appointment_date TEXT,
      tdr_result TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );

     CREATE TABLE IF NOT EXISTS dossiers (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       dossier_number TEXT,
       patient_nom TEXT NOT NULL,
       diagnostic TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );

     CREATE TABLE IF NOT EXISTS medications (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL UNIQUE,
         item_type TEXT NOT NULL DEFAULT 'medication',
       price INTEGER NOT NULL,
       unit TEXT DEFAULT 'comprimé',
       description TEXT,
       stock INTEGER,
      stock_threshold INTEGER DEFAULT 100,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME
     );

     CREATE TABLE IF NOT EXISTS record_medications (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       record_id INTEGER NOT NULL,
       medication_id INTEGER,
      item_type TEXT NOT NULL DEFAULT 'medication',
       medication_name TEXT NOT NULL,
       medication_unit TEXT,
       quantity INTEGER NOT NULL,
       unit_price INTEGER NOT NULL,
       total INTEGER NOT NULL
     );

     CREATE TABLE IF NOT EXISTS medication_movements (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       medication_id INTEGER NOT NULL,
       movement_type TEXT NOT NULL,
       quantity INTEGER NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );

     CREATE TABLE IF NOT EXISTS dispensations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       medication_id INTEGER NOT NULL,
       medication_name TEXT NOT NULL,
       unit TEXT,
       quantity INTEGER NOT NULL,
       unit_price INTEGER,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );

     CREATE INDEX IF NOT EXISTS idx_medical_records_archive ON medical_records(archive_year, archive_month);
     CREATE INDEX IF NOT EXISTS idx_medical_records_category_archive ON medical_records(category, archive_year, archive_month);
     CREATE INDEX IF NOT EXISTS idx_record_medications_record_id ON record_medications(record_id);
   `);

  // Migration : ajouter colonnes manquantes si ancienne DB
  const migrations = [
    `ALTER TABLE medical_records ADD COLUMN age_type TEXT DEFAULT 'ans'`,
    `ALTER TABLE medical_records ADD COLUMN sexe TEXT`,
    `ALTER TABLE medical_records ADD COLUMN registry_number TEXT`,
    `ALTER TABLE medical_records ADD COLUMN archive_year INTEGER`,
    `ALTER TABLE medical_records ADD COLUMN archive_month INTEGER`,
    `ALTER TABLE medical_records ADD COLUMN treatments_json TEXT`,
    `ALTER TABLE medical_records ADD COLUMN dossier_id INTEGER`,
    `ALTER TABLE users ADD COLUMN username TEXT`,
    `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`,
    `ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 0`,
    `ALTER TABLE record_medications ADD COLUMN medication_unit TEXT`,
    `ALTER TABLE record_medications ADD COLUMN item_type TEXT NOT NULL DEFAULT 'medication'`,
    `ALTER TABLE medical_records ADD COLUMN appointment_date TEXT`,
    `ALTER TABLE medical_records ADD COLUMN tdr_result TEXT`,
  ];
  let schemaChanged = false;
  migrations.forEach(sql => {
    try { db.run(sql); schemaChanged = true; } catch { /* déjà existant */ }
  });

  // Self-heal schema in case a migration was skipped on some machines
  try {
    schemaChanged = ensureMedicalRecordsSchema(db) || schemaChanged;
    schemaChanged = ensureMedicationsSchema(db) || schemaChanged;
  } catch {
    /* ignore */
  }

  // Backfill archive_year/month pour les anciennes lignes (si null)
  try {
    const rows = toObjects(db.exec('SELECT id, created_at FROM medical_records WHERE archive_year IS NULL OR archive_month IS NULL'));
    rows.forEach((r) => {
      const { year, month } = getArchiveFromDate(r.created_at || new Date());
      db.run('UPDATE medical_records SET archive_year = ?, archive_month = ? WHERE id = ?', [year, month, r.id]);
    });
  } catch {
    /* ignore */
  }

  try {
    backfillRegistryNumbers(db);
  } catch (e) {
    console.error('backfillRegistryNumbers error:', e);
  }

  try {
    backfillDossiers(db);
  } catch (e) {
    console.error('backfillDossiers error:', e);
  }

  // Persist schema changes so they survive app restart
  if (schemaChanged) {
    try { saveDB(); } catch { /* ignore */ }
  }

  // Admin par défaut
  const res = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (!res.length || !res[0].values.length) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO users (username, name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'Administrateur', hash, 'admin', 1]);
    saveDB();
  }
}

function toObjects(result) {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

function registryPrefix(category) {
  const prefixes = {
    consultation: 'CONS',
    cpn: 'CPN',
    pf: 'PF',
    analyse: 'ANA',
    soin: 'SO',
  };
  return prefixes[category] || String(category || 'REG').slice(0, 4).toUpperCase();
}

function nextDossierNumber(d) {
  const rows = toObjects(d.exec(`SELECT dossier_number FROM dossiers WHERE dossier_number IS NOT NULL`));
  const maxSeq = rows.reduce((max, row) => {
    const match = String(row.dossier_number || '').match(/-(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
  return `DOS-${String(maxSeq + 1).padStart(4, '0')}`;
}

async function getOrCreateDossier(d, data) {
  const patient = String(data.patient_nom || '').trim();
  const diagnostic = String(data.diagnostic || '').trim();
  const rows = toObjects(d.exec('SELECT * FROM dossiers WHERE LOWER(patient_nom)=? AND LOWER(diagnostic)=? LIMIT 1', [patient.toLowerCase(), diagnostic.toLowerCase()]));
  if (rows && rows[0]) return rows[0];

  const number = nextDossierNumber(d);
  d.run('INSERT INTO dossiers (dossier_number, patient_nom, diagnostic) VALUES (?, ?, ?)', [number, patient, diagnostic]);
  const idRes = toObjects(d.exec('SELECT last_insert_rowid() as id'))[0];
  const id = idRes?.id;
  const created = toObjects(d.exec('SELECT * FROM dossiers WHERE id = ?', [id]))[0];
  return created;
}

async function listDossiers(search) {
  const d = await getDB();
  const where = [];
  const params = [];
  if (search) {
    where.push('(LOWER(patient_nom) LIKE ? OR LOWER(diagnostic) LIKE ? OR LOWER(dossier_number) LIKE ?)');
    const q = `%${String(search).toLowerCase()}%`;
    params.push(q, q, q);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = d.exec(`SELECT * FROM dossiers ${whereClause} ORDER BY id DESC`, params);
  return toObjects(res);
}

async function getDossierById(id) {
  const d = await getDB();
  const rows = toObjects(d.exec('SELECT * FROM dossiers WHERE id = ?', [id]));
  return rows[0] || null;
}

async function fetchRecordsByDossier(dossierId) {
  const d = await getDB();
  const rows = toObjects(d.exec('SELECT * FROM medical_records WHERE dossier_id = ? ORDER BY created_at ASC', [dossierId]));
  const ids = rows.map(r => r.id);
  if (!ids.length) return rows;

  const medsRows = toObjects(d.exec(`SELECT * FROM record_medications WHERE record_id IN (${ids.join(',')})`));
  const byRecord = new Map();
  medsRows.forEach((m) => {
    if (!byRecord.has(m.record_id)) byRecord.set(m.record_id, []);
    byRecord.get(m.record_id).push({
      medication_id: m.medication_id ?? null,
      item_type: m.item_type === 'act' ? 'act' : 'medication',
      name: m.medication_name,
      unit: m.medication_unit || null,
      quantity: Number(m.quantity) || 0,
      unit_price: Number(m.unit_price) || 0,
      total: Number(m.total) || 0,
    });
  });

  return rows.map((r) => {
    const treatments = byRecord.get(r.id) || null;
    let treatmentsJson;
    try { treatmentsJson = r.treatments_json ? JSON.parse(r.treatments_json) : null; } catch { treatmentsJson = null; }
    return { ...r, treatments: treatments || treatmentsJson || null };
  });
}

function registryPeriod(year, month) {
  return `${String(year).slice(-2)}${String(month).padStart(2, '0')}`;
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

function nextRegistryNumber(d, category, year, month) {
  const prefix = registryPrefix(category);
  const period = registryPeriod(year, month);
  const rows = toObjects(d.exec(
    `SELECT registry_number FROM medical_records
     WHERE category = ? AND archive_year = ? AND archive_month = ?
       AND registry_number IS NOT NULL`,
    [category, year, month]
  ));
  const maxSeq = rows.reduce((max, row) => {
    const match = String(row.registry_number || '').match(/-(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
  return `${prefix}-${period}-${String(maxSeq + 1).padStart(3, '0')}`;
}

function getRegistryNumberForRecord(d, data, year, month, existingId = null) {
  const category = data.category;
  const key = patientIllnessKey(data);
  const rows = toObjects(d.exec(
    `SELECT id, registry_number, patient_nom, patient_prenom, diagnostic
     FROM medical_records
     WHERE category = ? AND archive_year = ? AND archive_month = ?
       AND registry_number IS NOT NULL
     ORDER BY id ASC`,
    [category, year, month]
  ));

  const same = rows.find((row) => Number(row.id) !== Number(existingId) && patientIllnessKey(row) === key);
  if (same?.registry_number) return same.registry_number;

  if (existingId) {
    const current = rows.find((row) => Number(row.id) === Number(existingId));
    if (current?.registry_number && patientIllnessKey(current) === key) return current.registry_number;
  }

  return nextRegistryNumber(d, category, year, month);
}

function findExistingMonthlyCase(d, data, year, month, existingId = null) {
  const key = patientIllnessKey(data);
  const rows = toObjects(d.exec(
    `SELECT id, registry_number, patient_nom, patient_prenom, diagnostic
     FROM medical_records
     WHERE category = ? AND archive_year = ? AND archive_month = ?
     ORDER BY id ASC`,
    [data.category, year, month]
  ));
  return rows.find((row) => Number(row.id) !== Number(existingId) && patientIllnessKey(row) === key) || null;
}

function backfillRegistryNumbers(d) {
  const rows = toObjects(d.exec(`
    SELECT id, category, patient_nom, patient_prenom, diagnostic, archive_year, archive_month, registry_number
    FROM medical_records
    WHERE archive_year IS NOT NULL AND archive_month IS NOT NULL
    ORDER BY archive_year ASC, archive_month ASC, category ASC, id ASC
  `));
  let changed = false;
  const assigned = new Map();

  rows.forEach((row) => {
    if (row.registry_number) {
      assigned.set(`${row.category}|${row.archive_year}|${row.archive_month}|${patientIllnessKey(row)}`, row.registry_number);
      return;
    }

    const key = `${row.category}|${row.archive_year}|${row.archive_month}|${patientIllnessKey(row)}`;
    const number = assigned.get(key) || nextRegistryNumber(d, row.category, Number(row.archive_year), Number(row.archive_month));
    assigned.set(key, number);
    d.run('UPDATE medical_records SET registry_number = ? WHERE id = ?', [number, row.id]);
    changed = true;
  });

  return changed;
}

function backfillDossiers(d) {
  // Find distinct patient+diagnostic tuples without dossier_id and create dossiers
  const rows = toObjects(d.exec(`
    SELECT DISTINCT patient_nom, diagnostic
    FROM medical_records
    WHERE dossier_id IS NULL
  `));
  if (!rows.length) return false;
  let changed = false;
  rows.forEach((r) => {
    try {
      const patient = r.patient_nom || '';
      const diagnostic = r.diagnostic || '';
      // create dossier
      const number = nextDossierNumber(d);
      d.run('INSERT INTO dossiers (dossier_number, patient_nom, diagnostic) VALUES (?, ?, ?)', [number, patient, diagnostic]);
      const idRes = toObjects(d.exec('SELECT last_insert_rowid() as id'))[0];
      const id = idRes?.id;
      if (id) {
        d.run('UPDATE medical_records SET dossier_id = ? WHERE LOWER(patient_nom)=? AND LOWER(diagnostic)=?', [id, String(patient).toLowerCase(), String(diagnostic).toLowerCase()]);
        changed = true;
      }
    } catch (e) {
      // ignore per-row failures
    }
  });
  return changed;
}

// ── AUTH ──────────────────────────────────────────────
async function loginUser({ username, password }) {
  const d = await getDB();
  const res = d.exec('SELECT * FROM users WHERE username = ?', [username]);
  const users = toObjects(res);
  if (!users.length) throw new Error('Pseudo introuvable');
  if (!users[0].is_active) throw new Error('Compte non activé. Contactez l\'administrateur.');
  if (!bcrypt.compareSync(password, users[0].password_hash)) throw new Error('Mot de passe incorrect');
  return { id: users[0].id, name: users[0].name, username: users[0].username, role: users[0].role };
}

async function registerUser({ username, name, password }) {
  const d = await getDB();
  const res = d.exec('SELECT id FROM users WHERE username = ?', [username]);
  if (toObjects(res).length) throw new Error('Ce pseudo est déjà utilisé');
  const hash = bcrypt.hashSync(password, 10);
  d.run('INSERT INTO users (username, name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
    [username, name, hash, 'user', 0]);
  saveDB();
  return { username, name };
}

// ── GESTION UTILISATEURS (admin) ──────────────────────
async function getAllUsers() {
  const d = await getDB();
  const res = d.exec('SELECT id, username, name, role, is_active, created_at FROM users ORDER BY created_at DESC');
  return toObjects(res);
}

async function toggleUserActive(id, is_active) {
  const d = await getDB();
  d.run('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
  saveDB();
}

async function resetUserPassword(id, newPassword) {
  const d = await getDB();
  const hash = bcrypt.hashSync(newPassword, 10);
  d.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  saveDB();
}

async function deleteUser(id) {
  const d = await getDB();
  d.run('DELETE FROM users WHERE id = ? AND role != "admin"', [id]);
  saveDB();
}

// ── RECORDS ───────────────────────────────────────────
async function fetchRecords(category) {
  const d = await getDB();
  const res = d.exec('SELECT * FROM medical_records WHERE category = ? ORDER BY id ASC', [category]);
  const records = toObjects(res);

  const ids = records.map(r => r.id);
  if (!ids.length) return records;

  let medsRows;
  try {
    medsRows = toObjects(d.exec(`SELECT * FROM record_medications WHERE record_id IN (${ids.join(',')})`));
  } catch {
    medsRows = [];
  }

  const byRecord = new Map();
  medsRows.forEach((m) => {
    if (!byRecord.has(m.record_id)) byRecord.set(m.record_id, []);
    byRecord.get(m.record_id).push({
      medication_id: m.medication_id ?? null,
      name: m.medication_name,
      unit: m.medication_unit || null,
      quantity: Number(m.quantity) || 0,
      unit_price: Number(m.unit_price) || 0,
      total: Number(m.total) || 0,
    });
  });

  return records.map((r) => {
    const treatments = byRecord.get(r.id) || null;
    let treatmentsJson;
    try { treatmentsJson = r.treatments_json ? JSON.parse(r.treatments_json) : null; } catch { /* ignore */ }
    return { ...r, treatments: treatments || treatmentsJson || null };
  });
}

function ensureMedicalRecordsSchema(d) {
  try {
    const info = toObjects(d.exec('PRAGMA table_info(medical_records)'));
    const cols = new Set(info.map((r) => r.name));
    let changed = false;
    const ensureCol = (name, ddl) => {
      if (!cols.has(name)) {
        try { d.run(ddl); changed = true; } catch { /* ignore */ }
      }
    };
    ensureCol('sexe', 'ALTER TABLE medical_records ADD COLUMN sexe TEXT');
    ensureCol('registry_number', 'ALTER TABLE medical_records ADD COLUMN registry_number TEXT');
    ensureCol('archive_year', 'ALTER TABLE medical_records ADD COLUMN archive_year INTEGER');
    ensureCol('archive_month', 'ALTER TABLE medical_records ADD COLUMN archive_month INTEGER');
    ensureCol('treatments_json', 'ALTER TABLE medical_records ADD COLUMN treatments_json TEXT');
    ensureCol('appointment_date', 'ALTER TABLE medical_records ADD COLUMN appointment_date TEXT');
    ensureCol('tdr_result', 'ALTER TABLE medical_records ADD COLUMN tdr_result TEXT');
    return changed;
  } catch {
    return false;
  }
}

function ensureMedicationsSchema(d) {
  try {
    const info = toObjects(d.exec('PRAGMA table_info(medications)'));
    const cols = new Set(info.map((r) => r.name));
    let changed = false;

    const ensureCol = (name, ddl) => {
      if (!cols.has(name)) {
        try { d.run(ddl); changed = true; } catch { /* ignore */ }
      }
    };

    ensureCol('unit', "ALTER TABLE medications ADD COLUMN unit TEXT DEFAULT 'comprimé'");
    ensureCol('stock_threshold', 'ALTER TABLE medications ADD COLUMN stock_threshold INTEGER DEFAULT 100');
    ensureCol('item_type', "ALTER TABLE medications ADD COLUMN item_type TEXT NOT NULL DEFAULT 'medication'");

    return changed;
  } catch {
    return false;
  }
}

function ensureDispensationsSchema(d) {
  try {
    const info = toObjects(d.exec('PRAGMA table_info(dispensations)'));
    const cols = new Set(info.map((r) => r.name));
    let changed = false;

    const ensureCol = (name, ddl) => {
      if (!cols.has(name)) {
        try { d.run(ddl); changed = true; } catch { /* ignore */ }
      }
    };

    ensureCol('unit_price', 'ALTER TABLE dispensations ADD COLUMN unit_price INTEGER');

    return changed;
  } catch {
    return false;
  }
}

function applyMedicationStockDeltas(d, deltaByMedicationId) {
  if (!deltaByMedicationId) return;
  const entries = Array.from(deltaByMedicationId.entries ? deltaByMedicationId.entries() : []);

  entries.forEach(([medId, delta]) => {
    const id = Number(medId);
    const change = Number(delta);
    if (!Number.isFinite(id) || !Number.isFinite(change) || change >= 0) return;

    const rows = toObjects(d.exec('SELECT name, stock FROM medications WHERE id = ?', [id]));
    const med = rows[0];
    if (!med || med.stock === null || med.stock === undefined) return;

    const currentStock = Number(med.stock);
    if (Number.isFinite(currentStock) && currentStock + change < 0) {
      throw new Error(`Stock insuffisant pour "${med.name}". Disponible : ${currentStock}. Demandé : ${Math.abs(change)}.`);
    }
  });

  entries.forEach(([medId, delta]) => {
    const id = Number(medId);
    const change = Number(delta);
    if (!Number.isFinite(id) || !Number.isFinite(change) || change === 0) return;

    // stock is optional (NULL means "not tracked")
    d.run(
      `UPDATE medications
       SET stock = CASE
         WHEN stock IS NULL THEN NULL
         ELSE stock + ?
       END,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [change, id]
    );

    if (change < 0) {
      d.run(
        `
        INSERT INTO medication_movements
        (
          medication_id,
          movement_type,
          quantity
        )
        VALUES (?, ?, ?)
        `,
        [id, 'exit', Math.abs(change)]
      );
    }
  });
}

async function fetchRecordsByArchive({ category, year, month, search }) {
  const d = await getDB();
  const where = [];
  const params = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (year) { where.push('archive_year = ?'); params.push(year); }
  if (month) { where.push('archive_month = ?'); params.push(month); }
  if (search) {
    where.push('(LOWER(patient_nom) LIKE ? OR LOWER(patient_prenom) LIKE ?)');
    const q = `%${String(search).toLowerCase()}%`;
    params.push(q, q);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = d.exec(`SELECT * FROM medical_records ${whereClause} ORDER BY id ASC`, params);
  const records = toObjects(res);
  const ids = records.map(r => r.id);
  if (!ids.length) return records;

  const medsRows = toObjects(d.exec(`SELECT * FROM record_medications WHERE record_id IN (${ids.join(',')})`));
  const byRecord = new Map();
  medsRows.forEach((m) => {
    if (!byRecord.has(m.record_id)) byRecord.set(m.record_id, []);
    byRecord.get(m.record_id).push({
      medication_id: m.medication_id ?? null,
      name: m.medication_name,
      unit: m.medication_unit || null,
      quantity: Number(m.quantity) || 0,
      unit_price: Number(m.unit_price) || 0,
      total: Number(m.total) || 0,
    });
  });

  return records.map((r) => ({ ...r, treatments: byRecord.get(r.id) || null }));
}

async function fetchRecordById(id) {
  const d = await getDB();
  const records = toObjects(d.exec(`
    SELECT mr.*, u.name AS responsible_name
    FROM medical_records mr
    LEFT JOIN users u ON u.id = mr.created_by
    WHERE mr.id = ?
  `, [id]));
  const record = records[0];
  if (!record) return null;

  let medsRows = [];
  try {
    medsRows = toObjects(d.exec('SELECT * FROM record_medications WHERE record_id = ?', [id]));
  } catch {
    /* ignore */
  }

  const treatments = medsRows.map((m) => ({
    medication_id: m.medication_id ?? null,
    name: m.medication_name,
    unit: m.medication_unit || null,
    quantity: Number(m.quantity) || 0,
    unit_price: Number(m.unit_price) || 0,
    total: Number(m.total) || 0,
  }));

  let treatmentsJson;
  try { treatmentsJson = record.treatments_json ? JSON.parse(record.treatments_json) : null; } catch { /* ignore */ }
  return { ...record, treatments: treatments.length ? treatments : treatmentsJson || null };
}

async function fetchStats() {
  const d = await getDB();
  const res = d.exec('SELECT category, COUNT(*) as count FROM medical_records GROUP BY category');
  const rows = toObjects(res);
  const stats = {};
  rows.forEach(r => { stats[r.category] = r.count; });
  return stats;
}

async function fetchStatsByArchive({ year, month } = {}) {
  const d = await getDB();
  if (!year || !month) return fetchStats();
  const res = d.exec(
    'SELECT category, COUNT(*) as count FROM medical_records WHERE archive_year = ? AND archive_month = ? GROUP BY category',
    [Number(year), Number(month)]
  );
  const rows = toObjects(res);
  const stats = {};
  rows.forEach(r => { stats[r.category] = r.count; });
  return stats;
}

function buildTraitementText(treatments) {
  if (!Array.isArray(treatments) || treatments.length === 0) return '';
  return treatments
    .filter(t => t && t.name && Number(t.quantity) > 0)
    .map(t => t.item_type === 'act'
      ? t.name
      : `${t.name} x${Number(t.quantity)}${t.unit ? ` ${t.unit}` : ''}`)
    .join(', ');
}

function normalizeMedicationName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findMedicationFromText(text, medications) {
  const wanted = normalizeMedicationName(text);
  const candidates = medications
    .map((med) => ({ med, normalized: normalizeMedicationName(med.name) }))
    .filter(({ normalized }) => normalized);

  const exact = candidates.find(({ normalized }) => normalized === wanted);
  if (exact) return exact.med;

  const prefixMatches = candidates
    .filter(({ normalized }) => wanted.startsWith(`${normalized} `))
    .sort((a, b) => b.normalized.length - a.normalized.length);

  return prefixMatches[0]?.med || null;
}

function parseTreatmentTextPart(part, medications) {
  const text = String(part || '').trim();
  const med = findMedicationFromText(text, medications);
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

  return { med, quantity, unitOk };
}

function treatmentsFromFreeText(d, text) {
  const parts = String(text || '')
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return [];

  const medications = toObjects(d.exec('SELECT id, name, item_type, price, unit, stock FROM medications ORDER BY name ASC'));
  const byMedicationId = new Map();
  const unknown = [];
  const wrongUnits = [];

  parts.forEach((part) => {
    const parsed = parseTreatmentTextPart(part, medications);
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
    const quantity = Math.max(1, Number(parsed.quantity) || 1);
    const current = byMedicationId.get(id);
    if (current) {
      current.quantity += quantity;
    } else {
      byMedicationId.set(id, {
        medication_id: med.id,
        item_type: med.item_type === 'act' ? 'act' : 'medication',
        name: med.name,
        unit: med.item_type === 'act' ? null : (med.unit || null),
        quantity,
        unit_price: Number(med.price) || 0,
      });
    }
  });

  if (unknown.length) {
    throw new Error(`Médicament non disponible dans le stock : ${unknown.join(', ')}. Utilisez le nom enregistré, par exemple : Cerum x2 sachet.`);
  }

  if (wrongUnits.length) {
    throw new Error(`Unité incorrecte. Utilisez l'unité enregistrée : ${wrongUnits.join(', ')}.`);
  }

  return Array.from(byMedicationId.values());
}

function normalizeTreatments(treatments) {
  if (!Array.isArray(treatments)) return [];
  return treatments
    .filter(t => t && typeof t.name === 'string')
    .map(t => ({
      medication_id: t.medication_id ?? null,
      item_type: t.item_type === 'act' ? 'act' : 'medication',
      name: String(t.name).trim(),
      unit: t.unit ? String(t.unit).trim() : null,
      quantity: Math.max(0, parseInt(t.quantity, 10) || 0),
      unit_price: Math.max(0, parseInt(t.unit_price, 10) || 0),
    }))
    .filter(t => t.name && t.quantity > 0);
}

function computeTotalCostAr(treatments) {
  return normalizeTreatments(treatments).reduce((sum, t) => sum + (t.unit_price * t.quantity), 0);
}

async function createRecord(data) {
  const d = await getDB();

  // Defensive: older DB may miss columns (ex: "sexe")
  if (ensureMedicalRecordsSchema(d)) {
    try { saveDB(); } catch { /* ignore */ }
  }
  const now = new Date();
  const { year, month } = data.archive_year && data.archive_month
    ? { year: Number(data.archive_year), month: Number(data.archive_month) }
    : getArchiveFromDate(now);

  const existingCase = findExistingMonthlyCase(d, data, year, month);
  if (existingCase) {
    throw new Error(`Ce patient est déjà enregistré ce mois pour cette même maladie sous le N° ${displayRegistryNumber(existingCase.registry_number)}. Recherchez ce numéro et modifiez le dossier existant pour continuer le traitement.`);
  }

  // Ensure dossier exists and attach
  try {
    const dossier = await getOrCreateDossier(d, data);
    if (dossier && dossier.id) data.dossier_id = dossier.id;
  } catch (e) {
    // ignore dossier creation failures
  }

  let treatments = normalizeTreatments(data.treatments);
  if (!treatments.length && String(data.traitement || '').trim()) {
    treatments = treatmentsFromFreeText(d, data.traitement);
  }
  const hasTreatments = treatments.length > 0;
  const computedCost = hasTreatments ? computeTotalCostAr(treatments) : Number(data.cost) || 0;
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '');
  const registryNumber = getRegistryNumberForRecord(d, data, year, month);

  d.run('BEGIN');
  try {
    try {
      d.run(`INSERT INTO medical_records
        (category, dossier_id, patient_nom, patient_prenom, sexe, age, age_type, domicile, diagnostic, traitement, observation, cost, created_by, registry_number, archive_year, archive_month, treatments_json, appointment_date, tdr_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.category,
          data.dossier_id || null,
          data.patient_nom,
          data.patient_prenom,
          data.sexe || null,
          data.age,
          data.age_type || 'ans',
          data.domicile,
          data.diagnostic,
          traitementText || '',
          data.observation,
          computedCost,
          data.created_by || null,
          registryNumber,
          year,
          month,
          hasTreatments ? JSON.stringify(treatments) : null,
          data.appointment_date || null,
          data.tdr_result || null,
        ]);
    } catch (err) {
      // Retry once after auto-migration (handles "no column named sexe")
      if (String(err?.message || '').includes('no column named')) {
        if (ensureMedicalRecordsSchema(d)) {
          try { saveDB(); } catch { /* ignore */ }
        }
        d.run(`INSERT INTO medical_records
          (category, patient_nom, patient_prenom, sexe, age, age_type, domicile, diagnostic, traitement, observation, cost, created_by, registry_number, archive_year, archive_month, treatments_json, appointment_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.category,
            data.patient_nom,
            data.patient_prenom,
            data.sexe || null,
            data.age,
            data.age_type || 'ans',
            data.domicile,
            data.diagnostic,
            traitementText || '',
            data.observation,
            computedCost,
            data.created_by || null,
            registryNumber,
            year,
            month,
            hasTreatments ? JSON.stringify(treatments) : null,
            data.appointment_date || null,
            data.tdr_result || null,
          ]);
      } else {
        throw err;
      }
    }

    const idRes = toObjects(d.exec('SELECT last_insert_rowid() as id'));
    const recordId = idRes[0]?.id;

    if (recordId && hasTreatments) {
      const deltas = new Map();
      treatments.forEach((t) => {
        const total = t.unit_price * t.quantity;
        d.run(
          'INSERT INTO record_medications (record_id, medication_id, item_type, medication_name, medication_unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [recordId, t.medication_id, t.item_type, t.name, t.unit || null, t.quantity, t.unit_price, total]
        );
        if (t.medication_id && t.item_type === 'medication') {
          deltas.set(Number(t.medication_id), (deltas.get(Number(t.medication_id)) || 0) - Number(t.quantity || 0));
        }
      });

      // Decrease stock for purchased medications (only if stock is tracked)
      applyMedicationStockDeltas(d, deltas);
    }

    d.run('COMMIT');
    saveDB();
    return recordId;
  } catch (e) {
    try { d.run('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

async function addTreatmentsToRecord(recordId, data) {
  const d = await getDB();

  if (ensureMedicalRecordsSchema(d)) {
    try { saveDB(); } catch { /* ignore */ }
  }

  const existingRows = toObjects(d.exec('SELECT * FROM medical_records WHERE id = ?', [recordId]));
  const existing = existingRows[0];
  if (!existing) throw new Error('Dossier existant introuvable.');

  let treatments = normalizeTreatments(data.treatments);
  if (!treatments.length && String(data.traitement || '').trim()) {
    treatments = treatmentsFromFreeText(d, data.traitement);
  }
  if (!treatments.length) throw new Error('Aucun traitement fourni.');

  const hasTreatments = treatments.length > 0;
  const visitCost = computeTotalCostAr(treatments);
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '');
  const dossierId = existing.dossier_id || null;
  const registryNumber = existing.registry_number || getRegistryNumberForRecord(d, existing, Number(existing.archive_year), Number(existing.archive_month), recordId);

  d.run('BEGIN');
  try {
    d.run(`INSERT INTO medical_records
      (category, dossier_id, patient_nom, patient_prenom, sexe, age, age_type, domicile, diagnostic, traitement, observation, cost, created_by, registry_number, archive_year, archive_month, treatments_json, appointment_date, tdr_result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        existing.category,
        dossierId,
        existing.patient_nom,
        existing.patient_prenom,
        existing.sexe || null,
        existing.age,
        existing.age_type || 'ans',
        existing.domicile,
        existing.diagnostic,
        traitementText || '',
        data.observation || existing.observation || '',
        visitCost,
        data.created_by || null,
        registryNumber,
        Number(existing.archive_year) || getArchiveFromDate(new Date()).year,
        Number(existing.archive_month) || getArchiveFromDate(new Date()).month,
        hasTreatments ? JSON.stringify(treatments) : null,
        existing.appointment_date || null,
        existing.tdr_result || null,
      ]);

    const idRes = toObjects(d.exec('SELECT last_insert_rowid() as id'))[0];
    const newRecordId = idRes[0]?.id || idRes?.id;

    if (newRecordId && hasTreatments) {
      const deltas = new Map();
      treatments.forEach((t) => {
        const total = (t.unit_price || 0) * (t.quantity || 0);
        d.run(
          'INSERT INTO record_medications (record_id, medication_id, item_type, medication_name, medication_unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [newRecordId, t.medication_id, t.item_type, t.name, t.unit || null, t.quantity, t.unit_price || 0, total]
        );
        if (t.medication_id && t.item_type === 'medication') {
          deltas.set(Number(t.medication_id), (deltas.get(Number(t.medication_id)) || 0) - Number(t.quantity || 0));
        }
      });
      if (deltas.size) applyMedicationStockDeltas(d, deltas);
    }

    d.run('COMMIT');
    saveDB();
    return true;
  } catch (e) {
    try { d.run('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

async function updateRecord(id, data) {
  const d = await getDB();

  if (ensureMedicalRecordsSchema(d)) {
    try { saveDB(); } catch { /* ignore */ }
  }
  let treatments = normalizeTreatments(data.treatments);
  if (!treatments.length && String(data.traitement || '').trim()) {
    treatments = treatmentsFromFreeText(d, data.traitement);
  }
  const hasTreatments = treatments.length > 0;
  const computedCost = hasTreatments ? computeTotalCostAr(treatments) : Number(data.cost) || 0;
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '');
  const existingRows = toObjects(d.exec(
    'SELECT category, archive_year, archive_month, registry_number FROM medical_records WHERE id = ?',
    [id]
  ));
  const existing = existingRows[0] || {};
  const recordCategory = data.category || existing.category;
  const recordYear = Number(existing.archive_year) || getArchiveFromDate(new Date()).year;
  const recordMonth = Number(existing.archive_month) || getArchiveFromDate(new Date()).month;
  const registryNumber = getRegistryNumberForRecord(
    d,
    { ...data, category: recordCategory },
    recordYear,
    recordMonth,
    id
  );

  d.run('BEGIN');
  try {
    // If treatments are being replaced, we must adjust stock by the diff (old -> new)
    let stockDeltas = null;
    if (data.treatments !== undefined) {
      stockDeltas = new Map();
      const oldRows = toObjects(d.exec(
        'SELECT medication_id, quantity FROM record_medications WHERE record_id = ? AND medication_id IS NOT NULL',
        [id]
      ));
      oldRows.forEach((r) => {
        const medId = Number(r.medication_id);
        const qty = Number(r.quantity) || 0;
        stockDeltas.set(medId, (stockDeltas.get(medId) || 0) + qty); // restock old qty
      });
      treatments.forEach((t) => {
        if (!t.medication_id || t.item_type !== 'medication') return;
        const medId = Number(t.medication_id);
        const qty = Number(t.quantity) || 0;
        stockDeltas.set(medId, (stockDeltas.get(medId) || 0) - qty); // consume new qty
      });
    }

    d.run(`UPDATE medical_records SET
      patient_nom=?, patient_prenom=?, sexe=?, age=?, age_type=?, domicile=?,
      diagnostic=?, traitement=?, observation=?, cost=?, registry_number=?, treatments_json=?, appointment_date=?, tdr_result=? WHERE id=?`,
      [
        data.patient_nom,
        data.patient_prenom,
        data.sexe || null,
        data.age,
        data.age_type || 'ans',
        data.domicile,
        data.diagnostic,
        traitementText || '',
        data.observation,
        computedCost,
        registryNumber,
        hasTreatments ? JSON.stringify(treatments) : null,
        data.appointment_date || null,
        data.tdr_result || null,
        id
      ]);

    // Replace medications for this record (if treatments are provided)
    if (data.treatments !== undefined) {
      d.run('DELETE FROM record_medications WHERE record_id = ?', [id]);
      if (hasTreatments) {
        treatments.forEach((t) => {
          const total = t.unit_price * t.quantity;
          d.run(
            'INSERT INTO record_medications (record_id, medication_id, item_type, medication_name, medication_unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, t.medication_id, t.item_type, t.name, t.unit || null, t.quantity, t.unit_price, total]
          );
        });
      }

      // Apply stock diff (restock old, consume new)
      if (stockDeltas) applyMedicationStockDeltas(d, stockDeltas);
    }

    d.run('COMMIT');
    saveDB();
  } catch (e) {
    try { d.run('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

async function deleteRecord(id) {
  const d = await getDB();
  d.run('BEGIN');
  try {
    d.run('DELETE FROM record_medications WHERE record_id = ?', [id]);
    d.run('DELETE FROM medical_records WHERE id = ?', [id]);
    d.run('COMMIT');
    saveDB();
  } catch (e) {
    try { d.run('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

// ── ARCHIVES ──────────────────────────────────────────
async function listArchives() {
  const d = await getDB();
  const rows = toObjects(d.exec(`
    SELECT archive_year as year, archive_month as month, COUNT(*) as count
    FROM medical_records
    WHERE archive_year IS NOT NULL AND archive_month IS NOT NULL
    GROUP BY archive_year, archive_month
    ORDER BY archive_year DESC, archive_month DESC
  `));
  return rows.map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    label: archiveLabelFr(Number(r.year), Number(r.month)),
    count: Number(r.count) || 0,
  }));
}

async function getCurrentArchive() {
  const { year, month } = getArchiveFromDate(new Date());
  return { year, month, label: archiveLabelFr(year, month) };
}

async function fetchAppointments() {
  const d = await getDB();
  return toObjects(d.exec(`
    SELECT id, category, patient_nom, patient_prenom, diagnostic, appointment_date, registry_number, tdr_result
    FROM medical_records
    WHERE appointment_date IS NOT NULL AND appointment_date != ''
    ORDER BY appointment_date ASC, patient_nom ASC
  `));
}

// ── MEDICATIONS ───────────────────────────────────────
async function listMedications() {
  const d = await getDB();
  const res = d.exec('SELECT id, name, item_type, price, unit, description, stock, stock_threshold, created_at, updated_at FROM medications ORDER BY name ASC');
  return toObjects(res);
}

async function createMedication(data) {
  const d = await getDB();
  if (ensureMedicationsSchema(d)) {
    try { saveDB(); } catch { /* ignore */ }
  }
  const stock = data.stock === '' || data.stock === undefined ? null : Number(data.stock);
  const itemType = data.item_type === 'act' ? 'act' : 'medication';
  const stockThreshold = data.stock_threshold === '' || data.stock_threshold === undefined
    ? 100
    : Number(data.stock_threshold);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(data.date || ''))
    ? `${data.date} 00:00:00`
    : null;

  d.run(
    'INSERT INTO medications (name, item_type, price, unit, description, stock, stock_threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)',
    [
      String(data.name || '').trim(),
      itemType,
      Number(data.price) || 0,
      itemType === 'act' ? null : (data.unit || 'comprimé'),
      data.description || null,
      itemType === 'act' ? null : stock,
      stockThreshold,
      date,
    ]
  );

  if (itemType === 'medication' && stock !== null && Number.isFinite(stock) && stock > 0) {
    const medication = d.exec('SELECT id FROM medications WHERE name = ?', [String(data.name || '').trim()]);
    const medicationId = medication[0]?.values?.[0]?.[0];
    d.run(
      'INSERT INTO medication_movements (medication_id, movement_type, quantity, created_at) VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))',
      [medicationId, 'entry', stock, date]
    );
  }
  saveDB();
}

async function updateMedication(id, data) {
  const d = await getDB();
  if (ensureMedicationsSchema(d)) {
    try { saveDB(); } catch { /* ignore */ }
  }
  d.run(
    'UPDATE medications SET name=?, item_type=?, price=?, unit=?, description=?, stock=?, stock_threshold=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [
      String(data.name || '').trim(),
      data.item_type === 'act' ? 'act' : 'medication',
      Number(data.price) || 0,
      data.item_type === 'act' ? null : (data.unit || 'comprimé'),
      data.description || null,
      data.item_type === 'act' ? null : (data.stock === '' || data.stock === undefined ? null : Number(data.stock)),
      data.stock_threshold === '' || data.stock_threshold === undefined ? 100 : Number(data.stock_threshold),
      id,
    ]
  );
  saveDB();
}

async function deleteMedication(id) {
  const d = await getDB();
  d.run('DELETE FROM medications WHERE id=?', [id]);
  saveDB();
}

async function addMedicationStock(id, quantity) {
  const d = await getDB();

  const qty = Number(quantity);

  if (!qty || qty <= 0) {
    throw new Error('Quantité invalide');
  }

  d.run(
    `
    UPDATE medications
    SET stock = COALESCE(stock,0) + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [qty, id]
  );

  d.run(
    `
    INSERT INTO medication_movements
    (
      medication_id,
      movement_type,
      quantity
    )
    VALUES (?, ?, ?)
    `,
    [id, 'entry', qty]
  );

  saveDB();
}

async function getMedicationMovements() {
  const d = await getDB();

  const res = d.exec(`
    SELECT
      mm.*,
      m.name as medication_name
    FROM medication_movements mm
    JOIN medications m
      ON m.id = mm.medication_id
    ORDER BY mm.created_at DESC
  `);

  return toObjects(res);
}

async function getTopSellingMedications() {
  const d = await getDB();

  const res = d.exec(`
    SELECT
      m.name as medication_name,
      SUM(mm.quantity) as total_sold
    FROM medication_movements mm
    JOIN medications m
      ON m.id = mm.medication_id
    WHERE mm.movement_type = 'exit'
    GROUP BY mm.medication_id, m.name
    ORDER BY total_sold DESC
    LIMIT 10
  `);

  return toObjects(res);
}

async function getLowStockMedications(limit = 10) {
  const d = await getDB();

  const res = d.exec(`
    SELECT *
    FROM medications
    WHERE stock IS NOT NULL
      AND stock <= COALESCE(stock_threshold, ?)
    ORDER BY stock ASC
  `, [limit]);

  return toObjects(res);
}

async function getStockReport() {
  const d = await getDB();

  const res = d.exec(`
    SELECT
      id,
      name,
      price,
      unit,
      stock,
      stock_threshold,
      description
    FROM medications
    ORDER BY name ASC
  `);

  return toObjects(res);
}

async function createDispensation(data) {
  const d = await getDB();
  const medId = Number(data.medication_id);
  const quantity = Number(data.quantity);

  const medRows = toObjects(d.exec('SELECT name, item_type, unit, stock, price FROM medications WHERE id = ?', [medId]));
  const med = medRows[0];
  if (!med) throw new Error('Médicament introuvable');
  if (med.item_type === 'act') throw new Error('Un acte médical ne peut pas être dispensé comme un médicament.');

  if (med.stock !== null && med.stock !== undefined && quantity > Number(med.stock)) {
    throw new Error(`Stock insuffisant. Disponible : ${med.stock}`);
  }

  d.run('BEGIN');
  try {
    d.run(
      'INSERT INTO dispensations (medication_id, medication_name, unit, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
      [medId, med.name, med.unit || 'comprimé', quantity, Number(med.price) || 0]
    );

    d.run(
      `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'exit', ?)`,
      [medId, quantity]
    );

    if (med.stock !== null && med.stock !== undefined) {
      d.run(
        'UPDATE medications SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, medId]
      );
    }

    d.run('COMMIT');
    saveDB();
    return true;
  } catch (e) {
    try { d.run('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

async function getDispensations() {
  const d = await getDB();
  const res = d.exec(`
    SELECT
      d.id,
      d.medication_id,
      d.medication_name,
      d.unit,
      d.quantity,
      d.unit_price,
      d.created_at
    FROM dispensations d
    ORDER BY d.created_at DESC
  `);
  return toObjects(res);
}

async function getDispensationTotal({ year, month } = {}) {
  const d = await getDB();
  const where = [];
  const params = [];
  if (year) { where.push("CAST(strftime('%Y', created_at) AS INTEGER) = ?"); params.push(Number(year)); }
  if (month) { where.push("CAST(strftime('%m', created_at) AS INTEGER) = ?"); params.push(Number(month)); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = d.exec(
    `SELECT COALESCE(SUM(unit_price * quantity), 0) as total FROM dispensations ${whereClause}`,
    params
  );
  const rows = toObjects(res);
  return Number(rows[0]?.total || 0);
}

async function deleteDispensation(id) {
  const d = await getDB();
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) throw new Error('ID invalide pour suppression.');

  const rows = toObjects(d.exec('SELECT medication_id, quantity FROM dispensations WHERE id = ?', [idNum]));
  const disp = rows[0];
  if (!disp) throw new Error('Dispensation introuvable');

  const medId = Number(disp.medication_id);
  const qty = Number(disp.quantity);

  d.run('BEGIN');
  try {
    d.run('DELETE FROM dispensations WHERE id = ?', [idNum]);

    if (Number.isFinite(medId) && medId > 0 && Number.isFinite(qty) && qty > 0) {
      d.run(
        `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'entry', ?)`,
        [medId, qty]
      );
      d.run(
        'UPDATE medications SET stock = COALESCE(stock, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [qty, medId]
      );
    }

    d.run('COMMIT');
    saveDB();
    return true;
  } catch (e) {
    try { d.run('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

async function updateDispensation(id, data) {
  const d = await getDB();
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) throw new Error('ID invalide.');
  if (!data || !Number.isFinite(Number(data.medication_id)) || !Number.isFinite(Number(data.quantity))) {
    throw new Error('Données invalides pour la modification.');
  }

  const newMedicationId = Number(data.medication_id);
  const newQuantity = Number(data.quantity);
  if (newMedicationId <= 0 || newQuantity <= 0) throw new Error('Valeurs invalides.');

  const oldRows = toObjects(d.exec('SELECT * FROM dispensations WHERE id = ?', [idNum]));
  const old = oldRows[0];
  if (!old) throw new Error('Dispensation introuvable');

  const oldMedicationId = Number(old.medication_id);
  const oldQuantity = Number(old.quantity);

  const medRows = toObjects(d.exec('SELECT name, unit, price, stock FROM medications WHERE id = ?', [newMedicationId]));
  const med = medRows[0];
  if (!med) throw new Error('Médicament introuvable.');

  const unitPrice = Number(med.price);
  if (!Number.isFinite(unitPrice)) throw new Error('Prix du médicament invalide.');

  let availableStock = Number(med.stock ?? 0);
  if (!Number.isFinite(availableStock)) availableStock = 0;

  if (oldMedicationId === newMedicationId && Number.isFinite(oldQuantity)) {
    availableStock += oldQuantity;
  }

  if (newQuantity > availableStock) {
    throw new Error(`Stock insuffisant pour "${med.name}". Disponible : ${availableStock}`);
  }

  d.run('BEGIN');
  try {
    if (oldMedicationId !== newMedicationId) {
      const oldQty = Number.isFinite(oldQuantity) && oldQuantity > 0 ? oldQuantity : 0;
      if (oldQty > 0) {
        d.run(
          'UPDATE medications SET stock = COALESCE(stock, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [oldQty, oldMedicationId]
        );
        d.run(
          `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'entry', ?)`,
          [oldMedicationId, oldQty]
        );
      }

      d.run(
        'UPDATE medications SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, newMedicationId]
      );
      d.run(
        `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'exit', ?)`,
        [newMedicationId, newQuantity]
      );
    } else {
      const diff = newQuantity - (Number.isFinite(oldQuantity) ? oldQuantity : 0);
      if (diff !== 0) {
        const moveType = diff > 0 ? 'exit' : 'entry';
        d.run(
          'UPDATE medications SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [diff, newMedicationId]
        );
        d.run(
          `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, ?, ?)`,
          [newMedicationId, moveType, Math.abs(diff)]
        );
      }
    }

    d.run(
      'UPDATE dispensations SET medication_id = ?, medication_name = ?, unit = ?, quantity = ?, unit_price = ? WHERE id = ?',
      [newMedicationId, String(med.name), String(med.unit || 'comprimé'), newQuantity, unitPrice, idNum]
    );

    d.run('COMMIT');
    saveDB();
    return true;
  } catch (e) {
    try { d.run('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

async function ensureRegistryNumbers() {
  const d = await getDB();
  try {
    backfillRegistryNumbers(d);
    saveDB();
    return true;
  } catch (e) {
    console.error('ensureRegistryNumbers error:', e);
    throw e;
  }
}

module.exports = {
   loginUser, registerUser,
   getAllUsers, toggleUserActive, resetUserPassword, deleteUser,
  fetchRecords, fetchRecordsByArchive, fetchRecordById, fetchRecordsByDossier, fetchAppointments, fetchStats, fetchStatsByArchive, createRecord, updateRecord, deleteRecord,
   listArchives, getCurrentArchive,
   listMedications, createMedication, updateMedication, deleteMedication,
   addMedicationStock,
   getMedicationMovements,
   getTopSellingMedications,
   getLowStockMedications,
   ensureRegistryNumbers,
   getStockReport,
   listDossiers, getDossierById,
   addTreatmentsToRecord,
   createDispensation,
   getDispensations,
   getDispensationTotal,
   deleteDispensation,
   updateDispensation
 };
