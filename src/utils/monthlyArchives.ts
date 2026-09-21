import type { Archive } from '../../electron/types'

export function archiveForMonth(monthKey: string): Archive {
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(5, 7))
  return { year, month, label: new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
}

export function monthlyArchives(dates: string[], currentMonth: string): Archive[] {
  return [...new Set([currentMonth, ...dates.map((date) => date.slice(0, 7))])]
    .filter((key) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key))
    .sort().reverse().map(archiveForMonth)
}

export function archiveMonthKey(archive: Archive): string {
  return `${archive.year}-${String(archive.month).padStart(2, '0')}`
}
