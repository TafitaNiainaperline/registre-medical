import type { Dispensation, MedicalRecord, Medication } from '../../electron/types'
import { categories } from '../constants'
import { normalize } from './text'

export function medicationUsage(medication: Medication, records: MedicalRecord[], dispensations: Dispensation[]) {
  const entries: { id: string; date: string; source: string; patient: string; reference: string; quantity: number }[] = []
  for (const row of records) {
    const quantity = (row.treatments || []).reduce((sum, treatment) => {
      if ((treatment.item_type === 'act') !== (medication.item_type === 'act')) return sum
      const matches = treatment.medication_id != null
        ? Number(treatment.medication_id) === medication.id
        : normalize(treatment.name) === normalize(medication.name)
      return sum + (matches ? Number(treatment.quantity) || 0 : 0)
    }, 0)
    if (quantity > 0) entries.push({ id: `record-${row.id}`, date: row.created_at,
      source: categories.find((category) => category.key === row.category)?.label || row.category,
      patient: `${row.patient_nom || ''} ${row.patient_prenom || ''}`.trim() || '—',
      reference: row.registry_number || String(row.id), quantity })
  }
  for (const row of dispensations) {
    if (medication.item_type === 'act' || Number(row.medication_id) !== medication.id) continue
    entries.push({ id: `dispensation-${row.id}`, date: row.created_at, source: 'Dispensation',
      patient: '—', reference: String(row.id), quantity: Number(row.quantity) || 0 })
  }
  const totals = [...categories.map((category) => ({ source: category.label, quantity: 0 })), { source: 'Dispensation', quantity: 0 }]
  entries.forEach((entry) => {
    const total = totals.find((item) => item.source === entry.source)
    if (total) total.quantity += entry.quantity
  })
  return { entries: entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    totals, total: entries.reduce((sum, entry) => sum + entry.quantity, 0) }
}
