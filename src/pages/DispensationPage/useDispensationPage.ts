import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Dispensation, Medication } from '../../../electron/types'
import { errorMessage } from '../../utils/error'
import { matches } from '../../utils/text'

type MessageType = 'ok' | 'err'

const DEFAULT_THRESHOLD = 100

export const useDispensationPage = () => {
  const [medications, setMedications] = useState<Medication[]>([])
  const [dispensations, setDispensations] = useState<Dispensation[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<{ type: MessageType; text: string }>({ type: 'ok', text: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ medication_id: '', quantity: '' })

  const load = () => {
    window.api.listMedications()
      .then((rows) => setMedications((rows || []).filter((item) => item.item_type !== 'act')))
      .catch(() => setMedications([]))

    window.api.getDispensations()
      .then((rows) => setDispensations(rows || []))
      .catch(() => setDispensations([]))
  }

  useEffect(() => { load() }, [])

  const notify = (text: string, type: MessageType = 'ok') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: 'ok' }), 2500)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (savingRef.current) return

    const medicationId = Number(selectedId)
    const qty = Number(quantity)

    if (!medicationId) { notify('Veuillez sélectionner un médicament.', 'err'); return }
    if (!Number.isFinite(qty) || qty <= 0) { notify('Veuillez saisir une quantité valide.', 'err'); return }

    const med = medications.find((m) => Number(m.id) === medicationId)
    if (!med) { notify('Médicament introuvable.', 'err'); return }
    if (med.stock !== null && med.stock !== undefined && qty > Number(med.stock)) {
      notify(`Stock insuffisant. Disponible : ${med.stock}`, 'err')
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      await window.api.createDispensation({ medication_id: medicationId, quantity: qty })

      const total = Number(med.price) * qty
      const threshold = Number(med.stock_threshold ?? DEFAULT_THRESHOLD)
      const remaining = med.stock === null || med.stock === undefined ? null : Number(med.stock) - qty
      const warning = remaining !== null && remaining <= threshold
        ? ` Attention : stock atteint le seuil de ${threshold}.`
        : ''

      notify(`Dispensation enregistrée. Total : ${total.toLocaleString()} Ar.${warning}`)
      setSelectedId('')
      setQuantity('')
      setCreating(false)
      load()
    } catch (err) {
      notify(errorMessage(err, 'Erreur lors de l\'enregistrement.'), 'err')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Supprimer cette dispensation ? Le stock sera recrédité.')) return
    try {
      await window.api.deleteDispensation(id)
      notify('Dispensation supprimée, stock recrédité.')
      load()
    } catch (err) {
      notify(errorMessage(err, 'Erreur lors de la suppression.'), 'err')
    }
  }

  const startEdit = (dispensation: Dispensation) => {
    setEditingId(Number(dispensation.id))
    setEditForm({ medication_id: String(dispensation.medication_id), quantity: String(dispensation.quantity) })
  }

  const saveEdit = async () => {
    if (editingId === null) return
    try {
      await window.api.updateDispensation({
        id: editingId,
        medication_id: Number(editForm.medication_id),
        quantity: Number(editForm.quantity),
      })
      notify('Dispensation modifiée.')
      setEditingId(null)
      setEditForm({ medication_id: '', quantity: '' })
      load()
    } catch (err) {
      notify(errorMessage(err, 'Erreur lors de la modification.'), 'err')
    }
  }

  const selected = medications.find((m) => Number(m.id) === Number(selectedId))
  const filtered = dispensations.filter((d) => matches(search, [d.medication_name, d.unit, d.quantity]))

  return {
    creating, saving,
    openCreate: () => {
      setSelectedId('')
      setQuantity('')
      setMessage({ text: '', type: 'ok' })
      setEditingId(null)
      setCreating(true)
    },
    closeCreate: () => { if (!savingRef.current) setCreating(false) },
    medications, filtered, selectedId, setSelectedId, quantity, setQuantity, search, setSearch,
    message, submit, remove, editingId, setEditingId, editForm, setEditForm, startEdit, saveEdit,
    unit: selected?.unit || 'comprimé',
    totalPrice: selected ? Number(selected.price) * Number(quantity || 0) : 0,
    unitOf: (id: string) => medications.find((m) => Number(m.id) === Number(id))?.unit || 'comprimé',
  }
}
