import { mergeRecords, summarizePfRecords } from './record'

type Period = { year: number; month?: number }

// Garde la dernière période réellement affichée dans le registre pendant la session.
let registryPeriod: Period | null = null

export function rememberPfPeriod(period: Period): void {
  registryPeriod = { ...period }
}

export async function loadPfRegistrySummary() {
  const period = registryPeriod || await window.api.getCurrentArchive()
  const rows = await window.api.fetchRecordsByArchive({ year: period.year, month: period.month, category: 'pf' })
  const label = period.month
    ? new Date(period.year, period.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : String(period.year)
  return { entries: summarizePfRecords(mergeRecords(rows || [])), label }
}
