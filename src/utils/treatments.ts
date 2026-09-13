import type { Medication, Treatment } from '../../electron/types'
import { normalize } from './text'

// Retrouve le médicament écrit en toutes lettres, en privilégiant le nom le plus long
export function findMedication(text: string, medications: Medication[]): Medication | null {
  const wanted = normalize(text)
  const candidates = medications
    .map((med) => ({ med, name: normalize(med.name) }))
    .filter(({ name }) => name)

  const exact = candidates.find(({ name }) => name === wanted)
  if (exact) return exact.med

  return candidates
    .filter(({ name }) => wanted.startsWith(`${name} `))
    .sort((a, b) => b.name.length - a.name.length)[0]?.med || null
}

// Analyse « Paracetamol x2 comprimé » : médicament, quantité, unité cohérente
function parsePart(part: string, medications: Medication[]) {
  const text = String(part || '').trim()
  const med = findMedication(text, medications)
  if (!text || !med) return { med: null, quantity: 1, unitOk: true }

  let rest = normalize(text).slice(normalize(med.name).length).trim()
  let quantity = 1

  const withQuantity = rest.match(/^(?:x\s*)?(\d+)\s*(.*)$/i)
  if (withQuantity) {
    quantity = Number(withQuantity[1]) || 1
    rest = String(withQuantity[2] || '').trim()
  }

  const expectedUnit = normalize(med.unit || '').replace(/s$/, '')
  const writtenUnit = normalize(rest).replace(/s$/, '')
  const unitOk = !writtenUnit || !expectedUnit || writtenUnit === expectedUnit

  return { med, quantity, unitOk }
}

// Convertit un traitement saisi en texte libre en lignes de traitement vérifiées
export function buildTreatmentsFromText(text: string, medications: Medication[]): Treatment[] {
  const parts = String(text || '').split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean)
  if (!parts.length) return []

  const byMedication = new Map<string, Treatment>()
  const unknown: string[] = []
  const wrongUnits: string[] = []

  parts.forEach((part) => {
    const { med, quantity, unitOk } = parsePart(part, medications)
    if (!med) { unknown.push(part); return }
    if (!unitOk) { wrongUnits.push(`${med.name} (${med.unit || 'unité'})`); return }

    const current = byMedication.get(String(med.id))
    if (current) {
      current.quantity += Math.max(1, quantity)
      return
    }

    byMedication.set(String(med.id), {
      medication_id: med.id,
      item_type: med.item_type || 'medication',
      name: med.name,
      unit: med.unit || 'unité',
      unit_price: Number(med.price) || 0,
      quantity: Math.max(1, quantity),
    })
  })

  if (unknown.length) {
    throw new Error(`Médicament non disponible dans le stock : ${unknown.join(', ')}. Écrivez le nom enregistré, par exemple : Cerum x2 sachet.`)
  }
  if (wrongUnits.length) {
    throw new Error(`Unité incorrecte. Utilisez l'unité enregistrée : ${wrongUnits.join(', ')}.`)
  }

  const treatments = Array.from(byMedication.values())

  const outOfStock = treatments.find((t) => {
    const med = medications.find((m) => String(m.id) === String(t.medication_id))
    return med && med.stock !== null && med.stock !== undefined && Number(t.quantity) > Number(med.stock)
  })

  if (outOfStock) {
    const med = medications.find((m) => String(m.id) === String(outOfStock.medication_id))
    throw new Error(`Stock insuffisant pour "${outOfStock.name}". Disponible : ${med?.stock ?? 0}. Demandé : ${outOfStock.quantity}.`)
  }

  return treatments
}

// Total d'une sélection, ou du texte libre tant que rien n'est sélectionné
export function treatmentsTotal(treatments: Treatment[], text: string, medications: Medication[]): number {
  try {
    const lines = treatments.length ? treatments : buildTreatmentsFromText(text, medications)
    return lines.reduce((sum, t) => sum + Number(t.unit_price) * Number(t.quantity), 0)
  } catch {
    return 0
  }
}
