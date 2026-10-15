import type { MedicalRecord } from '../../../electron/types'
import type { Counted } from './types'

// Une ligne du registre correspond à un examen, même pour un patient déjà venu.
export function summarizeEchographie(records: MedicalRecord[], field: 'performed_by' | 'prescriber' = 'performed_by'): Counted[] {
  const groups = new Map<string, { label: string; count: number }>()
  for (const row of records) {
    if (row.category !== 'echographie') continue
    const label = (row[field] || '').trim().replace(/\s+/g, ' ') || 'Non renseigné'
    const key = label.toLocaleLowerCase('fr-FR')
    const group = groups.get(key) || { label, count: 0 }
    group.count += 1
    groups.set(key, group)
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
    .map(({ label, count }) => [label, count])
}
