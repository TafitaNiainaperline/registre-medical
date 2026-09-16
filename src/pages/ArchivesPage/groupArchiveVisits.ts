import type { MedicalRecord } from '../../../electron/types'

export function groupArchiveVisits(rows: MedicalRecord[]) {
  const groups = new Map<string, MedicalRecord[]>()
  for (const row of rows) {
    const patient = row.patient_id != null ? `patient:${row.patient_id}` : `record:${row.id}`
    const key = JSON.stringify([patient, row.category, row.archive_year, row.archive_month, row.registry_number])
    const visits = groups.get(key) || []
    visits.push(row)
    groups.set(key, visits)
  }
  return [...groups.entries()].map(([key, visits]) => {
    visits.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id)
    return { key, latest: visits[0], visits, total: visits.reduce((sum, row) => sum + (Number(row.cost) || 0), 0) }
  }).sort((a, b) => String(b.latest.created_at).localeCompare(String(a.latest.created_at)) || b.latest.id - a.latest.id)
}
