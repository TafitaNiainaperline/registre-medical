import { AsyncLocalStorage } from 'node:async_hooks'
import type { Database } from 'sql.js'
import type { AuditEntry, AuditFilters } from './types'

export type AuditActor = { id: number; name: string }
export const auditActor = new AsyncLocalStorage<AuditActor>()

export function registerAuditFunctions(database: Database): void {
  database.create_function('audit_actor_id', () => auditActor.getStore()?.id ?? null)
  database.create_function('audit_actor_name', () => auditActor.getStore()?.name ?? 'Application')
}

export function exportWithAudit(database: Database): Uint8Array {
  try { return database.export() } finally { registerAuditFunctions(database) }
}

export function installAudit(database: Database): void {
  registerAuditFunctions(database)
  database.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    entity_label TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id INTEGER,
    actor_name TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS audit_log_entity ON audit_log(entity_type, id);`)
  const tracked = [
    { table: 'medical_records', entity: 'visit', label: (source: string) => `COALESCE((SELECT trim(nom || ' ' || COALESCE(prenom, '')) FROM patients WHERE id = ${source}.patient_id), 'Visite #' || ${source}.id)` },
    { table: 'medications', entity: 'stock', label: (source: string) => `${source}.name` },
    { table: 'cash_outflows', entity: 'expense', label: (source: string) => `${source}.designation` },
    { table: 'dispensations', entity: 'dispensation', label: (source: string) => `${source}.medication_name` },
  ]
  for (const { table, entity, label } of tracked) {
    const columns = database.exec(`PRAGMA table_info(${table})`)[0]?.values.map((row) => String(row[1])) || []
    const snapshot = (source: string) => `json_object(${columns.map((column) => `'${column.replace(/'/g, "''")}', ${source}."${column.replace(/"/g, '""')}"`).join(', ')})`
    for (const [event, action] of [['INSERT', 'create'], ['UPDATE', 'update'], ['DELETE', 'delete']] as const) {
      const source = event === 'DELETE' ? 'OLD' : 'NEW'
      const before = event === 'INSERT' ? 'NULL' : snapshot('OLD')
      const after = event === 'DELETE' ? 'NULL' : snapshot('NEW')
      const changes = columns.filter((column) => column !== 'updated_at').map((column) => {
        const quoted = `"${column.replace(/"/g, '""')}"`
        return `OLD.${quoted} IS NOT NEW.${quoted}`
      }).join(' OR ')
      database.run(`DROP TRIGGER IF EXISTS audit_${table}_${action};
        CREATE TRIGGER audit_${table}_${action} AFTER ${event} ON ${table}
        ${event === 'UPDATE' ? `WHEN ${changes}` : ''}
        BEGIN INSERT INTO audit_log (entity_type, entity_id, entity_label, action, actor_id, actor_name, before_json, after_json)
        VALUES ('${entity}', ${source}.id, ${label(source)}, '${action}', audit_actor_id(), audit_actor_name(), ${before}, ${after}); END;`)
    }
  }
}

export function queryAudit(database: Database, filters: AuditFilters = {}): AuditEntry[] {
  const types = ['visit', 'stock', 'expense', 'dispensation']
  if (filters.entity && !types.includes(filters.entity)) throw new Error('Type d’historique invalide.')
  const beforeId = Number(filters.beforeId)
  if (filters.beforeId != null && (!Number.isSafeInteger(beforeId) || beforeId < 1)) throw new Error('Page d’historique invalide.')
  const result = database.exec(`SELECT * FROM audit_log WHERE (? = '' OR entity_type = ?) AND (? = 0 OR id < ?) ORDER BY id DESC LIMIT 51`,
    [filters.entity || '', filters.entity || '', beforeId || 0, beforeId || 0])
  if (!result[0]) return []
  return result[0].values.map((values) => Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]])) as AuditEntry)
}
