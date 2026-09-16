import { notify as showToast } from '../../utils/notifications'
import { useMemo, useState } from 'react'
import type { Medication, Treatment } from '../../../electron/types'
import { normalize } from '../../utils/text'

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const useTreatmentSelector = (
  medications: Medication[],
  value: Treatment[],
  onChange?: (next: Treatment[]) => void
) => {
  const treatments = Array.isArray(value) ? value : []

  const [searchName, setSearchName] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const byId = useMemo(() => {
    const map = new Map<string, Medication>()
    medications.forEach((m) => map.set(String(m.id), m))
    return map
  }, [medications])

  const filteredMeds = useMemo(() => {
    if (!searchName.trim()) return medications
    const q = normalize(searchName)
    return medications.filter((m) => normalize(m.name).includes(q))
  }, [medications, searchName])

  // Refuse le dépassement de stock pour un médicament suivi
  const exceedsStock = (med: Medication | undefined, total: number) =>
    !!med && med.item_type !== 'act' && med.stock !== null && med.stock !== undefined && total > Number(med.stock)

  // Choisir un médicament crée la ligne : plus de bouton « Ajouter »
  const pick = (med: Medication) => {
    const alreadyTaken = treatments
      .filter((t) => String(t.medication_id) === String(med.id))
      .reduce((sum, t) => sum + toNumber(t.quantity), 0)

    if (exceedsStock(med, alreadyTaken + 1)) {
      showToast(`Stock insuffisant pour "${med.name}" !\nDisponible : ${med.stock} ${med.unit || 'unité(s)'}`, 'err')
      return
    }

    const exists = treatments.some((t) => String(t.medication_id) === String(med.id))
    const next: Treatment[] = exists
      ? treatments.map((t) => String(t.medication_id) === String(med.id)
        ? { ...t, quantity: toNumber(t.quantity, 0) + 1 }
        : t)
      : [...treatments, {
        medication_id: med.id,
        item_type: med.item_type || 'medication',
        name: med.name,
        unit: med.item_type === 'act' ? null : (med.unit || 'comprimé'),
        unit_price: toNumber(med.price, 0),
        quantity: 1,
      }]

    onChange?.(next)
    setSearchName('')
    setIsDropdownOpen(false)
  }

  const updateQty = (medicationId: number | null, nextQty: string) => {
    const q = Math.max(1, toNumber(nextQty, 1))
    const med = byId.get(String(medicationId))
    const total = treatments.reduce((sum, t) =>
      sum + (String(t.medication_id) === String(medicationId) ? q : toNumber(t.quantity)), 0)

    if (exceedsStock(med, total)) {
      showToast(`Stock insuffisant pour "${med?.name}" ! Disponible : ${med?.stock}`, 'err')
      return
    }

    onChange?.(treatments.map((t) => String(t.medication_id) === String(medicationId) ? { ...t, quantity: q } : t))
  }

  const remove = (medicationId: number | null) => {
    onChange?.(treatments.filter((t) => String(t.medication_id) !== String(medicationId)))
  }

  const total = treatments.reduce((sum, t) => sum + toNumber(t.unit_price) * toNumber(t.quantity), 0)

  return {
    treatments, byId, filteredMeds, searchName, isDropdownOpen,
    setSearchName, setIsDropdownOpen, updateQty, remove, pick, total, toNumber,
  }
}
