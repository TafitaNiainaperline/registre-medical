import { groupDispensations } from '../../electron/dispensationReport'
export { groupDispensations } from '../../electron/dispensationReport'
import { formatDate, formatDateTime, formatDay } from './date'
import type { Dispensation } from '../../electron/types'
import { normalize } from './text'

type Purchase = ReturnType<typeof groupDispensations>[number]

export function filterPurchaseHistory(rows: Dispensation[], filters: { number: string; date: string; currentMonth: string }) {
  const number = normalize(filters.number)
  const reference = number.match(/^(?:achat\s*)?(?:(?:n[°ºo]?|numero|#)\s*)?(\d+)$/)
  return groupDispensations(rows).filter((purchase) => {
    if (number && (!reference || purchase.id !== Number(reference[1]))) return false
    if (filters.date) return formatDate(purchase.created_at) === formatDay(filters.date)
    return number ? true : purchase.created_at.slice(0, 7) === filters.currentMonth
  })
}

export function matchesPurchase(purchase: Purchase, search: string): boolean {
  let query = normalize(search)
  if (!query) return true

  // A purchase number must not match quantities, dates or a longer number.
  if (/^\d+$/.test(query)) return purchase.id === Number(query)
  const reference = query.match(/^(?:achat\s*(?:(?:n[°ºo]?|numero|#)\s*)?|(?:n[°ºo]?|numero|#)\s*)(\d+)\b\s*(.*)$/)
  if (reference) {
    if (purchase.id !== Number(reference[1])) return false
    query = reference[2]
    if (!query) return true
  }

  const values = [
    `Achat n° ${purchase.id}`,
    purchase.created_at,
    formatDateTime(purchase.created_at),
    ...purchase.items.flatMap((item) => [item.medication_name, item.unit]),
  ].map(normalize)
  return query.split(/\s+/).every((term) => values.some((value) => value.includes(term)))
}
