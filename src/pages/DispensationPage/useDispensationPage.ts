import { notify as showToast, confirmAction } from '../../utils/notifications'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Dispensation, Medication } from '../../../electron/types'
import { errorMessage } from '../../utils/error'
import { monthlyDispensations } from '../../../electron/dispensationReport'
import { todayIso } from '../../utils/date'
import { filterPurchaseHistory } from '../../utils/dispensations'
import { watchCurrentMonth } from '../../utils/watchCurrentMonth'
import { archiveForMonth, archiveMonthKey, monthlyArchives } from '../../utils/monthlyArchives'
import type { Archive } from '../../../electron/types'

type MessageType = 'ok' | 'err'

const DEFAULT_THRESHOLD = 100

export const useDispensationPage = () => {
  const [medications, setMedications] = useState<Medication[]>([])
  const [dispensations, setDispensations] = useState<Dispensation[]>([])
  const nextLineId = useRef(1)
  const [lines, setLines] = useState([{ id: 0, medication_id: '', quantity: '' }])
  const resetLines = () => setLines([{ id: nextLineId.current++, medication_id: '', quantity: '' }])
  const [exporting, setExporting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const printingRef = useRef(false)
  const exportingRef = useRef(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [currentMonth, setCurrentMonth] = useState(() => todayIso().slice(0, 7))
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [searchNumber, setSearchNumber] = useState('')
  const [searchDate, setSearchDate] = useState('')
  const monthKey = selectedMonth
  const period = { year: Number(monthKey.slice(0, 4)), month: Number(monthKey.slice(5, 7)) }
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
  useEffect(() => watchCurrentMonth((month) => {
    setCurrentMonth(month)
    setSelectedMonth(month)
    setSearchNumber('')
    setSearchDate('')
    setEditingId(null)
    load()
  }), [])

  const notify = (text: string, type: MessageType = 'ok') => {
    setMessage({ text, type })
    showToast(text, type)
    setTimeout(() => setMessage({ text: '', type: 'ok' }), 2500)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (savingRef.current) return

    const items = lines.map((line) => ({ medication_id: Number(line.medication_id), quantity: Number(line.quantity) }))
    const quantities = new Map<number, number>()
    for (const item of items) {
      if (!item.medication_id) { notify('Veuillez sélectionner un médicament sur chaque ligne.', 'err'); return }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) { notify('Veuillez saisir une quantité valide sur chaque ligne.', 'err'); return }
      quantities.set(item.medication_id, (quantities.get(item.medication_id) || 0) + item.quantity)
    }
    const summaries: string[] = []
    const warnings: string[] = []
    let total = 0
    for (const [id, qty] of quantities) {
      const med = medications.find((m) => Number(m.id) === id)
      if (!med) { notify('Médicament introuvable.', 'err'); return }
      if (med.stock != null && qty > Number(med.stock)) {
        notify('Stock insuffisant pour ' + med.name + '. Disponible : ' + med.stock, 'err')
        return
      }
      summaries.push(med.name + ' : ' + qty + ' ' + (med.unit || 'unité(s)'))
      total += Number(med.price) * qty
      const threshold = Number(med.stock_threshold ?? DEFAULT_THRESHOLD)
      if (med.stock != null && Number(med.stock) - qty <= threshold) warnings.push(med.name + ' : stock au seuil de ' + threshold + ' ou inférieur.')
    }

    savingRef.current = true
    setSaving(true)
    try {
      await confirmAction({ title: 'Confirmer la dispensation ?',
        message: summaries.join(' ; ') + '. Total : ' + total.toLocaleString() + ' Ar. Ces quantités seront retirées du stock.', confirmLabel: 'Enregistrer',
      }, async () => {
        await window.api.createDispensation(items)
        notify('Dispensation enregistrée. Total : ' + total.toLocaleString() + ' Ar. ' + warnings.join(' '))
        resetLines()
        setCurrentMonth(todayIso().slice(0, 7))
        setSelectedMonth(todayIso().slice(0, 7))
        setSearchNumber('')
        setSearchDate('')
        setCreating(false)
        load()
      })
    } catch (err) {
      notify(errorMessage(err, 'Erreur lors de l\'enregistrement.'), 'err')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const startEdit = (dispensation: Dispensation) => {
    setEditingId(Number(dispensation.id))
    setEditForm({ medication_id: String(dispensation.medication_id), quantity: String(dispensation.quantity) })
  }

  const saveEdit = async () => {
    if (editingId === null) return
    try {
      await confirmAction({ title: 'Appliquer les modifications ?',
        message: `Les quantités et le stock seront recalculés.`, confirmLabel: 'Modifier',
      }, async () => {
        await window.api.updateDispensation({
          id: editingId,
          medication_id: Number(editForm.medication_id),
          quantity: Number(editForm.quantity),
        })
        notify('Dispensation modifiée.')
        setEditingId(null)
        setEditForm({ medication_id: '', quantity: '' })
        load()
      })
    } catch (err) {
      notify(errorMessage(err, 'Erreur lors de la modification.'), 'err')
    }
  }

  const printReceipt = async (dispensation: Dispensation) => {
    if (printingRef.current) return
    printingRef.current = true
    setPrinting(true)
    try {
      const result = await window.api.printDispensationReceipt(dispensation.id)
      if (!result.canceled) notify('Facture envoyée à l’imprimante.')
    } catch (err) {
      notify(errorMessage(err, 'Impossible d’imprimer la facture.'), 'err')
    } finally {
      printingRef.current = false
      setPrinting(false)
    }
  }

  const downloadReceipt = async (dispensation: Dispensation) => {
    if (exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    try {
      const result = await window.api.exportDispensationReceiptPdf(dispensation.id)
      if (!result.canceled) notify(`Facture téléchargée : ${result.filePath}`)
    } catch (err) {
      notify(errorMessage(err, 'Impossible de générer la facture.'), 'err')
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  const archives = monthlyArchives(dispensations.map((row) => row.created_at), currentMonth)
  const filtered = filterPurchaseHistory(monthlyDispensations(dispensations, period).flatMap((purchase) => purchase.items), { number: searchNumber, date: searchDate, currentMonth: selectedMonth })
  const canExportMonth = monthlyDispensations(dispensations, period).length > 0
  const exportMonth = async () => {
    if (exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    try {
      const result = await window.api.exportDispensationsMonth(period)
      if (!result.canceled) notify(`Export du mois enregistré : ${result.filePath}`)
    } catch (err) {
      notify(errorMessage(err, 'Impossible d’exporter les achats du mois.'), 'err')
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }

  return {
    archives, activeArchive: archiveForMonth(selectedMonth),
    changeArchive: (archive: Archive) => {
      setSelectedMonth(archiveMonthKey(archive))
      setSearchNumber('')
      setSearchDate('')
      setEditingId(null)
    },
    creating, saving, exporting, downloadReceipt, printing, printReceipt,
    openCreate: () => {
      resetLines()
      setMessage({ text: '', type: 'ok' })
      setEditingId(null)
      setCreating(true)
    },
    closeCreate: () => { if (!savingRef.current) setCreating(false) },
    medications, filtered, lines, exportMonth, canExportMonth, searchNumber, searchDate,
    changeNumber: (value: string) => { setSearchNumber(value); setEditingId(null) },
    changeDate: (value: string) => { setSearchDate(value); if (value) setSelectedMonth(value.slice(0, 7)); setEditingId(null) },
    resetFilters: () => { setSearchNumber(''); setSearchDate(''); setEditingId(null) },
    monthTotal: filtered.reduce((sum, purchase) => sum + purchase.total, 0),
    periodLabel: new Date(period.year, period.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    addLine: () => {
      const id = nextLineId.current++
      setLines((current) => [...current, { id, medication_id: '', quantity: '' }])
    },
    removeLine: (id: number) => setLines((current) => current.length > 1 ? current.filter((line) => line.id !== id) : current),
    updateLine: (id: number, patch: Partial<{ medication_id: string; quantity: string }>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line)),
    message, submit, editingId, setEditingId, editForm, setEditForm, startEdit, saveEdit,
    totalPrice: lines.reduce((sum, line) => sum + Number(medications.find((med) => Number(med.id) === Number(line.medication_id))?.price || 0) * Number(line.quantity || 0), 0),
    unitOf: (id: string) => medications.find((m) => Number(m.id) === Number(id))?.unit || 'comprimé',
  }
}
