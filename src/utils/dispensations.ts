import type { Dispensation } from '../../electron/types'

export function groupDispensations(rows: Dispensation[]) {
  const groups = new Map<string, { id: number; created_at: string; items: Dispensation[]; total: number }>()
  for (const row of rows) {
    const key = row.batch_id || `legacy-${row.id}`
    let group = groups.get(key)
    if (!group) {
      group = { id: row.id, created_at: row.created_at, items: [], total: 0 }
      groups.set(key, group)
    }
    group.id = Math.min(group.id, row.id)
    group.items.push(row)
    group.total += Number(row.unit_price || 0) * Number(row.quantity)
  }
  return [...groups.values()].map((group) => ({
    ...group,
    items: group.items.sort((a, b) => a.id - b.id),
  })).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
}
