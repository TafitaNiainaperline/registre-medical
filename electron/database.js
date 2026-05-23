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
      archive_year INTEGER,
      archive_month INTEGER,
      treatments_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL,
      description TEXT,
      stock INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS record_medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      medication_id INTEGER,
      medication_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      total INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_medical_records_archive ON medical_records(archive_year, archive_month);
    CREATE INDEX IF NOT EXISTS idx_medical_records_category_archive ON medical_records(category, archive_year, archive_month);
    CREATE INDEX IF NOT EXISTS idx_record_medications_record_id ON record_medications(record_id);
  `);

  // Migration : ajouter colonnes manquantes si ancienne DB
  const migrations = [
    `ALTER TABLE medical_records ADD COLUMN age_type TEXT DEFAULT 'ans'`,
    `ALTER TABLE medical_records ADD COLUMN sexe TEXT`,
    `ALTER TABLE medical_records ADD COLUMN archive_year INTEGER`,
    `ALTER TABLE medical_records ADD COLUMN archive_month INTEGER`,
    `ALTER TABLE medical_records ADD COLUMN treatments_json TEXT`,
    `ALTER TABLE users ADD COLUMN username TEXT`,
    `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`,
    `ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 0`,
  ];
  let schemaChanged = false;
  migrations.forEach(sql => {
    try { db.run(sql); schemaChanged = true; } catch { /* déjà existant */ }
  });

  // Self-heal schema in case a migration was skipped on some machines
  try {
    schemaChanged = ensureMedicalRecordsSchema(db) || schemaChanged;
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
    ensureCol('archive_year', 'ALTER TABLE medical_records ADD COLUMN archive_year INTEGER');
    ensureCol('archive_month', 'ALTER TABLE medical_records ADD COLUMN archive_month INTEGER');
    ensureCol('treatments_json', 'ALTER TABLE medical_records ADD COLUMN treatments_json TEXT');
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
    if (!Number.isFinite(id) || !Number.isFinite(change) || change === 0) return;

    // stock is optional (NULL means "not tracked")
    d.run(
      `UPDATE medications
       SET stock = CASE
         WHEN stock IS NULL THEN NULL
         ELSE MAX(stock + ?, 0)
       END,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [change, id]
    );
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
      quantity: Number(m.quantity) || 0,
      unit_price: Number(m.unit_price) || 0,
      total: Number(m.total) || 0,
    });
  });

  return records.map((r) => ({ ...r, treatments: byRecord.get(r.id) || null }));
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
    .map(t => `${t.name} x${Number(t.quantity)}`)
    .join(', ');
}

function normalizeTreatments(treatments) {
  if (!Array.isArray(treatments)) return [];
  return treatments
    .filter(t => t && typeof t.name === 'string')
    .map(t => ({
      medication_id: t.medication_id ?? null,
      name: String(t.name).trim(),
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

  const treatments = normalizeTreatments(data.treatments);
  const hasTreatments = treatments.length > 0;
  const computedCost = hasTreatments ? computeTotalCostAr(treatments) : Number(data.cost) || 0;
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '');

  d.run('BEGIN');
  try {
    try {
      d.run(`INSERT INTO medical_records
      (category, patient_nom, patient_prenom, sexe, age, age_type, domicile, diagnostic, traitement, observation, cost, created_by, archive_year, archive_month, treatments_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        year,
        month,
        hasTreatments ? JSON.stringify(treatments) : null,
      ]);
    } catch (err) {
      // Retry once after auto-migration (handles "no column named sexe")
      if (String(err?.message || '').includes('no column named')) {
        if (ensureMedicalRecordsSchema(d)) {
          try { saveDB(); } catch { /* ignore */ }
        }
        d.run(`INSERT INTO medical_records
          (category, patient_nom, patient_prenom, sexe, age, age_type, domicile, diagnostic, traitement, observation, cost, created_by, archive_year, archive_month, treatments_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            year,
            month,
            hasTreatments ? JSON.stringify(treatments) : null,
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
          'INSERT INTO record_medications (record_id, medication_id, medication_name, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)',
          [recordId, t.medication_id, t.name, t.quantity, t.unit_price, total]
        );
        if (t.medication_id) {
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

async function updateRecord(id, data) {
  const d = await getDB();

  if (ensureMedicalRecordsSchema(d)) {
    try { saveDB(); } catch { /* ignore */ }
  }
  const treatments = normalizeTreatments(data.treatments);
  const hasTreatments = treatments.length > 0;
  const computedCost = hasTreatments ? computeTotalCostAr(treatments) : Number(data.cost) || 0;
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '');

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
        if (!t.medication_id) return;
        const medId = Number(t.medication_id);
        const qty = Number(t.quantity) || 0;
        stockDeltas.set(medId, (stockDeltas.get(medId) || 0) - qty); // consume new qty
      });
    }

    d.run(`UPDATE medical_records SET
      patient_nom=?, patient_prenom=?, sexe=?, age=?, age_type=?, domicile=?,
      diagnostic=?, traitement=?, observation=?, cost=?, treatments_json=? WHERE id=?`,
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
        hasTreatments ? JSON.stringify(treatments) : null,
        id
      ]);

    // Replace medications for this record (if treatments are provided)
    if (data.treatments !== undefined) {
      d.run('DELETE FROM record_medications WHERE record_id = ?', [id]);
      if (hasTreatments) {
        treatments.forEach((t) => {
          const total = t.unit_price * t.quantity;
          d.run(
            'INSERT INTO record_medications (record_id, medication_id, medication_name, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)',
            [id, t.medication_id, t.name, t.quantity, t.unit_price, total]
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
    // Restock medications used by this record (only if stock is tracked)
    const deltas = new Map();
    const oldRows = toObjects(d.exec(
      'SELECT medication_id, quantity FROM record_medications WHERE record_id = ? AND medication_id IS NOT NULL',
      [id]
    ));
    oldRows.forEach((r) => {
      const medId = Number(r.medication_id);
      const qty = Number(r.quantity) || 0;
      deltas.set(medId, (deltas.get(medId) || 0) + qty);
    });
    applyMedicationStockDeltas(d, deltas);

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

// ── MEDICATIONS ───────────────────────────────────────
async function listMedications() {
  const d = await getDB();
  const res = d.exec('SELECT id, name, price, description, stock, created_at, updated_at FROM medications ORDER BY name ASC');
  return toObjects(res);
}

async function createMedication(data) {
  const d = await getDB();
  d.run(
    'INSERT INTO medications (name, price, description, stock, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [
      String(data.name || '').trim(),
      Number(data.price) || 0,
      data.description || null,
      data.stock === '' || data.stock === undefined ? null : Number(data.stock),
    ]
  );
  saveDB();
}

async function updateMedication(id, data) {
  const d = await getDB();
  d.run(
    'UPDATE medications SET name=?, price=?, description=?, stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [
      String(data.name || '').trim(),
      Number(data.price) || 0,
      data.description || null,
      data.stock === '' || data.stock === undefined ? null : Number(data.stock),
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

module.exports = {
  loginUser, registerUser,
  getAllUsers, toggleUserActive, resetUserPassword, deleteUser,
  fetchRecords, fetchRecordsByArchive, fetchStats, fetchStatsByArchive, createRecord, updateRecord, deleteRecord,
  listArchives, getCurrentArchive,
  listMedications, createMedication, updateMedication, deleteMedication
};
