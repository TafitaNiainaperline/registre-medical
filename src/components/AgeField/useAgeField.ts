import { useEffect, useRef } from 'react'
import type { AgeEntry } from '../../utils/record'
import type { AgeUnit } from './types'

// Libellés rappelant la tranche couverte par chaque unité
const UNITS: AgeUnit[] = [
  { key: 'ans', label: 'Années (à partir de 5 ans)' },
  { key: 'mois_jours', label: 'Mois + jours (moins de 5 ans)' },
  { key: 'jours', label: 'Jours (moins d’un mois)' },
]

// Borne la saisie au maximum de l'unité : pas de « 500 mois »
const clamp = (raw: string, max: number): string => {
  if (raw === '') return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return String(Math.min(Number(digits), max))
}

export const useAgeField = (
  value: AgeEntry,
  onChange: (value: AgeEntry) => void,
  disabled?: boolean,
  yearsOnly?: boolean,
) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)

  // Une fiche relue en mois repasse en années là où l'unité est imposée
  useEffect(() => {
    if (!yearsOnly || value.type === 'ans') return
    const months = Number(value.mois || 0) + (value.type === 'mois' ? Number(value.value || 0) : 0)
    onChange({ type: 'ans', value: months ? String(Math.floor(months / 12)) : '', mois: '', jours: '' })
    // Une seule conversion, au moment où l'unité ne correspond pas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsOnly, value.type])

  // Saisie focalisée après un choix d'unité seulement, jamais au montage
  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    if (disabled) return
    rootRef.current?.querySelector('input')?.focus()
  }, [value.type, disabled])

  // Report des valeurs compatibles : changer d'unité ne vide pas la saisie
  const convert = (type: AgeEntry['type']): AgeEntry => {
    // Jours non renseignés en « mois + jours » : zéro jour
    const blank: AgeEntry = { type, value: '', mois: '', jours: type === 'mois_jours' ? '0' : '' }

    if (value.type === 'jours' && type === 'mois_jours') return { ...blank, jours: value.jours }
    if (value.type === 'mois_jours' && type === 'jours') return { ...blank, jours: value.jours }

    return blank
  }

  const changeType = (type: AgeEntry['type']) => {
    pendingFocus.current = true
    onChange(convert(type))
  }

  const set = (patch: Partial<AgeEntry>) => onChange({ ...value, ...patch })

  const setValue = (raw: string, max: number) => set({ value: clamp(raw, max) })
  const setMois = (raw: string, max: number) => set({ mois: clamp(raw, max) })
  const setJours = (raw: string, max: number) => set({ jours: clamp(raw, max) })

  return { units: UNITS, rootRef, changeType, setValue, setMois, setJours }
}
