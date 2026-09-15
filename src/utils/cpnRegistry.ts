import { summarizeCpnRecords } from './record'

type Period = { year: number; month?: number }

// Période CPN indépendante de celle du registre PF.
let registryPeriod: Period | null = null

export function rememberCpnPeriod(period: Period): void {
  registryPeriod = { ...period }
}

export async function loadCpnRegistrySummary() {
  const period = registryPeriod || await window.api.getCurrentArchive()
  const rows = await window.api.fetchRecordsByArchive({ year: period.year, month: period.month, category: 'cpn' })
  const label = period.month
    ? new Date(period.year, period.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : String(period.year)
  return { entries: summarizeCpnRecords(rows || []), label }
}
