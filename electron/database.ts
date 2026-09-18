import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'
import initSqlJs from 'sql.js'
import type { Database, QueryExecResult, SqlValue } from 'sql.js'
import { app } from 'electron'
import { appointmentDateError } from './appointmentDate'
import { validateBackup } from './backup'
import { auditActor, exportWithAudit, installAudit, queryAudit, registerAuditFunctions } from './audit'
import type {
  Appointment,
  Archive,
  ArchiveFilters,
  AuditFilters,
  AuthUser,
  CashOutflow,
  CashOutflowInput,
  CategoryKey,
  CategoryStats,
  ContinueRecordInput,
  Dispensation,
  DispensationInput,
  Dossier,
  LoginInput,
  MedicalRecord,
  Medication,
  MedicationHistoryEntry,
  MedicationInput,
  MedicationMovement,
  MovementType,
  Patient,
  PatientAddressEntry,
  PatientInput,
  PatientMatch,
  PeriodFilters,
  RecordInput,
  RecordUpdateInput,
  RegisterInput,
  StockHistoryEntry,
  StockReportRow,
  TopSellingMedication,
  Treatment,
  TreatmentInput,
  UserRow,
} from './types'

// Ligne SQL brute : le typage des colonnes est une assertion de frontière
type Row = Record<string, SqlValue>

type BindValue = SqlValue

// Sous-ensemble de colonnes utilisé pour reconnaître un médicament saisi en texte libre
type MedicationLookup = Pick<Medication, 'id' | 'name' | 'item_type' | 'price' | 'unit' | 'stock'>

// Champs suffisants pour identifier un couple patient / maladie
type RegistryLookupSource = { category: CategoryKey; patient_id?: number | null }

let db: Database | null = null
let dbPath: string | null = null

function getArchiveFromDate(date: Date | string): { year: number; month: number } {
  const d = date instanceof Date ? date : new Date(date)
  const month = d.getMonth() + 1 // 1-12
  const year = d.getFullYear()
  return { year, month }
}

function archiveLabelFr(year: number, month: number): string {
  const date = new Date(year, Math.max(0, month - 1), 1)
  const monthName = date.toLocaleString('fr-FR', { month: 'long' })
  const label = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`
  return label
}

// ── ÂGE ───────────────────────────────────────────────
// On ne connaît que le mois et l'année de naissance : l'âge est recalculé
// à la date de chaque consultation, il ne devient donc jamais faux.

function ageMonthsAt(birthDate: string | null | undefined, at: string | Date): number | null {
  if (!birthDate) return null
  const [year, month] = String(birthDate).split('-').map(Number)
  if (!year || !month) return null
  const visit = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(visit.getTime())) return null
  const months = (visit.getFullYear() - year) * 12 + (visit.getMonth() + 1 - month)
  return months < 0 ? 0 : months
}

// « 32 ans », « 7 mois », « Nouveau-né »
function formatAge(months: number | null): string {
  if (months === null) return ''
  if (months < 1) return 'Nouveau-né'
  if (months < 24) return `${months} mois`
  const years = Math.floor(months / 12)
  return `${years} ${years > 1 ? 'ans' : 'an'}`
}

// Reconstitue un mois de naissance depuis un âge saisi autrefois (« 32|ans|| »)
function birthDateFromLegacyAge(stored: string | null | undefined, at: string): string | null {
  const value = String(stored || '')
  if (!value) return null

  let months: number | null = null
  if (value.includes('|')) {
    const [amount, unit, days] = value.split('|')
    const num = Number(amount) || 0
    if (unit === 'ans') months = num * 12
    else if (unit === 'mois') months = num
    else if (unit === 'mois_jours') months = num + Math.round((Number(days) || 0) / 30)
    else if (unit === 'jours') months = 0
  } else {
    const [amount, unit] = value.split(' ')
    const num = Number(amount) || 0
    if (unit?.startsWith('an')) months = num * 12
    else if (unit === 'mois') months = num
    else if (unit?.startsWith('jour')) months = 0
  }
  if (months === null) return null

  const reference = new Date(at)
  if (Number.isNaN(reference.getTime())) return null
  const birth = new Date(reference.getFullYear(), reference.getMonth() - months, 1)
  return `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-01`
}

async function getDB(): Promise<Database> {
  if (db) return db

  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')

  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  dbPath = path.join(app.getPath('userData'), 'registre-medical.db')

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  registerAuditFunctions(db)
  initTables(db)
  const schemaChanged = ensureMedicalRecordsSchema(db) || ensureMedicationsSchema(db) || ensureDispensationsSchema(db)
  if (schemaChanged) {
    try { saveDB() } catch { /* ignore */ }
  }

  installAudit(db)
  saveDB()
  return db
}

function saveDB(): void {
  if (!db || !dbPath) return
  const data = exportWithAudit(db)
  fs.writeFileSync(dbPath, Buffer.from(data))
}

async function runAudited<T>(userId: number, action: () => Promise<T>): Promise<T> {
  const d = await getDB()
  const user = toObjects<{ id: number; name: string }>(d.exec('SELECT id, name FROM users WHERE id = ? AND is_active = 1', [userId]))[0]
  if (!user) throw new Error('Veuillez vous reconnecter pour enregistrer cette modification.')
  return auditActor.run(user, action)
}

async function listAudit(filters: AuditFilters = {}) {
  return queryAudit(await getDB(), filters)
}

async function assertBackupAdmin(userId: number): Promise<void> {
  if (!userId) throw new Error('Veuillez vous reconnecter avec un compte administrateur pour gérer les sauvegardes.')
  const d = await getDB()
  if (!d.exec("SELECT id FROM users WHERE id = ? AND role = 'admin' AND is_active = 1", [userId])[0]?.values.length) {
    throw new Error('Seul un administrateur connecté peut gérer les sauvegardes.')
  }
}

async function exportDatabase(destination: string): Promise<void> {
  const d = await getDB()
  if (path.resolve(destination).toLowerCase() === path.resolve(dbPath!).toLowerCase()) {
    throw new Error('Choisissez un autre emplacement que la base utilisée par l’application.')
  }
  const temporary = `${destination}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`
  try {
    fs.writeFileSync(temporary, Buffer.from(exportWithAudit(d)))
    fs.renameSync(temporary, destination)
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    throw error
  }
}

async function readBackup(source: string): Promise<Database> {
  const wasmPath = app.isPackaged ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')
  const SQL = await initSqlJs({ locateFile: () => wasmPath })
  let candidate: Database | undefined
  try {
    candidate = new SQL.Database(fs.readFileSync(source))
    validateBackup(candidate)
    installAudit(candidate)
    return candidate
  } catch {
    candidate?.close()
    throw new Error('Fichier de sauvegarde invalide, incomplet ou endommagé. Les données actuelles sont conservées.')
  }
}

async function restoreDatabase(candidate: Database): Promise<string> {
  const current = await getDB()
  validateBackup(candidate)
  const tables = current.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")[0]?.values || []
  for (const [name] of tables) {
    const table = String(name).replace(/"/g, '""')
    const candidateColumns = new Set(candidate.exec(`PRAGMA table_info("${table}")`)[0]?.values.map((row) => String(row[1])))
    const columns = current.exec(`PRAGMA table_info("${table}")`)[0]?.values || []
    if (columns.some((row) => !candidateColumns.has(String(row[1])))) {
      throw new Error('Cette sauvegarde est incompatible avec cette version de l’application. Les données actuelles sont conservées.')
    }
  }
  const directory = path.join(app.getPath('userData'), 'backups')
  fs.mkdirSync(directory, { recursive: true })
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(16).slice(2)}`
  const previousPath = path.join(directory, `avant-restauration-${stamp}.db`)
  fs.writeFileSync(previousPath, Buffer.from(exportWithAudit(current)))
  const temporary = `${dbPath!}.${stamp}.tmp`
  try {
    fs.writeFileSync(temporary, Buffer.from(exportWithAudit(candidate)))
    fs.renameSync(temporary, dbPath!)
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    throw error
  }
  db = candidate
  current.close()
  return previousPath
}

function initTables(d: Database): void {
  d.run(`
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
       patient_id INTEGER,
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
      reference TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );

     CREATE TABLE IF NOT EXISTS patients (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       patient_number TEXT,
       nom TEXT NOT NULL,
       prenom TEXT,
       sexe TEXT,
       domicile TEXT,
       phone TEXT,
       birth_date TEXT,
       birth_estimated INTEGER NOT NULL DEFAULT 0,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME
     );

     CREATE TABLE IF NOT EXISTS patient_address_log (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       patient_id INTEGER NOT NULL,
       domicile TEXT,
       created_by INTEGER,
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

     CREATE INDEX IF NOT EXISTS idx_patients_number ON patients(patient_number);
     CREATE INDEX IF NOT EXISTS idx_patient_address_log ON patient_address_log(patient_id);
     CREATE INDEX IF NOT EXISTS idx_medical_records_archive ON medical_records(archive_year, archive_month);
     CREATE INDEX IF NOT EXISTS idx_medical_records_category_archive ON medical_records(category, archive_year, archive_month);
     CREATE INDEX IF NOT EXISTS idx_record_medications_record_id ON record_medications(record_id);
     CREATE INDEX IF NOT EXISTS idx_medication_movements_medication_id ON medication_movements(medication_id);
     CREATE INDEX IF NOT EXISTS idx_medication_movements_created_at ON medication_movements(created_at);

     CREATE TABLE IF NOT EXISTS cash_outflows (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       outflow_date DATE NOT NULL,
       designation TEXT NOT NULL,
       amount INTEGER NOT NULL,
       created_by INTEGER,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     );
     CREATE INDEX IF NOT EXISTS idx_cash_outflows_date ON cash_outflows(outflow_date);
   `)

  // Migration : ajouter colonnes manquantes si ancienne DB
  const migrations = [
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
    `ALTER TABLE medical_records ADD COLUMN pf_method TEXT`,
    `ALTER TABLE medical_records ADD COLUMN cpn_type TEXT`,
    `ALTER TABLE medical_records ADD COLUMN reference TEXT`,
    `ALTER TABLE medical_records ADD COLUMN patient_id INTEGER`,
    `ALTER TABLE dossiers ADD COLUMN patient_id INTEGER`,
    `ALTER TABLE patients ADD COLUMN phone TEXT`,
    `ALTER TABLE patients ADD COLUMN birth_date TEXT`,
    `ALTER TABLE patients ADD COLUMN birth_estimated INTEGER NOT NULL DEFAULT 0`,
  ]
  let schemaChanged = false
  migrations.forEach((sql) => {
    try { d.run(sql); schemaChanged = true } catch { /* déjà existant */ }
  })

  // Self-heal schema in case a migration was skipped on some machines
  try {
    schemaChanged = ensureMedicalRecordsSchema(d) || schemaChanged
    schemaChanged = ensureMedicationsSchema(d) || schemaChanged
  } catch {
    /* ignore */
  }

  // Backfill archive_year/month pour les anciennes lignes (si null)
  try {
    const rows = toObjects<{ id: number; created_at: string | null }>(
      d.exec('SELECT id, created_at FROM medical_records WHERE archive_year IS NULL OR archive_month IS NULL')
    )
    rows.forEach((r) => {
      const { year, month } = getArchiveFromDate(r.created_at || new Date())
      d.run('UPDATE medical_records SET archive_year = ?, archive_month = ? WHERE id = ?', [year, month, r.id])
    })
  } catch {
    /* ignore */
  }

  try {
    backfillRegistryNumbers(d)
  } catch (e) {
    console.error('backfillRegistryNumbers error:', e)
  }

  try {
    backfillDossiers(d)
  } catch (e) {
    console.error('backfillDossiers error:', e)
  }

  // L'index ne peut être posé qu'une fois la colonne ajoutée par les migrations
  try {
    d.run('CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id)')
  } catch { /* colonne pas encore présente */ }

  try {
    backfillPatients(d)
  } catch (e) {
    console.error('backfillPatients error:', e)
  }

  // Les données d'identité vivent désormais sur la fiche patient : on retire
  // les copies portées par chaque dossier, une fois la migration faite.
  const duplicated = ['patient_nom', 'patient_prenom', 'sexe', 'age', 'age_type', 'domicile']
  const linked = toObjects<{ total: number }>(
    d.exec('SELECT COUNT(*) AS total FROM medical_records WHERE patient_id IS NULL')
  )[0]
  if (!linked || Number(linked.total) === 0) {
    duplicated.forEach((column) => {
      try { d.run(`ALTER TABLE medical_records DROP COLUMN ${column}`); schemaChanged = true } catch { /* déjà retirée */ }
    })
  }

  // Persist schema changes so they survive app restart
  if (schemaChanged) {
    try { saveDB() } catch { /* ignore */ }
  }

  // Admin par défaut
  const res = d.exec("SELECT id FROM users WHERE username = 'admin'")
  if (!res.length || !res[0].values.length) {
    const hash = bcrypt.hashSync('admin123', 10)
    d.run('INSERT INTO users (username, name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'Administrateur', hash, 'admin', 1])
    saveDB()
  }
}

function toObjects<T = Row>(result: QueryExecResult[]): T[] {
  if (!result.length) return []
  const { columns, values } = result[0]
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]])) as T
  )
}

function registryPrefix(category: CategoryKey | string): string {
  const prefixes: Record<string, string> = {
    consultation: 'CONS',
    cpn: 'CPN',
    pf: 'PF',
    analyse: 'ANA',
    soin: 'SO',
  }
  return prefixes[category] || String(category || 'REG').slice(0, 4).toUpperCase()
}

function nextDossierNumber(d: Database): string {
  const rows = toObjects<{ dossier_number: string | null }>(
    d.exec(`SELECT dossier_number FROM dossiers WHERE dossier_number IS NOT NULL`)
  )
  const maxSeq = rows.reduce((max, row) => {
    const match = String(row.dossier_number || '').match(/-(\d+)$/)
    const value = match ? Number(match[1]) : 0
    return Number.isFinite(value) && value > max ? value : max
  }, 0)
  return `DOS-${String(maxSeq + 1).padStart(4, '0')}`
}

// Épisode de soin : un patient et une pathologie, suivis dans la durée
function getOrCreateDossier(d: Database, patientId: number, diagnosticRaw: string): Dossier | undefined {
  const diagnostic = String(diagnosticRaw || '').trim()
  const rows = toObjects<Dossier>(
    d.exec('SELECT * FROM dossiers WHERE patient_id = ? AND LOWER(diagnostic) = ? LIMIT 1', [patientId, diagnostic.toLowerCase()])
  )
  if (rows && rows[0]) return rows[0]

  const patient = toObjects<Patient>(d.exec('SELECT * FROM patients WHERE id = ?', [patientId]))[0]
  const number = nextDossierNumber(d)
  d.run('INSERT INTO dossiers (dossier_number, patient_id, patient_nom, diagnostic) VALUES (?, ?, ?, ?)',
    [number, patientId, patient?.nom || '', diagnostic])
  const idRes = toObjects<{ id: number }>(d.exec('SELECT last_insert_rowid() as id'))[0]
  const id = idRes?.id
  const created = toObjects<Dossier>(d.exec('SELECT * FROM dossiers WHERE id = ?', [id]))[0]
  return created
}

async function listDossiers(search: string): Promise<Dossier[]> {
  const d = await getDB()
  const where: string[] = []
  const params: BindValue[] = []
  if (search) {
    where.push('(LOWER(patient_nom) LIKE ? OR LOWER(diagnostic) LIKE ? OR LOWER(dossier_number) LIKE ?)')
    const q = `%${String(search).toLowerCase()}%`
    params.push(q, q, q)
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const res = d.exec(`SELECT * FROM dossiers ${whereClause} ORDER BY id DESC`, params)
  return toObjects<Dossier>(res)
}

async function getDossierById(id: number): Promise<Dossier | null> {
  const d = await getDB()
  const rows = toObjects<Dossier>(d.exec('SELECT * FROM dossiers WHERE id = ?', [id]))
  return rows[0] || null
}

// Regroupe les médicaments d'une liste de dossiers par identifiant de dossier
function treatmentsByRecord(d: Database, ids: number[]): Map<number, Treatment[]> {
  const byRecord = new Map<number, Treatment[]>()
  if (!ids.length) return byRecord

  let medsRows: Row[]
  try {
    medsRows = toObjects(d.exec(`SELECT * FROM record_medications WHERE record_id IN (${ids.join(',')})`))
  } catch {
    medsRows = []
  }

  medsRows.forEach((m) => {
    const recordId = Number(m.record_id)
    const list = byRecord.get(recordId) || []
    list.push({
      medication_id: m.medication_id === null || m.medication_id === undefined ? null : Number(m.medication_id),
      item_type: m.item_type === 'act' ? 'act' : 'medication',
      name: String(m.medication_name),
      unit: m.medication_unit ? String(m.medication_unit) : null,
      quantity: Number(m.quantity) || 0,
      unit_price: Number(m.unit_price) || 0,
      total: Number(m.total) || 0,
    })
    byRecord.set(recordId, list)
  })

  return byRecord
}

function parseTreatmentsJson(value: string | null): Treatment[] | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as Treatment[]) : null
  } catch {
    return null
  }
}

async function fetchRecordsByDossier(dossierId: number): Promise<MedicalRecord[]> {
  const d = await getDB()
  const rows = toObjects<MedicalRecord>(
    d.exec(`${RECORD_SELECT} WHERE mr.dossier_id = ? ORDER BY mr.created_at ASC`, [dossierId])
  )
  const ids = rows.map((r) => r.id)
  if (!ids.length) return rows

  const byRecord = treatmentsByRecord(d, ids)

  return rows.map((r) => decorateRecord({
    ...r,
    treatments: byRecord.get(r.id) || parseTreatmentsJson(r.treatments_json),
  }))
}

// Règle de numérotation : un même patient a UN numéro de dossier par registre
// et par mois, quelle que soit la pathologie. Le mois suivant en ouvre un nouveau.
function monthlyDossierKey(patientId: number | null | undefined, category: CategoryKey, year: number, month: number): string {
  return `${patientId ?? 'x'}|${category}|${year}|${month}`
}

function nextRegistryNumber(d: Database, category: CategoryKey, year: number): string {
  const prefix = registryPrefix(category)
  const rows = toObjects<{ registry_number: string | null }>(d.exec(
    `SELECT registry_number FROM medical_records
     WHERE category = ? AND archive_year = ?
       AND registry_number IS NOT NULL`,
    [category, year]
  ))
  const maxSeq = rows.reduce((max, row) => {
    const match = String(row.registry_number || '').match(/-(\d+)$/)
    const value = match ? Number(match[1]) : 0
    return Number.isFinite(value) && value > max ? value : max
  }, 0)
  return `${prefix}-${year}-${String(maxSeq + 1).padStart(3, '0')}`
}

// Dossier déjà ouvert ce mois-ci pour ce patient dans ce registre
function findMonthlyDossier(
  d: Database,
  patientId: number | null | undefined,
  category: CategoryKey,
  year: number,
  month: number,
  existingId: number | null = null
): Pick<MedicalRecord, 'id' | 'registry_number' | 'diagnostic' | 'dossier_id'> | null {
  if (!patientId) return null
  const rows = toObjects<Pick<MedicalRecord, 'id' | 'registry_number' | 'diagnostic' | 'dossier_id'>>(d.exec(
    `SELECT id, registry_number, diagnostic, dossier_id
     FROM medical_records
     WHERE patient_id = ? AND category = ? AND archive_year = ? AND archive_month = ?
     ORDER BY id ASC`,
    [patientId, category, year, month]
  ))
  return rows.find((row) => Number(row.id) !== Number(existingId)) || null
}

function getRegistryNumberForRecord(
  d: Database,
  data: RegistryLookupSource,
  year: number,
  month: number,
  existingId: number | null = null
): string {
  const opened = findMonthlyDossier(d, data.patient_id, data.category, year, month, existingId)
  if (opened?.registry_number) return opened.registry_number

  if (existingId) {
    const current = toObjects<{ registry_number: string | null }>(
      d.exec('SELECT registry_number FROM medical_records WHERE id = ?', [existingId])
    )[0]
    if (current?.registry_number) return current.registry_number
  }

  return nextRegistryNumber(d, data.category, year)
}

function backfillRegistryNumbers(d: Database): boolean {
  const rows = toObjects<Pick<MedicalRecord, 'id' | 'category' | 'patient_id' | 'archive_year' | 'archive_month' | 'registry_number'>>(d.exec(`
    SELECT id, category, patient_id, archive_year, archive_month, registry_number
    FROM medical_records
    WHERE archive_year IS NOT NULL AND archive_month IS NOT NULL
    ORDER BY archive_year ASC, archive_month ASC, category ASC, id ASC
  `))
  let changed = false
  const assigned = new Map<string, string>()

  rows.forEach((row) => {
    const key = monthlyDossierKey(row.patient_id, row.category, Number(row.archive_year), Number(row.archive_month))
    if (row.registry_number) {
      assigned.set(key, row.registry_number)
      return
    }

    const number = assigned.get(key) || nextRegistryNumber(d, row.category, Number(row.archive_year))
    assigned.set(key, number)
    d.run('UPDATE medical_records SET registry_number = ? WHERE id = ?', [number, row.id])
    changed = true
  })

  return changed
}

function backfillDossiers(d: Database): boolean {
  const columns = new Set(toObjects<{ name: string }>(d.exec('PRAGMA table_info(medical_records)')).map((c) => c.name))
  if (!columns.has('patient_nom')) return false

  // Find distinct patient+diagnostic tuples without dossier_id and create dossiers
  const rows = toObjects<{ patient_nom: string; diagnostic: string }>(d.exec(`
    SELECT DISTINCT patient_nom, diagnostic
    FROM medical_records
    WHERE dossier_id IS NULL
  `))
  if (!rows.length) return false
  let changed = false
  rows.forEach((r) => {
    try {
      const patient = r.patient_nom || ''
      const diagnostic = r.diagnostic || ''
      // create dossier
      const number = nextDossierNumber(d)
      d.run('INSERT INTO dossiers (dossier_number, patient_nom, diagnostic) VALUES (?, ?, ?)', [number, patient, diagnostic])
      const idRes = toObjects<{ id: number }>(d.exec('SELECT last_insert_rowid() as id'))[0]
      const id = idRes?.id
      if (id) {
        d.run('UPDATE medical_records SET dossier_id = ? WHERE LOWER(patient_nom)=? AND LOWER(diagnostic)=?', [id, String(patient).toLowerCase(), String(diagnostic).toLowerCase()])
        changed = true
      }
    } catch {
      // ignore per-row failures
    }
  })
  return changed
}

// ── PATIENTS ──────────────────────────────────────────

// Similarité de deux chaînes, tolérante aux fautes de frappe.
// Coefficient de Dice sur les bigrammes, complété par la distance d'édition
// pour rester juste sur les mots très courts.
function similarity(a: string, b: string): number {
  const left = normalizeMedicationName(a)
  const right = normalizeMedicationName(b)
  if (!left || !right) return 0
  if (left === right) return 1

  const bigrams = (value: string): string[] => {
    const parts: string[] = []
    for (let i = 0; i < value.length - 1; i++) parts.push(value.slice(i, i + 2))
    return parts
  }

  const dice = (): number => {
    const first = bigrams(left)
    const second = bigrams(right)
    if (!first.length || !second.length) return 0
    const pool = [...second]
    let hits = 0
    first.forEach((gram) => {
      const index = pool.indexOf(gram)
      if (index >= 0) { hits++; pool.splice(index, 1) }
    })
    return (2 * hits) / (first.length + second.length)
  }

  const levenshtein = (): number => {
    const rows = left.length + 1
    const cols = right.length + 1
    let previous = Array.from({ length: cols }, (_, i) => i)
    for (let i = 1; i < rows; i++) {
      const current = [i]
      for (let j = 1; j < cols; j++) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
      }
      previous = current
    }
    return 1 - previous[cols - 1] / Math.max(left.length, right.length)
  }

  // Saisie partielle : « Rakoto » doit remonter « Rakotoarisoa Jean »
  const containment = (): number => {
    const [short, long] = left.length <= right.length ? [left, right] : [right, left]
    if (!long.includes(short)) return 0
    const ratio = short.length / long.length
    return long.startsWith(short) ? 0.8 + 0.2 * ratio : 0.7 + 0.2 * ratio
  }

  // Nom et prénom peuvent être saisis dans l'ordre inverse
  const wordOverlap = (): number => {
    const first = left.split(' ').filter(Boolean)
    const second = right.split(' ').filter(Boolean)
    if (!first.length || !second.length) return 0
    const scores = first.map((word) => Math.max(...second.map((other) => (
      word === other ? 1 : (other.startsWith(word) || word.startsWith(other)) ? 0.85 : 0
    ))))
    return scores.reduce((sum, value) => sum + value, 0) / first.length
  }

  return Math.max(dice(), levenshtein(), containment(), wordOverlap())
}

// Un patient est identifié par son nom ET son adresse
function patientScore(patient: Patient, nom: string, domicile?: string | null): number {
  const nameScore = similarity(`${patient.nom} ${patient.prenom || ''}`, nom)
  if (!domicile || !patient.domicile) return Math.round(nameScore * 100)
  const addressScore = similarity(patient.domicile, domicile)
  return Math.round((nameScore * 0.7 + addressScore * 0.3) * 100)
}

function nextPatientNumber(d: Database): string {
  const rows = toObjects<{ patient_number: string | null }>(
    d.exec(`SELECT patient_number FROM patients WHERE patient_number IS NOT NULL`)
  )
  const maxSeq = rows.reduce((max, row) => {
    const match = String(row.patient_number || '').match(/-(\d+)$/)
    const value = match ? Number(match[1]) : 0
    return Number.isFinite(value) && value > max ? value : max
  }, 0)
  return `PAT-${String(maxSeq + 1).padStart(4, '0')}`
}

function createPatientRow(d: Database, data: PatientInput): Patient {
  d.run(
    'INSERT INTO patients (patient_number, nom, prenom, sexe, domicile, phone, birth_date, birth_estimated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      nextPatientNumber(d),
      String(data.nom || '').trim(),
      data.prenom ? String(data.prenom).trim() : null,
      data.sexe || null,
      data.domicile ? String(data.domicile).trim() : null,
      data.phone ? String(data.phone).trim() : null,
      data.birth_date || null,
      data.birth_estimated ? 1 : 0,
    ]
  )
  const id = toObjects<{ id: number }>(d.exec('SELECT last_insert_rowid() as id'))[0]?.id
  const patient = toObjects<Patient>(d.exec('SELECT * FROM patients WHERE id = ?', [id]))[0]
  if (patient.domicile) {
    d.run('INSERT INTO patient_address_log (patient_id, domicile, created_by) VALUES (?, ?, ?)',
      [patient.id, patient.domicile, data.created_by || null])
  }
  return patient
}

// Candidats classés par score, pour que l'utilisateur confirme lui-même
async function searchSimilarPatients(nom: string, domicile?: string | null, minScore = 55): Promise<PatientMatch[]> {
  const d = await getDB()
  if (!String(nom || '').trim()) return []
  return toObjects<Patient>(d.exec('SELECT * FROM patients'))
    .map((patient) => ({ patient, score: patientScore(patient, nom, domicile) }))
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}

async function listPatients(search = ''): Promise<Patient[]> {
  const d = await getDB()
  const rows = toObjects<Patient>(d.exec('SELECT * FROM patients ORDER BY nom ASC'))
  const query = normalizeMedicationName(search)
  if (!query) return rows
  return rows.filter((patient) => (
    normalizeMedicationName(`${patient.nom} ${patient.prenom || ''} ${patient.domicile || ''}`).includes(query)
    || String(patient.patient_number || '').toLowerCase().includes(query)
    || String(patient.phone || '').includes(query)
    || patientScore(patient, search) >= 70
  ))
}

async function getPatientById(id: number): Promise<Patient | null> {
  const d = await getDB()
  return toObjects<Patient>(d.exec('SELECT * FROM patients WHERE id = ?', [id]))[0] || null
}

async function createPatient(data: PatientInput): Promise<Patient> {
  const d = await getDB()
  if (!String(data.nom || '').trim()) throw new Error('Le nom du patient est requis.')
  const patient = createPatientRow(d, data)
  saveDB()
  return patient
}

// Toute modification d'adresse est historisée
async function updatePatient(id: number, data: PatientInput): Promise<void> {
  const d = await getDB()
  const nom = String(data.nom || '').trim()
  if (!nom) throw new Error('Le nom du patient est requis.')

  const current = toObjects<Patient>(d.exec('SELECT * FROM patients WHERE id = ?', [id]))[0]
  if (!current) throw new Error('Patient introuvable.')

  const domicile = data.domicile ? String(data.domicile).trim() : null
  d.run(
    `UPDATE patients SET nom = ?, prenom = ?, sexe = ?, domicile = ?, phone = ?, birth_date = ?, birth_estimated = ?,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [
      nom,
      data.prenom ? String(data.prenom).trim() : null,
      data.sexe || null,
      domicile,
      data.phone ? String(data.phone).trim() : null,
      data.birth_date || null,
      data.birth_estimated ? 1 : 0,
      id,
    ]
  )

  if (domicile && domicile !== current.domicile) {
    d.run('INSERT INTO patient_address_log (patient_id, domicile, created_by) VALUES (?, ?, ?)',
      [id, domicile, data.created_by || null])
  }
  saveDB()
}

// Dossier médical complet d'un patient, tous registres confondus, plus récent d'abord
async function fetchRecordsByPatient(patientId: number): Promise<MedicalRecord[]> {
  const d = await getDB()
  const records = toObjects<MedicalRecord>(
    d.exec(`${RECORD_SELECT} WHERE mr.patient_id = ? ORDER BY mr.created_at DESC, mr.id DESC`, [patientId])
  )
  if (!records.length) return records

  const byRecord = treatmentsByRecord(d, records.map((r) => r.id))
  return records.map((r) => decorateRecord({
    ...r,
    treatments: byRecord.get(r.id) || parseTreatmentsJson(r.treatments_json),
  }))
}

async function getPatientAddressLog(patientId: number): Promise<PatientAddressEntry[]> {
  const d = await getDB()
  return toObjects<PatientAddressEntry>(d.exec(`
    SELECT l.id, l.patient_id, l.domicile, l.created_at, u.name AS created_by_name
    FROM patient_address_log l
    LEFT JOIN users u ON u.id = l.created_by
    WHERE l.patient_id = ?
    ORDER BY l.created_at DESC, l.id DESC
  `, [patientId]))
}

// Reprise des dossiers antérieurs à la table patients
function backfillPatients(d: Database): boolean {
  const columns = new Set(toObjects<{ name: string }>(d.exec('PRAGMA table_info(medical_records)')).map((c) => c.name))
  if (!columns.has('patient_nom')) return false

  const rows = toObjects<{
    id: number; patient_nom: string; patient_prenom: string | null
    sexe: string | null; domicile: string | null; age: string | null; created_at: string
  }>(d.exec(`
    SELECT id, patient_nom, patient_prenom, sexe, domicile, age, created_at
    FROM medical_records
    WHERE patient_id IS NULL
    ORDER BY created_at ASC, id ASC
  `))
  if (!rows.length) return false

  const existing = toObjects<Patient>(d.exec('SELECT * FROM patients'))
  const byKey = new Map<string, Patient>()
  existing.forEach((patient) => byKey.set(
    `${normalizeMedicationName(patient.nom)}|${normalizeMedicationName(patient.domicile)}`, patient))

  rows.forEach((row) => {
    const key = `${normalizeMedicationName(row.patient_nom)}|${normalizeMedicationName(row.domicile)}`
    let patient = byKey.get(key)
    if (!patient) {
      patient = createPatientRow(d, {
        nom: row.patient_nom,
        prenom: row.patient_prenom,
        sexe: row.sexe,
        domicile: row.domicile,
        // Reconstitué depuis l'âge saisi à l'époque : mois de naissance approché
        birth_date: birthDateFromLegacyAge(row.age, row.created_at),
        birth_estimated: true,
      })
      byKey.set(key, patient)
    }
    d.run('UPDATE medical_records SET patient_id = ? WHERE id = ?', [patient.id, row.id])
  })

  try {
    const dossiers = toObjects<{ id: number; patient_nom: string }>(
      d.exec('SELECT id, patient_nom FROM dossiers WHERE patient_id IS NULL')
    )
    const patients = toObjects<Patient>(d.exec('SELECT * FROM patients'))
    dossiers.forEach((dossier) => {
      const match = patients.find((patient) =>
        normalizeMedicationName(patient.nom) === normalizeMedicationName(dossier.patient_nom))
      if (match) d.run('UPDATE dossiers SET patient_id = ? WHERE id = ?', [match.id, dossier.id])
    })
  } catch { /* colonne absente sur une base très ancienne */ }

  return true
}

// ── AUTH ──────────────────────────────────────────────
async function loginUser({ username, password }: LoginInput): Promise<AuthUser> {
  const d = await getDB()
  const res = d.exec('SELECT * FROM users WHERE username = ?', [username])
  const users = toObjects<UserRow & { password_hash: string }>(res)
  if (!users.length) throw new Error('Pseudo introuvable')
  if (!users[0].is_active) throw new Error('Compte non activé. Contactez l\'administrateur.')
  if (!bcrypt.compareSync(password, users[0].password_hash)) throw new Error('Mot de passe incorrect')
  return { id: users[0].id, name: users[0].name, username: users[0].username, role: users[0].role }
}

async function registerUser({ username, name, password }: RegisterInput): Promise<{ username: string; name: string }> {
  const d = await getDB()
  const res = d.exec('SELECT id FROM users WHERE username = ?', [username])
  if (toObjects(res).length) throw new Error('Ce pseudo est déjà utilisé')
  const hash = bcrypt.hashSync(password, 10)
  d.run('INSERT INTO users (username, name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
    [username, name, hash, 'user', 0])
  saveDB()
  return { username, name }
}

// ── GESTION UTILISATEURS (admin) ──────────────────────
async function getAllUsers(): Promise<UserRow[]> {
  const d = await getDB()
  const res = d.exec('SELECT id, username, name, role, is_active, created_at FROM users ORDER BY created_at DESC')
  return toObjects<UserRow>(res)
}

async function toggleUserActive(id: number, isActive: boolean): Promise<void> {
  const d = await getDB()
  d.run('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id])
  saveDB()
}

async function resetUserPassword(id: number, newPassword: string): Promise<void> {
  const d = await getDB()
  const hash = bcrypt.hashSync(newPassword, 10)
  d.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id])
  saveDB()
}

async function deleteUser(id: number): Promise<void> {
  const d = await getDB()
  d.run('DELETE FROM users WHERE id = ? AND role != "admin"', [id])
  saveDB()
}

// ── RECORDS ───────────────────────────────────────────
async function fetchRecords(category: CategoryKey): Promise<MedicalRecord[]> {
  const d = await getDB()
  const res = d.exec(`${RECORD_SELECT} WHERE mr.category = ? ORDER BY mr.created_at DESC, mr.id DESC`, [category])
  const records = toObjects<MedicalRecord>(res)

  const ids = records.map((r) => r.id)
  if (!ids.length) return records

  const byRecord = treatmentsByRecord(d, ids)

  return records.map((r) => decorateRecord({
    ...r,
    treatments: byRecord.get(r.id) || parseTreatmentsJson(r.treatments_json),
  }))
}

function ensureMedicalRecordsSchema(d: Database): boolean {
  try {
    const info = toObjects<{ name: string }>(d.exec('PRAGMA table_info(medical_records)'))
    const cols = new Set(info.map((r) => r.name))
    let changed = false
    const ensureCol = (name: string, ddl: string): void => {
      if (!cols.has(name)) {
        try { d.run(ddl); changed = true } catch { /* ignore */ }
      }
    }
    ensureCol('registry_number', 'ALTER TABLE medical_records ADD COLUMN registry_number TEXT')
    ensureCol('archive_year', 'ALTER TABLE medical_records ADD COLUMN archive_year INTEGER')
    ensureCol('archive_month', 'ALTER TABLE medical_records ADD COLUMN archive_month INTEGER')
    ensureCol('treatments_json', 'ALTER TABLE medical_records ADD COLUMN treatments_json TEXT')
    ensureCol('appointment_date', 'ALTER TABLE medical_records ADD COLUMN appointment_date TEXT')
    ensureCol('tdr_result', 'ALTER TABLE medical_records ADD COLUMN tdr_result TEXT')
    ensureCol('pf_method', 'ALTER TABLE medical_records ADD COLUMN pf_method TEXT')
    ensureCol('cpn_type', 'ALTER TABLE medical_records ADD COLUMN cpn_type TEXT')
    ensureCol('reference', 'ALTER TABLE medical_records ADD COLUMN reference TEXT')
    ensureCol('patient_id', 'ALTER TABLE medical_records ADD COLUMN patient_id INTEGER')

    return changed
  } catch {
    return false
  }
}

function ensureMedicationsSchema(d: Database): boolean {
  try {
    const info = toObjects<{ name: string }>(d.exec('PRAGMA table_info(medications)'))
    const cols = new Set(info.map((r) => r.name))
    let changed = false

    const ensureCol = (name: string, ddl: string): void => {
      if (!cols.has(name)) {
        try { d.run(ddl); changed = true } catch { /* ignore */ }
      }
    }

    ensureCol('unit', "ALTER TABLE medications ADD COLUMN unit TEXT DEFAULT 'comprimé'")
    ensureCol('stock_threshold', 'ALTER TABLE medications ADD COLUMN stock_threshold INTEGER DEFAULT 100')
    ensureCol('item_type', "ALTER TABLE medications ADD COLUMN item_type TEXT NOT NULL DEFAULT 'medication'")
    ensureCol('created_by', 'ALTER TABLE medications ADD COLUMN created_by INTEGER')

    let medsChanged = changed
    try {
      const info2 = toObjects<{ name: string }>(d.exec('PRAGMA table_info(medication_movements)'))
      const cols2 = new Set(info2.map((r) => r.name))
      if (!cols2.has('created_by')) {
        d.run('ALTER TABLE medication_movements ADD COLUMN created_by INTEGER')
        medsChanged = true
      }
    } catch { /* ignore */ }

    return changed || medsChanged
  } catch {
    return false
  }
}

function ensureDispensationsSchema(d: Database): boolean {
  try {
    const info = toObjects<{ name: string }>(d.exec('PRAGMA table_info(dispensations)'))
    const cols = new Set(info.map((r) => r.name))
    let changed = false

    const ensureCol = (name: string, ddl: string): void => {
      if (!cols.has(name)) {
        try { d.run(ddl); changed = true } catch { /* ignore */ }
      }
    }

    ensureCol('unit_price', 'ALTER TABLE dispensations ADD COLUMN unit_price INTEGER')

    return changed
  } catch {
    return false
  }
}

function applyMedicationStockDeltas(d: Database, deltaByMedicationId: Map<number, number> | null): void {
  if (!deltaByMedicationId) return
  const entries = Array.from(deltaByMedicationId.entries())

  entries.forEach(([medId, delta]) => {
    const id = Number(medId)
    const change = Number(delta)
    if (!Number.isFinite(id) || !Number.isFinite(change) || change >= 0) return

    const rows = toObjects<{ name: string; stock: number | null }>(d.exec('SELECT name, stock FROM medications WHERE id = ?', [id]))
    const med = rows[0]
    if (!med || med.stock === null || med.stock === undefined) return

    const currentStock = Number(med.stock)
    if (Number.isFinite(currentStock) && currentStock + change < 0) {
      throw new Error(`Stock insuffisant pour "${med.name}". Disponible : ${currentStock}. Demandé : ${Math.abs(change)}.`)
    }
  })

  entries.forEach(([medId, delta]) => {
    const id = Number(medId)
    const change = Number(delta)
    if (!Number.isFinite(id) || !Number.isFinite(change) || change === 0) return

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
    )

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
      )
    }
  })
}

// Les données d'identité ne sont plus stockées dans le dossier : elles viennent
// de la fiche patient, et l'âge est recalculé à la date de la consultation.
const RECORD_SELECT = `
  SELECT mr.*,
         p.nom AS patient_nom, p.prenom AS patient_prenom, p.sexe AS sexe,
         p.domicile AS domicile, p.phone AS patient_phone,
         p.patient_number AS patient_number, p.birth_date AS birth_date
  FROM medical_records mr
  LEFT JOIN patients p ON p.id = mr.patient_id
`

// Complète un dossier lu en base : âge calculé et traitements
function decorateRecord(record: MedicalRecord): MedicalRecord {
  const age_months = ageMonthsAt(record.birth_date, record.created_at)
  return { ...record, age_months, age: formatAge(age_months) }
}

async function fetchRecordsByArchive({ category, year, month, search }: ArchiveFilters): Promise<MedicalRecord[]> {
  const d = await getDB()
  const where: string[] = []
  const params: BindValue[] = []
  if (category) { where.push('mr.category = ?'); params.push(category) }
  if (year) { where.push('mr.archive_year = ?'); params.push(year) }
  if (month) { where.push('mr.archive_month = ?'); params.push(month) }
  if (search) {
    where.push('(LOWER(p.nom) LIKE ? OR LOWER(p.prenom) LIKE ?)')
    const q = `%${String(search).toLowerCase()}%`
    params.push(q, q)
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  // Les dossiers les plus récents d'abord
  const res = d.exec(`${RECORD_SELECT} ${whereClause} ORDER BY mr.created_at DESC, mr.id DESC`, params)
  const records = toObjects<MedicalRecord>(res)
  const ids = records.map((r) => r.id)
  if (!ids.length) return records

  const byRecord = treatmentsByRecord(d, ids)

  return records.map((r) => decorateRecord({ ...r, treatments: byRecord.get(r.id) || null }))
}

async function fetchRecordById(id: number): Promise<MedicalRecord | null> {
  const d = await getDB()
  const records = toObjects<MedicalRecord>(d.exec(`
    ${RECORD_SELECT} WHERE mr.id = ?
  `, [id]))
  const record = records[0]
  if (!record) return null

  let medsRows: Row[] = []
  try {
    medsRows = toObjects(d.exec('SELECT * FROM record_medications WHERE record_id = ?', [id]))
  } catch {
    /* ignore */
  }

  const treatments: Treatment[] = medsRows.map((m) => ({
    medication_id: m.medication_id === null || m.medication_id === undefined ? null : Number(m.medication_id),
    item_type: m.item_type === 'act' ? 'act' : 'medication',
    name: String(m.medication_name),
    unit: m.medication_unit ? String(m.medication_unit) : null,
    quantity: Number(m.quantity) || 0,
    unit_price: Number(m.unit_price) || 0,
    total: Number(m.total) || 0,
  }))

  return decorateRecord({ ...record, treatments: treatments.length ? treatments : parseTreatmentsJson(record.treatments_json) })
}

async function fetchStats(): Promise<CategoryStats> {
  const d = await getDB()
  const res = d.exec('SELECT category, COUNT(*) as count FROM medical_records GROUP BY category')
  const rows = toObjects<{ category: string; count: number }>(res)
  const stats: CategoryStats = {}
  rows.forEach((r) => { stats[r.category] = r.count })
  return stats
}

async function fetchStatsByArchive({ year, month }: PeriodFilters = {}): Promise<CategoryStats> {
  const d = await getDB()
  if (!year || !month) return fetchStats()
  const res = d.exec(
    'SELECT category, COUNT(*) as count FROM medical_records WHERE archive_year = ? AND archive_month = ? GROUP BY category',
    [Number(year), Number(month)]
  )
  const rows = toObjects<{ category: string; count: number }>(res)
  const stats: CategoryStats = {}
  rows.forEach((r) => { stats[r.category] = r.count })
  return stats
}

function buildTraitementText(treatments: Treatment[]): string {
  if (!Array.isArray(treatments) || treatments.length === 0) return ''
  return treatments
    .filter((t) => t && t.name && Number(t.quantity) > 0)
    .map((t) => t.item_type === 'act'
      ? t.name
      : `${t.name} x${Number(t.quantity)}${t.unit ? ` ${t.unit}` : ''}`)
    .join(', ')
}

function normalizeMedicationName(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function findMedicationFromText(text: string, medications: MedicationLookup[]): MedicationLookup | null {
  const wanted = normalizeMedicationName(text)
  const candidates = medications
    .map((med) => ({ med, normalized: normalizeMedicationName(med.name) }))
    .filter(({ normalized }) => normalized)

  const exact = candidates.find(({ normalized }) => normalized === wanted)
  if (exact) return exact.med

  const prefixMatches = candidates
    .filter(({ normalized }) => wanted.startsWith(`${normalized} `))
    .sort((a, b) => b.normalized.length - a.normalized.length)

  return prefixMatches[0]?.med || null
}

function parseTreatmentTextPart(
  part: string,
  medications: MedicationLookup[]
): { med: MedicationLookup | null; quantity: number; unitOk: boolean } {
  const text = String(part || '').trim()
  const med = findMedicationFromText(text, medications)
  if (!text || !med) return { med: null, quantity: 1, unitOk: true }

  const normalizedText = normalizeMedicationName(text)
  const normalizedName = normalizeMedicationName(med.name)
  let rest = normalizedText.slice(normalizedName.length).trim()
  let quantity = 1

  if (rest) {
    const qtyMatch = rest.match(/^(?:x\s*)?(\d+)\s*(.*)$/i)
    if (qtyMatch) {
      quantity = Number(qtyMatch[1]) || 1
      rest = String(qtyMatch[2] || '').trim()
    } else if (rest.startsWith('x')) {
      const afterX = rest.slice(1).trim()
      const xMatch = afterX.match(/^(\d+)\s*(.*)$/)
      if (xMatch) {
        quantity = Number(xMatch[1]) || 1
        rest = String(xMatch[2] || '').trim()
      }
    }
  }

  const expectedUnit = normalizeMedicationName(med.unit || '')
  const writtenUnit = normalizeMedicationName(rest).replace(/s$/, '')
  const expectedUnitSingular = expectedUnit.replace(/s$/, '')
  const unitOk = !writtenUnit || !expectedUnit || writtenUnit === expectedUnitSingular

  return { med, quantity, unitOk }
}

function treatmentsFromFreeText(d: Database, text: string): Treatment[] {
  const parts = String(text || '')
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!parts.length) return []

  const medications = toObjects<MedicationLookup>(
    d.exec('SELECT id, name, item_type, price, unit, stock FROM medications ORDER BY name ASC')
  )
  const byMedicationId = new Map<string, Treatment>()
  const unknown: string[] = []
  const wrongUnits: string[] = []

  parts.forEach((part) => {
    const parsed = parseTreatmentTextPart(part, medications)
    const med = parsed.med
    if (!med) {
      unknown.push(part)
      return
    }
    if (!parsed.unitOk) {
      wrongUnits.push(`${med.name} (${med.unit || 'unité'})`)
      return
    }

    const id = String(med.id)
    const quantity = Math.max(1, Number(parsed.quantity) || 1)
    const current = byMedicationId.get(id)
    if (current) {
      current.quantity += quantity
    } else {
      byMedicationId.set(id, {
        medication_id: med.id,
        item_type: med.item_type === 'act' ? 'act' : 'medication',
        name: med.name,
        unit: med.item_type === 'act' ? null : (med.unit || null),
        quantity,
        unit_price: Number(med.price) || 0,
      })
    }
  })

  if (unknown.length) {
    throw new Error(`Médicament non disponible dans le stock : ${unknown.join(', ')}. Utilisez le nom enregistré, par exemple : Cerum x2 sachet.`)
  }

  if (wrongUnits.length) {
    throw new Error(`Unité incorrecte. Utilisez l'unité enregistrée : ${wrongUnits.join(', ')}.`)
  }

  return Array.from(byMedicationId.values())
}

function normalizeTreatments(treatments: TreatmentInput[] | undefined): Treatment[] {
  if (!Array.isArray(treatments)) return []
  return treatments
    .filter((t) => t && typeof t.name === 'string')
    .map((t) => ({
      medication_id: t.medication_id === null || t.medication_id === undefined ? null : Number(t.medication_id),
      item_type: (t.item_type === 'act' ? 'act' : 'medication') as Treatment['item_type'],
      name: String(t.name).trim(),
      unit: t.unit ? String(t.unit).trim() : null,
      quantity: Math.max(0, parseInt(String(t.quantity), 10) || 0),
      unit_price: Math.max(0, parseInt(String(t.unit_price), 10) || 0),
    }))
    .filter((t) => t.name && t.quantity > 0)
}

function computeTotalCostAr(treatments: Treatment[]): number {
  return normalizeTreatments(treatments).reduce((sum, t) => sum + (t.unit_price * t.quantity), 0)
}

function setRegistryPatientSex(d: Database, category: string | undefined, patientId: number | null | undefined): void {
  if ((category === 'cpn' || category === 'pf') && patientId) {
    d.run("UPDATE patients SET sexe = 'F', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(sexe, '') <> 'F'", [patientId])
  }
}

async function createRecord(data: RecordInput): Promise<number | undefined> {
  if (!String(data.diagnostic || '').trim()) throw new Error('Le diagnostic est requis.')
  const dateError = appointmentDateError(data.appointment_date)
  if (dateError) throw new Error(dateError)
  const d = await getDB()

  // Defensive: older DB may miss columns (ex: "sexe")
  if (ensureMedicalRecordsSchema(d)) {
    try { saveDB() } catch { /* ignore */ }
  }
  const now = new Date()
  const { year, month } = data.archive_year && data.archive_month
    ? { year: Number(data.archive_year), month: Number(data.archive_month) }
    : getArchiveFromDate(now)

  if (!data.patient_id) throw new Error('Aucun patient sélectionné pour ce dossier.')

  try {
    const dossier = getOrCreateDossier(d, data.patient_id, data.diagnostic)
    if (dossier?.id) data.dossier_id = dossier.id
  } catch (e) {
    console.error('getOrCreateDossier error:', e)
  }

  let treatments = normalizeTreatments(data.treatments)
  if (!treatments.length && String(data.traitement || '').trim()) {
    treatments = treatmentsFromFreeText(d, data.traitement || '')
  }
  const hasTreatments = treatments.length > 0
  const computedCost = hasTreatments ? computeTotalCostAr(treatments) : Number(data.cost) || 0
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '')
  const registryNumber = getRegistryNumberForRecord(d, data, year, month)

  d.run('BEGIN')
  try {
    setRegistryPatientSex(d, data.category, data.patient_id)
    d.run(`INSERT INTO medical_records
      (category, dossier_id, patient_id, diagnostic, traitement, observation, cost, created_by, registry_number, archive_year, archive_month, treatments_json, appointment_date, tdr_result, pf_method, cpn_type, reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.category,
          data.dossier_id || null,
          data.patient_id || null,
          data.diagnostic,
          traitementText || '',
          data.observation ?? null,
          computedCost,
          data.created_by || null,
          registryNumber,
          year,
          month,
          hasTreatments ? JSON.stringify(treatments) : null,
          data.appointment_date || null,
          data.tdr_result || null,
          data.pf_method || null,
          data.cpn_type || null,
        data.reference || null,
      ])

    const idRes = toObjects<{ id: number }>(d.exec('SELECT last_insert_rowid() as id'))
    const recordId = idRes[0]?.id

    if (recordId && hasTreatments) {
      const deltas = new Map<number, number>()
      treatments.forEach((t) => {
        const total = t.unit_price * t.quantity
        d.run(
          'INSERT INTO record_medications (record_id, medication_id, item_type, medication_name, medication_unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [recordId, t.medication_id, t.item_type, t.name, t.unit || null, t.quantity, t.unit_price, total]
        )
        if (t.medication_id && t.item_type === 'medication') {
          deltas.set(Number(t.medication_id), (deltas.get(Number(t.medication_id)) || 0) - Number(t.quantity || 0))
        }
      })

      // Decrease stock for purchased medications (only if stock is tracked)
      applyMedicationStockDeltas(d, deltas)
    }

    d.run('COMMIT')
    saveDB()
    return recordId
  } catch (e) {
    try { d.run('ROLLBACK') } catch { /* ignore */ }
    throw e
  }
}

async function addTreatmentsToRecord(recordId: number, data: ContinueRecordInput): Promise<boolean> {
  const d = await getDB()

  if (ensureMedicalRecordsSchema(d)) {
    try { saveDB() } catch { /* ignore */ }
  }

  const existingRows = toObjects<MedicalRecord>(d.exec('SELECT * FROM medical_records WHERE id = ?', [recordId]))
  const existing = existingRows[0]
  if (!existing) throw new Error('Dossier existant introuvable.')

  let treatments = normalizeTreatments(data.treatments)
  if (!treatments.length && String(data.traitement || '').trim()) {
    treatments = treatmentsFromFreeText(d, data.traitement || '')
  }
  if (!treatments.length) throw new Error('Aucun traitement fourni.')

  const hasTreatments = treatments.length > 0
  const visitCost = computeTotalCostAr(treatments)
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '')
  const dossierId = existing.dossier_id || null
  const registryNumber = existing.registry_number
    || getRegistryNumberForRecord(d, existing, Number(existing.archive_year), Number(existing.archive_month), recordId)

  d.run('BEGIN')
  try {
    setRegistryPatientSex(d, existing.category, existing.patient_id)
    d.run(`INSERT INTO medical_records
      (category, dossier_id, patient_id, diagnostic, traitement, observation, cost, created_by, registry_number, archive_year, archive_month, treatments_json, appointment_date, tdr_result, pf_method, cpn_type, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        existing.category,
        dossierId,
        existing.patient_id || null,
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
        existing.pf_method || null,
        existing.cpn_type || null,
        existing.reference || null,
      ])

    const newRecordId = toObjects<{ id: number }>(d.exec('SELECT last_insert_rowid() as id'))[0]?.id

    if (newRecordId && hasTreatments) {
      const deltas = new Map<number, number>()
      treatments.forEach((t) => {
        const total = (t.unit_price || 0) * (t.quantity || 0)
        d.run(
          'INSERT INTO record_medications (record_id, medication_id, item_type, medication_name, medication_unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [newRecordId, t.medication_id, t.item_type, t.name, t.unit || null, t.quantity, t.unit_price || 0, total]
        )
        if (t.medication_id && t.item_type === 'medication') {
          deltas.set(Number(t.medication_id), (deltas.get(Number(t.medication_id)) || 0) - Number(t.quantity || 0))
        }
      })
      if (deltas.size) applyMedicationStockDeltas(d, deltas)
    }

    d.run('COMMIT')
    saveDB()
    return true
  } catch (e) {
    try { d.run('ROLLBACK') } catch { /* ignore */ }
    throw e
  }
}

async function updateRecord(id: number, data: RecordUpdateInput): Promise<void> {
  if (!String(data.diagnostic || '').trim()) throw new Error('Le diagnostic est requis.')
  const dateError = appointmentDateError(data.appointment_date)
  if (dateError) throw new Error(dateError)
  const d = await getDB()

  if (ensureMedicalRecordsSchema(d)) {
    try { saveDB() } catch { /* ignore */ }
  }
  let treatments = normalizeTreatments(data.treatments)
  if (!treatments.length && String(data.traitement || '').trim()) {
    treatments = treatmentsFromFreeText(d, data.traitement || '')
  }
  const hasTreatments = treatments.length > 0
  const computedCost = hasTreatments ? computeTotalCostAr(treatments) : Number(data.cost) || 0
  const traitementText = hasTreatments ? buildTraitementText(treatments) : (data.traitement || '')
  const patientId = data.patient_id ?? null
  const existingRows = toObjects<Pick<MedicalRecord, 'category' | 'archive_year' | 'archive_month' | 'registry_number' | 'patient_id'>>(d.exec(
    'SELECT category, archive_year, archive_month, registry_number, patient_id FROM medical_records WHERE id = ?',
    [id]
  ))
  const existing = existingRows[0]
  const recordCategory = data.category || existing?.category
  const recordYear = Number(existing?.archive_year) || getArchiveFromDate(new Date()).year
  const recordMonth = Number(existing?.archive_month) || getArchiveFromDate(new Date()).month
  const registryNumber = getRegistryNumberForRecord(
    d,
    { ...data, category: recordCategory, patient_id: patientId ?? existing?.patient_id ?? null },
    recordYear,
    recordMonth,
    id
  )


  d.run('BEGIN')
  try {
    setRegistryPatientSex(d, existing?.category, patientId ?? existing?.patient_id)
    // If treatments are being replaced, we must adjust stock by the diff (old -> new)
    let stockDeltas: Map<number, number> | null = null
    if (data.treatments !== undefined) {
      stockDeltas = new Map<number, number>()
      const oldRows = toObjects<{ medication_id: number; quantity: number }>(d.exec(
        'SELECT medication_id, quantity FROM record_medications WHERE record_id = ? AND medication_id IS NOT NULL',
        [id]
      ))
      oldRows.forEach((r) => {
        const medId = Number(r.medication_id)
        const qty = Number(r.quantity) || 0
        stockDeltas?.set(medId, (stockDeltas.get(medId) || 0) + qty) // restock old qty
      })
      treatments.forEach((t) => {
        if (!t.medication_id || t.item_type !== 'medication') return
        const medId = Number(t.medication_id)
        const qty = Number(t.quantity) || 0
        stockDeltas?.set(medId, (stockDeltas.get(medId) || 0) - qty) // consume new qty
      })
    }

    d.run(`UPDATE medical_records SET
      diagnostic=?, traitement=?, observation=?, cost=?, registry_number=?, treatments_json=?, appointment_date=?, tdr_result=?, pf_method=?, cpn_type=?, reference=?,
      patient_id=COALESCE(?, patient_id) WHERE id=?`,
      [
        data.diagnostic,
        traitementText || '',
        data.observation ?? null,
        computedCost,
        registryNumber,
        hasTreatments ? JSON.stringify(treatments) : null,
        data.appointment_date || null,
        data.tdr_result || null,
        data.pf_method || null,
        data.cpn_type || null,
        data.reference || null,
        patientId,
        id
      ])

    // Replace medications for this record (if treatments are provided)
    if (data.treatments !== undefined) {
      d.run('DELETE FROM record_medications WHERE record_id = ?', [id])
      if (hasTreatments) {
        treatments.forEach((t) => {
          const total = t.unit_price * t.quantity
          d.run(
            'INSERT INTO record_medications (record_id, medication_id, item_type, medication_name, medication_unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, t.medication_id, t.item_type, t.name, t.unit || null, t.quantity, t.unit_price, total]
          )
        })
      }

      // Apply stock diff (restock old, consume new)
      if (stockDeltas) applyMedicationStockDeltas(d, stockDeltas)
    }

    d.run('COMMIT')
    saveDB()
  } catch (e) {
    try { d.run('ROLLBACK') } catch { /* ignore */ }
    throw e
  }
}

async function deleteRecord(id: number): Promise<void> {
  const d = await getDB()
  d.run('BEGIN')
  try {
    d.run('DELETE FROM record_medications WHERE record_id = ?', [id])
    d.run('DELETE FROM medical_records WHERE id = ?', [id])
    d.run('COMMIT')
    saveDB()
  } catch (e) {
    try { d.run('ROLLBACK') } catch { /* ignore */ }
    throw e
  }
}

async function clearAppointment(id: number): Promise<void> {
  const d = await getDB()
  d.run('UPDATE medical_records SET appointment_date = NULL WHERE id = ?', [id])
  saveDB()
}

// ── ARCHIVES ──────────────────────────────────────────
async function listArchives(): Promise<Archive[]> {
  const d = await getDB()
  const rows = toObjects<{ year: number; month: number; count: number }>(d.exec(`
    SELECT archive_year as year, archive_month as month, COUNT(*) as count
    FROM medical_records
    WHERE archive_year IS NOT NULL AND archive_month IS NOT NULL
    GROUP BY archive_year, archive_month
    ORDER BY archive_year DESC, archive_month DESC
  `))
  return rows.map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    label: archiveLabelFr(Number(r.year), Number(r.month)),
    count: Number(r.count) || 0,
  }))
}

async function getCurrentArchive(): Promise<Archive> {
  const { year, month } = getArchiveFromDate(new Date())
  return { year, month, label: archiveLabelFr(year, month) }
}

async function fetchAppointments(): Promise<Appointment[]> {
  const d = await getDB()
  return toObjects<Appointment>(d.exec(`
    SELECT mr.id, mr.category, p.nom AS patient_nom, p.prenom AS patient_prenom,
           mr.diagnostic, mr.appointment_date, mr.registry_number, mr.tdr_result
    FROM medical_records mr
    LEFT JOIN patients p ON p.id = mr.patient_id
    WHERE mr.appointment_date IS NOT NULL AND mr.appointment_date != ''
    ORDER BY mr.appointment_date ASC, p.nom ASC
  `))
}

// ── MEDICATIONS ───────────────────────────────────────
async function listMedications(): Promise<Medication[]> {
  const d = await getDB()
  const res = d.exec('SELECT id, name, item_type, price, unit, description, stock, stock_threshold, created_by, created_at, updated_at FROM medications ORDER BY name ASC')
  return toObjects<Medication>(res)
}

async function createMedication(data: MedicationInput): Promise<void> {
  const d = await getDB()
  if (ensureMedicationsSchema(d)) {
    try { saveDB() } catch { /* ignore */ }
  }
  const stock = data.stock === '' || data.stock === undefined || data.stock === null ? null : Number(data.stock)
  const itemType = data.item_type === 'act' ? 'act' : 'medication'
  const stockThreshold = data.stock_threshold === '' || data.stock_threshold === undefined || data.stock_threshold === null
    ? 100
    : Number(data.stock_threshold)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(data.date || ''))
    ? `${data.date} 00:00:00`
    : null

  d.run(
    'INSERT INTO medications (name, item_type, price, unit, description, stock, stock_threshold, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)',
    [
      String(data.name || '').trim(),
      itemType,
      Number(data.price) || 0,
      itemType === 'act' ? null : (data.unit || 'comprimé'),
      data.description || null,
      itemType === 'act' ? null : stock,
      stockThreshold,
      data.created_by || null,
      date,
    ]
  )

  if (itemType === 'medication' && stock !== null && Number.isFinite(stock) && stock > 0) {
    const medication = d.exec('SELECT id FROM medications WHERE name = ?', [String(data.name || '').trim()])
    const medicationId = medication[0]?.values?.[0]?.[0] ?? null
    d.run(
      'INSERT INTO medication_movements (medication_id, movement_type, quantity, created_at) VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))',
      [medicationId, 'entry', stock, date]
    )
  }
  saveDB()
}

async function updateMedication(id: number, data: MedicationInput): Promise<void> {
  const d = await getDB()
  if (ensureMedicationsSchema(d)) {
    try { saveDB() } catch { /* ignore */ }
  }
  const existing = toObjects<Pick<Medication, 'item_type'>>(d.exec('SELECT item_type FROM medications WHERE id = ?', [id]))[0]
  if (!existing) throw new Error('Médicament ou acte introuvable.')
  const isAct = existing.item_type === 'act'
  d.run(
    'UPDATE medications SET name=?, price=?, unit=?, description=?, stock_threshold=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [
      String(data.name || '').trim(),
      Number(data.price) || 0,
      isAct ? null : (data.unit || 'comprimé'),
      data.description || null,
      data.stock_threshold === '' || data.stock_threshold === undefined || data.stock_threshold === null ? 100 : Number(data.stock_threshold),
      id,
    ]
  )
  saveDB()
}

async function getMedicationHistory(): Promise<MedicationHistoryEntry[]> {
  const d = await getDB()
  const res = d.exec(`SELECT m.id, m.name, m.price, m.unit, m.stock, m.created_at, u.name AS created_by_name
    FROM medications m
    LEFT JOIN users u ON u.id = m.created_by
    WHERE m.created_by IS NOT NULL
    ORDER BY m.created_at DESC`)
  return toObjects<MedicationHistoryEntry>(res)
}

async function addMedicationStock(id: number, quantity: number, createdBy: number | null, date?: string): Promise<void> {
  const d = await getDB()

  const qty = Number(quantity)

  if (!qty || qty <= 0) {
    throw new Error('Quantité invalide')
  }

  let movementDate: string | null = null
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    movementDate = `${date} 00:00:00`
  }

  d.run(
    `
    UPDATE medications
    SET stock = COALESCE(stock,0) + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [qty, id]
  )

  d.run(
    `
    INSERT INTO medication_movements
    (
      medication_id,
      movement_type,
      quantity,
      created_by,
      created_at
    )
    VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `,
    [id, 'entry', qty, createdBy || null, movementDate]
  )

  saveDB()
}

async function getMedicationMovements(): Promise<MedicationMovement[]> {
  const d = await getDB()

  const res = d.exec(`
    SELECT
      mm.*,
      m.name as medication_name,
      u.name as created_by_name
    FROM medication_movements mm
    JOIN medications m
      ON m.id = mm.medication_id
    LEFT JOIN users u
      ON u.id = mm.created_by
    ORDER BY mm.created_at DESC
  `)

  return toObjects<MedicationMovement>(res)
}

async function getMedicationStockHistory(medicationId: number): Promise<StockHistoryEntry[]> {
  const d = await getDB()

  const medRes = d.exec(`
    SELECT id, name, stock, created_at, created_by
    FROM medications
    WHERE id = ?
  `, [medicationId])

  const med = toObjects<Pick<Medication, 'id' | 'name' | 'stock' | 'created_at' | 'created_by'>>(medRes)[0]
  if (!med) return []

  const res = d.exec(`
    SELECT
      mm.id,
      mm.movement_type,
      mm.quantity,
      mm.created_at,
      u.name as created_by_name
    FROM medication_movements mm
    LEFT JOIN users u
      ON u.id = mm.created_by
    WHERE mm.medication_id = ?
    ORDER BY mm.created_at ASC, mm.id ASC
  `, [medicationId])

  const movements = toObjects<{
    id: number
    movement_type: MovementType
    quantity: number
    created_at: string
    created_by_name: string | null
  }>(res)

  if (movements.length === 0 && Number(med.stock) > 0) {
    return [{
      id: null,
      movement_type: 'entry',
      quantity: Number(med.stock),
      created_at: med.created_at,
      created_by_name: null,
      stock_after: Number(med.stock),
      initial: true,
    }]
  }

  if (movements.length === 0) {
    return []
  }

  let totalEntries = 0
  let totalExits = 0
  movements.forEach((m) => {
    const qty = Number(m.quantity) || 0
    if (m.movement_type === 'entry') {
      totalEntries += qty
    } else {
      totalExits += qty
    }
  })

  const currentStock = Number(med.stock) || 0
  const netMovements = totalEntries - totalExits
  const startingStock = currentStock - netMovements

  let runningStock = startingStock
  const history: StockHistoryEntry[] = movements.map((m) => {
    const qty = Number(m.quantity) || 0
    if (m.movement_type === 'entry') {
      runningStock += qty
    } else {
      runningStock -= qty
    }
    return {
      ...m,
      stock_after: runningStock,
    }
  })

  if (startingStock > 0) {
    history.unshift({
      id: null,
      movement_type: 'entry',
      quantity: startingStock,
      created_at: med.created_at,
      created_by_name: null,
      stock_after: startingStock,
      initial: true,
    })
  }

  return history.reverse()
}

async function clearMedicationMovements(): Promise<void> {
  const d = await getDB()
  d.run('DELETE FROM medication_movements')
  saveDB()
}

async function getTopSellingMedications(): Promise<TopSellingMedication[]> {
  const d = await getDB()

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
  `)

  return toObjects<TopSellingMedication>(res)
}

async function getLowStockMedications(limit = 10): Promise<Medication[]> {
  const d = await getDB()

  const res = d.exec(`
    SELECT *
    FROM medications
    WHERE stock IS NOT NULL
      AND stock <= COALESCE(stock_threshold, ?)
    ORDER BY stock ASC
  `, [limit])

  return toObjects<Medication>(res)
}

async function getStockReport(): Promise<StockReportRow[]> {
  const d = await getDB()

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
  `)

  return toObjects<StockReportRow>(res)
}

async function createDispensation(data: DispensationInput): Promise<boolean> {
  const d = await getDB()
  const medId = Number(data.medication_id)
  const quantity = Number(data.quantity)

  const medRows = toObjects<Pick<Medication, 'name' | 'item_type' | 'unit' | 'stock' | 'price'>>(
    d.exec('SELECT name, item_type, unit, stock, price FROM medications WHERE id = ?', [medId])
  )
  const med = medRows[0]
  if (!med) throw new Error('Médicament introuvable')
  if (med.item_type === 'act') throw new Error('Un acte médical ne peut pas être dispensé comme un médicament.')

  if (med.stock !== null && med.stock !== undefined && quantity > Number(med.stock)) {
    throw new Error(`Stock insuffisant. Disponible : ${med.stock}`)
  }

  d.run('BEGIN')
  try {
    d.run(
      'INSERT INTO dispensations (medication_id, medication_name, unit, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
      [medId, med.name, med.unit || 'comprimé', quantity, Number(med.price) || 0]
    )

    d.run(
      `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'exit', ?)`,
      [medId, quantity]
    )

    if (med.stock !== null && med.stock !== undefined) {
      d.run(
        'UPDATE medications SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, medId]
      )
    }

    d.run('COMMIT')
    saveDB()
    return true
  } catch (e) {
    try { d.run('ROLLBACK') } catch { /* ignore */ }
    throw e
  }
}

async function getDispensations(): Promise<Dispensation[]> {
  const d = await getDB()
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
  `)
  return toObjects<Dispensation>(res)
}

async function getDispensationTotal({ year, month }: PeriodFilters = {}): Promise<number> {
  const d = await getDB()
  const where: string[] = []
  const params: BindValue[] = []
  if (year) { where.push("CAST(strftime('%Y', created_at) AS INTEGER) = ?"); params.push(Number(year)) }
  if (month) { where.push("CAST(strftime('%m', created_at) AS INTEGER) = ?"); params.push(Number(month)) }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const res = d.exec(
    `SELECT COALESCE(SUM(unit_price * quantity), 0) as total FROM dispensations ${whereClause}`,
    params
  )
  const rows = toObjects<{ total: number }>(res)
  return Number(rows[0]?.total || 0)
}

async function deleteDispensation(id: number): Promise<boolean> {
  const d = await getDB()
  const idNum = Number(id)
  if (!Number.isFinite(idNum) || idNum <= 0) throw new Error('ID invalide pour suppression.')

  const rows = toObjects<{ medication_id: number; quantity: number }>(
    d.exec('SELECT medication_id, quantity FROM dispensations WHERE id = ?', [idNum])
  )
  const disp = rows[0]
  if (!disp) throw new Error('Dispensation introuvable')

  const medId = Number(disp.medication_id)
  const qty = Number(disp.quantity)

  d.run('BEGIN')
  try {
    d.run('DELETE FROM dispensations WHERE id = ?', [idNum])

    if (Number.isFinite(medId) && medId > 0 && Number.isFinite(qty) && qty > 0) {
      d.run(
        `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'entry', ?)`,
        [medId, qty]
      )
      d.run(
        'UPDATE medications SET stock = COALESCE(stock, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [qty, medId]
      )
    }

    d.run('COMMIT')
    saveDB()
    return true
  } catch (e) {
    try { d.run('ROLLBACK') } catch { /* ignore */ }
    throw e
  }
}

async function updateDispensation(id: number, data: DispensationInput): Promise<boolean> {
  const d = await getDB()
  const idNum = Number(id)
  if (!Number.isFinite(idNum) || idNum <= 0) throw new Error('ID invalide.')
  if (!data || !Number.isFinite(Number(data.medication_id)) || !Number.isFinite(Number(data.quantity))) {
    throw new Error('Données invalides pour la modification.')
  }

  const newMedicationId = Number(data.medication_id)
  const newQuantity = Number(data.quantity)
  if (newMedicationId <= 0 || newQuantity <= 0) throw new Error('Valeurs invalides.')

  const oldRows = toObjects<Dispensation>(d.exec('SELECT * FROM dispensations WHERE id = ?', [idNum]))
  const old = oldRows[0]
  if (!old) throw new Error('Dispensation introuvable')

  const oldMedicationId = Number(old.medication_id)
  const oldQuantity = Number(old.quantity)

  const medRows = toObjects<Pick<Medication, 'name' | 'unit' | 'price' | 'stock'>>(
    d.exec('SELECT name, unit, price, stock FROM medications WHERE id = ?', [newMedicationId])
  )
  const med = medRows[0]
  if (!med) throw new Error('Médicament introuvable.')

  const unitPrice = Number(med.price)
  if (!Number.isFinite(unitPrice)) throw new Error('Prix du médicament invalide.')

  let availableStock = Number(med.stock ?? 0)
  if (!Number.isFinite(availableStock)) availableStock = 0

  if (oldMedicationId === newMedicationId && Number.isFinite(oldQuantity)) {
    availableStock += oldQuantity
  }

  if (newQuantity > availableStock) {
    throw new Error(`Stock insuffisant pour "${med.name}". Disponible : ${availableStock}`)
  }

  d.run('BEGIN')
  try {
    if (oldMedicationId !== newMedicationId) {
      const oldQty = Number.isFinite(oldQuantity) && oldQuantity > 0 ? oldQuantity : 0
      if (oldQty > 0) {
        d.run(
          'UPDATE medications SET stock = COALESCE(stock, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [oldQty, oldMedicationId]
        )
        d.run(
          `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'entry', ?)`,
          [oldMedicationId, oldQty]
        )
      }

      d.run(
        'UPDATE medications SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, newMedicationId]
      )
      d.run(
        `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, 'exit', ?)`,
        [newMedicationId, newQuantity]
      )
    } else {
      const diff = newQuantity - (Number.isFinite(oldQuantity) ? oldQuantity : 0)
      if (diff !== 0) {
        const moveType: MovementType = diff > 0 ? 'exit' : 'entry'
        d.run(
          'UPDATE medications SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [diff, newMedicationId]
        )
        d.run(
          `INSERT INTO medication_movements (medication_id, movement_type, quantity) VALUES (?, ?, ?)`,
          [newMedicationId, moveType, Math.abs(diff)]
        )
      }
    }

    d.run(
      'UPDATE dispensations SET medication_id = ?, medication_name = ?, unit = ?, quantity = ?, unit_price = ? WHERE id = ?',
      [newMedicationId, String(med.name), String(med.unit || 'comprimé'), newQuantity, unitPrice, idNum]
    )

    d.run('COMMIT')
    saveDB()
    return true
  } catch (e) {
    try { d.run('ROLLBACK') } catch { /* ignore */ }
    throw e
  }
}

async function ensureRegistryNumbers(): Promise<boolean> {
  const d = await getDB()
  try {
    backfillRegistryNumbers(d)
    saveDB()
    return true
  } catch (e) {
    console.error('ensureRegistryNumbers error:', e)
    throw e
  }
}

async function createCashOutflow(data: CashOutflowInput): Promise<number | undefined> {
  const d = await getDB()
  const outflowDate = String(data.outflow_date || '').trim()
  const designation = String(data.designation || '').trim()
  const amount = Number(data.amount)

  if (!outflowDate) throw new Error('La date est requise.')
  if (!designation) throw new Error('La désignation est requise.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Le montant doit être supérieur à 0.')

  d.run(
    'INSERT INTO cash_outflows (outflow_date, designation, amount, created_by) VALUES (?, ?, ?, ?)',
    [outflowDate, designation, amount, data.created_by || null]
  )
  // Identifiant lu avant la sauvegarde : `export()` rouvre la connexion et remet last_insert_rowid à zéro
  const idRes = toObjects<{ id: number }>(d.exec('SELECT last_insert_rowid() as id'))[0]
  saveDB()

  return idRes?.id
}

async function listCashOutflows({ year, month }: PeriodFilters = {}): Promise<CashOutflow[]> {
  const d = await getDB()
  const where: string[] = []
  const params: BindValue[] = []
  if (year) { where.push("CAST(strftime('%Y', outflow_date) AS INTEGER) = ?"); params.push(Number(year)) }
  if (month) { where.push("CAST(strftime('%m', outflow_date) AS INTEGER) = ?"); params.push(Number(month)) }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const res = d.exec(
    `SELECT * FROM cash_outflows ${whereClause} ORDER BY outflow_date DESC, id DESC`,
    params
  )
  return toObjects<CashOutflow>(res)
}

async function getCashOutflowTotal({ year, month }: PeriodFilters = {}): Promise<number> {
  const d = await getDB()
  const where: string[] = []
  const params: BindValue[] = []
  if (year) { where.push("CAST(strftime('%Y', outflow_date) AS INTEGER) = ?"); params.push(Number(year)) }
  if (month) { where.push("CAST(strftime('%m', outflow_date) AS INTEGER) = ?"); params.push(Number(month)) }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const res = d.exec(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cash_outflows ${whereClause}`,
    params
  )
  const rows = toObjects<{ total: number }>(res)
  return Number(rows[0]?.total || 0)
}

async function deleteCashOutflow(id: number): Promise<void> {
  const d = await getDB()
  d.run('DELETE FROM cash_outflows WHERE id = ?', [id])
  saveDB()
}

async function updateCashOutflow(id: number, data: CashOutflowInput): Promise<void> {
  const d = await getDB()
  const outflowDate = String(data.outflow_date || '').trim()
  const designation = String(data.designation || '').trim()
  const amount = Number(data.amount)

  if (!outflowDate) throw new Error('La date est requise.')
  if (!designation) throw new Error('La désignation est requise.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Le montant doit être supérieur à 0.')

  d.run(
    'UPDATE cash_outflows SET outflow_date = ?, designation = ?, amount = ? WHERE id = ?',
    [outflowDate, designation, amount, id]
  )
  saveDB()
}

export {
  runAudited, listAudit,
  assertBackupAdmin, exportDatabase, readBackup, restoreDatabase,
  loginUser, registerUser,
  getAllUsers, toggleUserActive, resetUserPassword, deleteUser,
  fetchRecords, fetchRecordsByArchive, fetchRecordById, fetchRecordsByDossier, fetchAppointments, fetchStats, fetchStatsByArchive, createRecord, updateRecord, deleteRecord, clearAppointment,
  listArchives, getCurrentArchive,
  listMedications, createMedication, updateMedication, getMedicationHistory,
  addMedicationStock,
  getMedicationMovements, getMedicationStockHistory, clearMedicationMovements,
  getTopSellingMedications,
  getLowStockMedications,
  ensureRegistryNumbers,
  getStockReport,
  listDossiers, getDossierById,
  listPatients, getPatientById, createPatient, updatePatient, searchSimilarPatients,
  fetchRecordsByPatient, getPatientAddressLog,
  addTreatmentsToRecord,
  createDispensation,
  getDispensations,
  getDispensationTotal,
  deleteDispensation,
  updateDispensation,
  createCashOutflow,
  listCashOutflows,
  getCashOutflowTotal,
  deleteCashOutflow,
  updateCashOutflow,
}
