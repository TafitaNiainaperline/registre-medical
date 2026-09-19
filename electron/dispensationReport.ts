import type { Dispensation } from './types'

export function groupDispensations(rows: Dispensation[]) {
  const groups = new Map<string, { id: number; created_at: string; items: Dispensation[]; total: number }>()
  for (const row of rows) {
    const key = row.batch_id || `legacy-${row.id}`
    let group = groups.get(key)
    if (!group) {
      group = { id: row.id, created_at: row.created_at, items: [], total: 0 }
      groups.set(key, group)
    }
    if (row.id < group.id) {
      group.id = row.id
      group.created_at = row.created_at
    }
    group.items.push(row)
    group.total += Number(row.unit_price || 0) * Number(row.quantity)
  }
  return [...groups.values()].map((group) => ({
    ...group,
    items: group.items.sort((a, b) => a.id - b.id),
  })).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
}

export type DispensationPeriod = { year: number; month: number }

export function monthlyDispensations(rows: Dispensation[], period: DispensationPeriod) {
  if (!Number.isInteger(period?.year) || period.year < 1 || period.year > 9999 || !Number.isInteger(period?.month) || period.month < 1 || period.month > 12) {
    throw new Error('Mois ou année invalide.')
  }
  const key = String(period.year).padStart(4, '0') + '-' + String(period.month).padStart(2, '0')
  return groupDispensations(rows).filter((purchase) => purchase.created_at.slice(0, 7) === key)
}
