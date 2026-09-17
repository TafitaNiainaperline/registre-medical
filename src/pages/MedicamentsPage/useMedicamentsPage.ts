import { notify as showToast, confirmAction } from '../../utils/notifications'
import { useEffect, useState } from 'react'
import type { ItemType, MedicalRecord, Medication, StockHistoryEntry, TopSellingMedication } from '../../../electron/types'
import { getCurrentUser } from '../../utils/currentUser'
import { errorMessage } from '../../utils/error'
import { capitalize, normalize } from '../../utils/text'
import { formatDate, formatDay, todayIso } from '../../utils/date'
import type { ActSummaryEntry, MedicationForm } from './types'

type MessageType = 'ok' | 'err'

const DEFAULT_THRESHOLD = 100

const emptyForm: MedicationForm = {
  name: '', price: '', stock: '', stock_threshold: String(DEFAULT_THRESHOLD), unit: 'comprimé', date: todayIso(),
}

export const isLowStock = (medication: Medication): boolean =>
  medication.item_type !== 'act' && medication.stock !== null && medication.stock !== undefined
  && Number(medication.stock) <= Number(medication.stock_threshold ?? DEFAULT_THRESHOLD)

export const useMedicamentsPage = () => {
  const currentUser = getCurrentUser()
  const isAdmin = currentUser.role === 'admin'

  const [rows, setRows] = useState<Medication[]>([])
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [topSelling, setTopSelling] = useState<TopSellingMedication[]>([])
  const [form, setForm] = useState<MedicationForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalType, setModalType] = useState<ItemType | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ItemType>('medication')
  const [message, setMessage] = useState<{ type: MessageType; text: string }>({ type: 'ok', text: '' })
  const [stockTarget, setStockTarget] = useState<Medication | null>(null)
  const [stockQuantity, setStockQuantity] = useState('')
  const [stockDate, setStockDate] = useState(todayIso())
  const [historyTarget, setHistoryTarget] = useState<Medication | null>(null)
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([])

  const load = () => window.api.listMedications().then((r) => setRows(r || [])).catch(() => setRows([]))

  useEffect(() => {
    load()
    window.api.fetchRecordsByArchive({}).then((r) => setRecords(r || [])).catch(() => setRecords([]))
    window.api.getTopSellingMedications().then(setTopSelling).catch(() => setTopSelling([]))
  }, [])

  const notify = (text: string, type: MessageType = 'ok') => {
    setMessage({ text, type })
    showToast(text, type)
    setTimeout(() => setMessage({ text: '', type: 'ok' }), 2500)
  }

  const openCreate = (itemType: ItemType) => {
    setEditingId(null)
    setForm({ ...emptyForm, date: todayIso(), item_type: itemType })
    setModalType(itemType)
  }

  const openEdit = (medication: Medication) => {
    setEditingId(medication.id)
    setForm({
      name: capitalize(medication.name || ''),
      price: String(medication.price ?? ''),
      stock: medication.stock === null || medication.stock === undefined ? '' : String(medication.stock),
      stock_threshold: String(medication.stock_threshold ?? DEFAULT_THRESHOLD),
      unit: medication.unit || 'comprimé',
      item_type: medication.item_type || 'medication',
      date: medication.created_at ? formatDate(medication.created_at) : todayIso(),
    })
    setModalType(medication.item_type || 'medication')
  }

  const closeModal = () => {
    setModalType(null)
    setEditingId(null)
    setForm(emptyForm)
  }

  const submit = async () => {
    const isAct = modalType === 'act'
    const name = capitalize(form.name.trim())
    if (!name) { notify(isAct ? "Nom de l'acte requis." : 'Nom du médicament requis.', 'err'); return }

    const payload = {
      item_type: modalType || 'medication',
      name,
      price: Number(form.price) || 0,
      unit: isAct ? null : (form.unit || 'comprimé'),
      stock: isAct || !isAdmin || form.stock === '' ? null : Number(form.stock),
      stock_threshold: isAct ? DEFAULT_THRESHOLD : (form.stock_threshold === '' ? DEFAULT_THRESHOLD : Number(form.stock_threshold)),
      date: isAct ? undefined : form.date,
      created_by: currentUser.id || null,
    }

    try {
      await confirmAction({ title: 'Enregistrer cet élément ?',
        message: `${name} : ${editingId ? "appliquer les modifications" : "ajouter au catalogue"}.`, confirmLabel: 'Enregistrer',
      }, async () => {
        if (editingId) {
          const { stock: _stock, ...changes } = payload
          await window.api.updateMedication(editingId, changes)
        }
        else await window.api.createMedication(payload)

        const reachedThreshold = payload.stock !== null && payload.stock <= payload.stock_threshold
        notify(editingId
          ? (isAct ? 'Acte médical mis à jour.' : 'Médicament mis à jour.')
          : (isAct ? 'Acte médical ajouté.' : `Médicament ajouté.${reachedThreshold ? ` Attention : stock atteint le seuil de ${payload.stock_threshold}.` : ''}`))

        closeModal()
        load()
      })
    } catch (err) {
      notify(errorMessage(err, 'Erreur lors de l\'enregistrement.'), 'err')
    }
  }

  const openStock = (medication: Medication) => {
    setStockTarget(medication)
    setStockQuantity('')
    setStockDate(todayIso())
  }

  const closeStock = () => {
    setStockTarget(null)
    setStockQuantity('')
    setStockDate(todayIso())
  }

  const confirmStock = async () => {
    if (!stockTarget) return

    const quantity = Number(stockQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      notify('Veuillez saisir une quantité valide.', 'err')
      return
    }

    try {
      await confirmAction({ title: 'Ajouter au stock ?',
        message: `${stockTarget.name} : +${quantity} ${stockTarget.unit || "unité(s)"} le ${formatDay(stockDate)}.`, confirmLabel: 'Ajouter au stock',
      }, async () => {
        await window.api.addMedicationStock(stockTarget.id, quantity, currentUser.id || null, stockDate)

        const threshold = Number(stockTarget.stock_threshold ?? DEFAULT_THRESHOLD)
        const newStock = (Number(stockTarget.stock) || 0) + quantity
        const warning = newStock <= threshold ? ` Attention : stock atteint le seuil de ${threshold}.` : ''

        notify(`Stock ajouté : +${quantity} le ${formatDay(stockDate)}.${warning}`)
        closeStock()
        load()
      })
    } catch (err) {
      notify(errorMessage(err, 'Erreur lors de l\'ajout du stock.'), 'err')
    }
  }

  const openHistory = async (medication: Medication) => {
    setHistoryTarget(medication)
    setStockHistory(await window.api.getMedicationStockHistory(medication.id))
  }

  const exportStock = async () => {
    try {
      const result = await window.api.exportStockExcel()
      if (!result?.success) return
      showToast('Stock exporté avec succès.')
    } catch (err) {
      showToast(errorMessage(err, 'Export du stock impossible.'), 'err')
    }
  }

  // Actes facturés, agrégés depuis les dossiers
  const actTotals = new Map<string, ActSummaryEntry>()
  records.forEach((row) => {
    (row.treatments || []).forEach((treatment) => {
      if (treatment.item_type !== 'act') return
      const name = String(treatment.name || '').trim()
      if (!name) return
      const entry = actTotals.get(name) || { name, count: 0, total: 0 }
      entry.count += 1
      entry.total += (Number(treatment.unit_price) || 0) * (Number(treatment.quantity) || 1)
      actTotals.set(name, entry)
    })
  })

  const query = normalize(search)
  const matchingRows = rows.filter((row) => normalize(row.name).includes(query))
  const counts = {
    all: matchingRows.length,
    medication: matchingRows.filter((row) => row.item_type !== 'act').length,
    act: matchingRows.filter((row) => row.item_type === 'act').length,
  }

  return {
    currentUser, isAdmin, rows, topSelling, form, setForm, editingId, modalType, search, setSearch, message,
    openCreate, openEdit, closeModal, submit, notify, exportStock,
    stockTarget, stockQuantity, setStockQuantity, stockDate, setStockDate, openStock, closeStock, confirmStock,
    historyTarget, stockHistory, openHistory, closeHistory: () => setHistoryTarget(null),
    typeFilter, setTypeFilter, counts,
    filtered: matchingRows.filter((row) => (row.item_type || 'medication') === typeFilter),
    filteredTopSelling: topSelling.filter((row) => normalize(row.medication_name).includes(query)),
    lowStockCount: rows.filter(isLowStock).length,
    actSummary: Array.from(actTotals.values()).filter((act) => normalize(act.name).includes(query)).sort((a, b) => b.count - a.count),
  }
}
