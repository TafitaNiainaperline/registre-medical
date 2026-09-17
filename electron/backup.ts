import type { Database } from 'sql.js'

const TABLES = ['users', 'patients', 'medical_records', 'dossiers', 'medications',
  'record_medications', 'medication_movements', 'dispensations', 'cash_outflows', 'patient_address_log']

export function validateBackup(database: Database): void {
  const integrity = database.exec('PRAGMA integrity_check')
  if (integrity[0]?.values.length !== 1 || integrity[0].values[0][0] !== 'ok') {
    throw new Error('Le fichier de sauvegarde est endommagé.')
  }
  const tables = new Set(database.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0]?.values.map((row) => String(row[0])))
  if (TABLES.some((name) => !tables.has(name))) {
    throw new Error('Ce fichier n’est pas une sauvegarde complète de Registre Médical.')
  }
  const admins = database.exec("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND length(password_hash) > 0")
  if (!admins[0]?.values.length) throw new Error('La sauvegarde ne contient aucun administrateur actif.')
}
