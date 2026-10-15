import type { MedicalRecord } from './types'

const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function matchesArchiveRecord(row: MedicalRecord, search: string): boolean {
  const query = normalize(search)
  return [row.patient_nom, row.patient_prenom, row.diagnostic, row.registry_number,
    row.traitement, ...(row.treatments || []).map((item) => item.name)]
    .some((value) => normalize(value).includes(query))
}

const dossierKey = (row: MedicalRecord) => JSON.stringify([
  row.patient_id != null ? `patient:${row.patient_id}` : `record:${row.id}`,
  row.category, row.archive_year, row.archive_month, row.registry_number,
])

export function filterArchiveRecords(records: MedicalRecord[], search: string): MedicalRecord[] {
  const keys = new Set(records.filter((row) => matchesArchiveRecord(row, search)).map(dossierKey))
  return records.filter((row) => keys.has(dossierKey(row)))
}
