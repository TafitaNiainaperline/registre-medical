import { useEffect, useState } from 'react'
import type { CategoryStats, MedicalRecord } from '../../../electron/types'
import { categories } from '../../constants'
import { normalize } from '../../utils/text'
import { mergeRecords, summarizePfRecords, summarizeCpnRecords } from '../../utils/record'
import { loadDashboardMonth } from './loadDashboardMonth'
import type { Counted } from './types'

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
  const [dispensations, setDispensations] = useState({ total: 0, count: 0 })
  const [cashOutflowTotal, setCashOutflowTotal] = useState(0)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])
  const [ready, setReady] = useState(false)
  const [loadedPeriod, setLoadedPeriod] = useState('')
  const [error, setError] = useState('')
  const periodKey = `${selectedYear}-${selectedMonth}`
  const loading = !ready || loadedPeriod !== periodKey
  const periodLabel = new Date(selectedYear, selectedMonth - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    let canceled = false
    Promise.allSettled([window.api.listArchives(), window.api.getCurrentArchive()])
      .then(([archives, current]) => {
        if (canceled) return
        const archive = current.status === 'fulfilled' ? current.value : null
        const year = archive?.year || new Date().getFullYear()
        const years = archives.status === 'fulfilled' ? (archives.value || []).map((a) => a.year) : []
        setAvailableYears([...new Set([...years, year, new Date().getFullYear()])].sort((a, b) => b - a))
        setSelectedYear(year)
        setSelectedMonth(archive?.month || new Date().getMonth() + 1)
        setReady(true)
      })
    return () => { canceled = true }
  }, [])

  useEffect(() => {
    if (!ready) return
    let canceled = false
    loadDashboardMonth({ year: selectedYear, month: selectedMonth })
      .then(({ records: monthRecords, dispensations: monthDispensations, cashOutflowTotal: monthOutflows }) => {
        if (canceled) return
        setRecords(monthRecords)
        const nextStats: CategoryStats = {}
        mergeRecords(monthRecords).forEach((row) => {
          nextStats[row.category] = (nextStats[row.category] || 0) + 1
        })
        setStats(nextStats)
        setDispensations(monthDispensations)
        setCashOutflowTotal(monthOutflows)
        setError('')
      })
      .catch(() => {
        if (canceled) return
        setRecords([])
        setStats({})
        setDispensations({ total: 0, count: 0 })
        setCashOutflowTotal(0)
        setError('Impossible de charger les données du mois. Réessayez en sélectionnant une autre période.')
      })
      .finally(() => { if (!canceled) setLoadedPeriod(periodKey) })
    return () => { canceled = true }
  }, [ready, selectedYear, selectedMonth, periodKey])

  const totalAmount = records.reduce((sum, row) => sum + (Number(row.cost) || 0), 0) + dispensations.total

  const tdr = records
    .filter((row) => row.category === 'consultation' && row.tdr_result)
    .reduce<Record<string, number>>((summary, row) => {
      const result = String(row.tdr_result).toLowerCase()
      summary[result] = (summary[result] || 0) + 1
      return summary
    }, {})

  return {
    selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, availableYears, stats, dispensations,
    periodLabel, loading, error, ready,
    totalRecords: Object.values(stats).reduce((sum, count) => sum + count, 0),
    totalAmount,
    cashOutflowTotal,
    balance: totalAmount - cashOutflowTotal,
    tdr,
    sexSummary: countDistinctPatients(records.filter((row) => row.category === 'consultation'),
      (row) => String(row.sexe || '').trim().toUpperCase() || 'Non renseigné'),
    ageGroupSummary: countDistinctPatients(records, (row) => getAgeGroup(row.age_months))
      .sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true })),
    diagnosticSummary: countDistinctPatients(records, diagnosticOf).sort(byCountDesc),
    pfSummary: summarizePfRecords(mergeRecords(records)),
    cpnSummary: summarizeCpnRecords(records),
    diagnosticsByCategory: categories.map((category) => ({
      ...category,
      diagnostics: countDistinctPatients(records.filter((row) => row.category === category.key), diagnosticOf)
        .sort(byCountDesc),
    })),
  }
}
