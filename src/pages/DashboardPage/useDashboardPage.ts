import { useEffect, useState } from 'react'
import type { CategoryStats, MedicalRecord } from '../../../electron/types'
import { categories } from '../../constants'
import { normalize } from '../../utils/text'
import type { ArchiveSummary, Counted } from './types'

// Tranches d'âge officielles, exprimées en mois
const AGE_GROUPS: [limit: number, label: string][] = [
  [0.93, '0-28j'],
  [11, '29j-11mois'],
  [48, '1-4 ans'],
  [168, '5-14 ans'],
  [204, '15-17 ans'],
  [288, '18-24 ans'],
  [708, '25-59 ans'],
]

function getAgeGroup(months: number | null | undefined): string {
  if (months === null || months === undefined) return 'Non renseigné'
  return AGE_GROUPS.find(([limit]) => months <= limit)?.[1] || '60 ans et plus'
}

const patientId = (row: MedicalRecord) =>
  normalize(`${String(row.patient_nom || '').trim()} ${String(row.patient_prenom || '').trim()}`)

const dossierKey = (row: MedicalRecord) => `${patientId(row)}|${normalize(row.diagnostic)}`

// Compte les patients distincts par clé ; une clé nulle exclut la ligne
function countDistinctPatients(records: MedicalRecord[], keyOf: (row: MedicalRecord) => string | null): Counted[] {
  const groups = new Map<string, Set<string>>()
  records.forEach((row) => {
    const key = keyOf(row)
    if (!key) return
    const patients = groups.get(key) || new Set<string>()
    patients.add(patientId(row))
    groups.set(key, patients)
  })
  return Array.from(groups, ([key, patients]): Counted => [key, patients.size])
}

const byCountDesc = (a: Counted, b: Counted) => b[1] - a[1]
const diagnosticOf = (row: MedicalRecord) => String(row.diagnostic || '').trim() || null

export const useDashboardPage = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [stats, setStats] = useState<CategoryStats>({})
  const [archiveDiagnostics, setArchiveDiagnostics] = useState<ArchiveSummary[]>([])
  const [dispensations, setDispensations] = useState({ total: 0, count: 0 })
  const [cashOutflowTotal, setCashOutflowTotal] = useState(0)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])

  useEffect(() => {
    const load = async () => {
      try {
        const allRecords = await window.api.fetchRecordsByArchive({ year: selectedYear }) || []
        setRecords(allRecords)

        const dossiers = new Map<string, Set<string>>()
        allRecords.forEach((row) => {
          const key = row.category || 'unknown'
          const set = dossiers.get(key) || new Set<string>()
          set.add(dossierKey(row))
          dossiers.set(key, set)
        })
        const nextStats: CategoryStats = {}
        dossiers.forEach((set, key) => { nextStats[key] = set.size })
        setStats(nextStats)

        const total = Number(await window.api.getDispensationTotal({ year: selectedYear }) || 0)
        const list = await window.api.getDispensations() || []
        setDispensations({ total, count: list.length })

        setCashOutflowTotal(Number(await window.api.getCashOutflowTotal({ year: selectedYear }) || 0))

        const archives = await window.api.listArchives() || []
        const years = [...new Set(archives.map((a) => a.year))].sort((a, b) => b - a)
        if (years.length > 0) setAvailableYears(years)

        const recentMonths = archives
          .filter((a) => a.year === selectedYear)
          .sort((a, b) => Number(b.month) - Number(a.month))
          .slice(0, 6)

        setArchiveDiagnostics(await Promise.all(recentMonths.map(async (archive): Promise<ArchiveSummary> => {
          const monthRecords = await window.api.fetchRecordsByArchive({ year: archive.year, month: archive.month }) || []
          return {
            label: archive.label || `${archive.month}/${archive.year}`,
            topDiagnostics: countDistinctPatients(monthRecords, diagnosticOf).sort(byCountDesc).slice(0, 3),
          }
        })))
      } catch {
        setRecords([])
        setStats({})
        setArchiveDiagnostics([])
        setDispensations({ total: 0, count: 0 })
        setCashOutflowTotal(0)
      }
    }
    load()
  }, [selectedYear])

  const totalAmount = records.reduce((sum, row) => sum + (Number(row.cost) || 0), 0) + dispensations.total

  const tdr = records
    .filter((row) => row.category === 'consultation' && row.tdr_result)
    .reduce<Record<string, number>>((summary, row) => {
      const result = String(row.tdr_result).toLowerCase()
      summary[result] = (summary[result] || 0) + 1
      return summary
    }, {})

  return {
    selectedYear, setSelectedYear, availableYears, stats, archiveDiagnostics, dispensations,
    totalRecords: Object.values(stats).reduce((sum, count) => sum + count, 0),
    totalAmount,
    cashOutflowTotal,
    balance: totalAmount - cashOutflowTotal,
    tdr,
    sexSummary: countDistinctPatients(records, (row) => String(row.sexe || '').trim().toUpperCase() || 'Non renseigné'),
    ageGroupSummary: countDistinctPatients(records, (row) => getAgeGroup(row.age_months))
      .sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true })),
    diagnosticSummary: countDistinctPatients(records, diagnosticOf).sort(byCountDesc),
    pfSummary: countDistinctPatients(records, (row) =>
      row.category === 'pf' ? String(row.pf_method || '').trim() || null : null).sort(byCountDesc),
    cpnSummary: countDistinctPatients(records, (row) =>
      row.category === 'cpn' ? String(row.cpn_type || '').trim() || null : null).sort(byCountDesc),
    diagnosticsByCategory: categories.map((category) => ({
      ...category,
      diagnostics: countDistinctPatients(records.filter((row) => row.category === category.key), diagnosticOf)
        .sort(byCountDesc),
    })),
  }
}
