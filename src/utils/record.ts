import type { AgeType, MedicalRecord, Treatment } from '../../electron/types'
import { normalize } from './text'

type PatientKey = {
  patient_nom?: string | null
  patient_prenom?: string | null
  diagnostic?: string | null
}

type TreatmentLabel = Partial<Treatment> & { name: string }

// L'âge est calculé par la base à la date de la consultation
export function displayAge(age: string | null | undefined, fallback = '-'): string {
  return age || fallback
}

// Modificateur de couleur du badge d'âge
export function ageUnit(months: number | null | undefined): 'ans' | 'mois' | 'jours' {
  if (months === null || months === undefined) return 'ans'
  if (months < 1) return 'jours'
  if (months < 24) return 'mois'
  return 'ans'
}

// L'âge se saisit comme avant — années, mois, mois + jours, jours —
// mais il est converti en mois de naissance pour rester juste dans le temps.
export type AgeEntry = {
  type: AgeType
  value: string
  mois: string
  jours: string
}

export const emptyAge: AgeEntry = { type: 'ans', value: '', mois: '', jours: '' }

// Bornes de saisie, cohérentes avec le sens de chaque unité
export const AGE_LIMITS = { ans: 120, mois: 59, jours: 30, joursSeuls: 31 }

export function ageEntryToMonths(age: AgeEntry): number | null {
  if (age.type === 'ans') return age.value === '' ? null : (Number(age.value) || 0) * 12
  if (age.type === 'mois') return age.value === '' ? null : Number(age.value) || 0
  if (age.type === 'mois_jours') {
    // Jours non renseignés = 0 jour ; sans mois ni jours, l'âge reste vide
    if (age.mois === '' && (age.jours === '' || Number(age.jours) === 0)) return null
    // Mois révolus : 3 mois 20 jours reste un âge de 3 mois
    return (Number(age.mois) || 0) + Math.floor((Number(age.jours) || 0) / 30)
  }
  if (age.type === 'jours') return age.jours === '' ? null : 0
  return null
}

// Contrôle de saisie, partagé par les formulaires qui créent un patient
export function ageEntryError(age: AgeEntry): string | null {
  if (ageEntryToMonths(age) === null) return 'L’âge du patient est requis.'

  const max = age.type === 'ans' ? AGE_LIMITS.ans : AGE_LIMITS.mois
  const amount = age.type === 'mois_jours' ? Number(age.mois || 0) : Number(age.value || 0)
  if (age.type !== 'jours' && amount > max) return `L’âge dépasse la limite de ${max}.`

  const days = Number(age.jours || 0)
  const maxDays = age.type === 'jours' ? AGE_LIMITS.joursSeuls : AGE_LIMITS.jours
  if (age.type !== 'ans' && age.type !== 'mois' && days > maxDays) {
    return `Le nombre de jours ne peut pas dépasser ${maxDays}.`
  }

  return null
}

// Âge saisi → mois de naissance, calculé depuis aujourd'hui
export function ageEntryToBirthDate(age: AgeEntry, at: Date = new Date()): string | null {
  const months = ageEntryToMonths(age)
  if (months === null) return null
  const birth = new Date(at.getFullYear(), at.getMonth() - months, 1)
  return `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-01`
}

// Mois de naissance → âge d'aujourd'hui, dans la même notation
export function birthDateToAgeEntry(birthDate: string | null | undefined, at: Date = new Date()): AgeEntry {
  if (!birthDate) return emptyAge
  const [year, month] = String(birthDate).split('-').map(Number)
  if (!year || !month) return emptyAge

  const months = Math.max(0, (at.getFullYear() - year) * 12 + (at.getMonth() + 1 - month))
  if (months > AGE_LIMITS.mois) return { type: 'ans', value: String(Math.floor(months / 12)), mois: '', jours: '' }
  return { type: 'mois_jours', value: '', mois: String(months), jours: '0' }
}

// « CONS-2026-007 » → « 007 »
export function displayRegistryNumber(value: string | null | undefined): string {
  const match = String(value || '').match(/(\d+)$/)
  if (!match) return value || '-'
  return String(Number(match[1]) || 0).padStart(3, '0')
}

// Identifie un couple patient / maladie
export function patientIllnessKey(row: PatientKey): string {
  return [normalize(row.patient_nom), normalize(row.patient_prenom), normalize(row.diagnostic)].join('|')
}

// Liste lisible des traitements d'un dossier
export function treatmentsLabel(
  treatments: TreatmentLabel[] | null | undefined,
  options: { separator?: string; withPrice?: boolean } = {}
): string {
  const { separator = ', ', withPrice = false } = options
  if (!Array.isArray(treatments) || treatments.length === 0) return ''
  return treatments
    .map((t) => {
      if (t.item_type === 'act') return t.name
      const unit = t.unit ? ` ${t.unit}` : ''
      const price = withPrice ? ` (${t.unit_price} Ar)` : ''
      return `${t.name} x${t.quantity}${unit}${price}`
    })
    .join(separator)
}

// Un traitement regroupé peut n'avoir que son libellé (ancien champ texte)
export type MergedTreatment = Partial<Treatment> & { name: string }

export type MergedRecord = Omit<MedicalRecord, 'treatments'> & { treatments: MergedTreatment[] }

// Ligne d'historique : dossier complet ou dossier regroupé
export type HistoryRow = Omit<MedicalRecord, 'treatments'> & { treatments?: MergedTreatment[] | null }

// Complète un traitement partiel pour l'édition
export function toTreatment(treatment: MergedTreatment): Treatment {
  return {
    medication_id: treatment.medication_id ?? null,
    item_type: treatment.item_type ?? 'medication',
    name: treatment.name,
    unit: treatment.unit ?? null,
    quantity: Number(treatment.quantity) || 1,
    unit_price: Number(treatment.unit_price) || 0,
  }
}

// Regroupe les visites d'un même dossier (même n° de registre, même mois)
export function mergeRecords(records: MedicalRecord[]): MergedRecord[] {
  const grouped = new Map<string, MergedRecord>()

  const addTreatment = (group: MergedRecord, treatment: MergedTreatment) => {
    if (!treatment?.name) return
    const known = group.treatments.some((existing) => (
      normalize(existing.name) === normalize(treatment.name)
      && String(existing.quantity) === String(treatment.quantity)
      && normalize(existing.unit) === normalize(treatment.unit)
    ))
    if (!known) group.treatments.push(treatment)
  }

  records.forEach((record) => {
    const period = `${record.archive_year || ''}|${record.archive_month || ''}`
    const key = record.registry_number
      ? `${record.registry_number}|${period}`
      : `${patientIllnessKey(record)}|${period}`

    let group = grouped.get(key)
    if (!group) {
      group = { ...record, treatments: [], cost: Number(record.cost) || 0 }
      grouped.set(key, group)
    }

    // La visite la plus récente porte les informations affichées
    if (record.created_at && (!group.created_at || record.created_at > group.created_at)) {
      group = { ...group, ...record, treatments: group.treatments, cost: Number(record.cost) || 0 }
      grouped.set(key, group)
    }

    if (record.treatments?.length) record.treatments.forEach((t) => addTreatment(group, t))
    else if (record.traitement) addTreatment(group, { name: record.traitement })
  })

  return Array.from(grouped.values())
}
