import { notify as showToast, confirmAction } from '../../utils/notifications'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Archive, CashOutflow } from '../../../electron/types'
import { errorMessage } from '../../utils/error'
import { todayIso } from '../../utils/date'
import { watchCurrentMonth } from '../../utils/watchCurrentMonth'
import { archiveForMonth, archiveMonthKey, monthlyArchives } from '../../utils/monthlyArchives'

type Totals = {
  entries: number
  outflows: number
  balance: number
}

export const useSortiesPage = () => {
  const [creating, setCreating] = useState(false)
  const [outflows, setOutflows] = useState<CashOutflow[]>([])
  const [totals, setTotals] = useState<Totals>({ entries: 0, outflows: 0, balance: 0 })
  const [currentMonth, setCurrentMonth] = useState(() => todayIso().slice(0, 7))
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [archives, setArchives] = useState<Archive[]>([archiveForMonth(currentMonth)])
  const activeArchive = archiveForMonth(selectedMonth)
  const archiveLabel = activeArchive.label
  const [form, setForm] = useState({ date: todayIso(), designation: '', amount: '' })
  const [error, storeError] = useState('')
  const setError = (text: string) => {
    storeError(text)
    if (text) showToast(text, 'err')
  }
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<CashOutflow | null>(null)
  const [editForm, setEditForm] = useState({ date: '', designation: '', amount: '' })
  const loadRequest = useRef(0)

  const loadData = useCallback(async () => {
    const request = ++loadRequest.current
    const month = selectedMonth
    const period = { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) }
    try {
      const [list, outflowTotal, records, dispensed, recordArchives, dispensations] = await Promise.all([
        window.api.listCashOutflows({}), window.api.getCashOutflowTotal(period),
        window.api.fetchRecordsByArchive(period), window.api.getDispensationTotal(period),
        window.api.listArchives(), window.api.getDispensations(),
      ])
      if (request !== loadRequest.current) return
      const entries = (records || []).reduce((sum, row) => sum + (Number(row.cost) || 0), 0) + Number(dispensed || 0)
      setArchives(monthlyArchives([
        ...list.map((row) => row.outflow_date),
        ...recordArchives.map(archiveMonthKey),
        ...dispensations.map((row) => row.created_at),
      ], todayIso().slice(0, 7)))
      setOutflows((list || []).filter((row) => row.outflow_date.slice(0, 7) === month))
      setTotals({ entries, outflows: Number(outflowTotal || 0), balance: entries - Number(outflowTotal || 0) })
    } catch {
      if (request !== loadRequest.current) return
      setOutflows([])
      setTotals({ entries: 0, outflows: 0, balance: 0 })
    }
  }, [selectedMonth])

  useEffect(() => {
    setOutflows([])
    setTotals({ entries: 0, outflows: 0, balance: 0 })
    loadData()
    const requests = loadRequest
    return () => { requests.current++ }
  }, [loadData, currentMonth])

  useEffect(() => watchCurrentMonth((month) => {
    setCurrentMonth(month)
    setSelectedMonth(month)
    setEditing(null)
  }), [])

  // Valide les trois champs d'une sortie de caisse
  const invalidReason = (values: { date: string; designation: string; amount: string }) => {
    if (!values.date) return 'Veuillez saisir la date.'
    if (!values.designation.trim()) return 'Veuillez saisir la désignation.'
    if (!values.amount || Number(values.amount) <= 0) return 'Veuillez saisir un montant valide.'
    return ''
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const reason = invalidReason(form)
    if (reason) { setError(reason); return }

    try {
      await confirmAction({ title: 'Enregistrer cette sortie ?',
        message: `${form.designation.trim()} : ${Number(form.amount).toLocaleString()} Ar seront déduits de la caisse.`, confirmLabel: 'Enregistrer',
      }, async () => {
        await window.api.createCashOutflow({
          outflow_date: form.date,
          designation: form.designation.trim(),
          amount: Number(form.amount),
        })
        setForm({ ...form, designation: '', amount: '' })
        setSuccess('Sortie enregistrée avec succès.')
        showToast('Sortie enregistrée avec succès.')
        setCreating(false)
        setTimeout(() => setSuccess(''), 3000)
        const savedMonth = form.date.slice(0, 7)
        if (savedMonth === selectedMonth) loadData()
        else setSelectedMonth(savedMonth)
      })
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors de l\'enregistrement.'))
    }
  }

  const remove = (id: number) => confirmAction({
    title: 'Confirmer la suppression', message: 'Supprimer cette sortie ?', confirmLabel: 'Supprimer', danger: true,
  }, async () => {
    try {
      await window.api.deleteCashOutflow(id)
      showToast('Sortie supprimée.')
      loadData()
    } catch (err) {
      showToast(errorMessage(err, 'Erreur lors de la suppression.'), 'err')
    }
  })

  const openEdit = (outflow: CashOutflow) => {
    setEditing(outflow)
    setEditForm({ date: outflow.outflow_date, designation: outflow.designation, amount: String(outflow.amount) })
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm({ date: '', designation: '', amount: '' })
  }

  const update = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editing) return

    const reason = invalidReason(editForm)
    if (reason) { showToast(reason, 'err'); return }

    try {
      await confirmAction({ title: 'Appliquer les modifications ?',
        message: `Cette modification changera les informations de la sortie de caisse.`, confirmLabel: 'Modifier',
      }, async () => {
        await window.api.updateCashOutflow(editing.id, {
          outflow_date: editForm.date,
          designation: editForm.designation.trim(),
          amount: Number(editForm.amount),
        })
        showToast('Sortie modifiée.')
        closeEdit()
        loadData()
      })
    } catch (err) {
      showToast(errorMessage(err, 'Erreur lors de la modification.'), 'err')
    }
  }

  return {
    archives, activeArchive,
    changeArchive: (archive: Archive) => { setSelectedMonth(archiveMonthKey(archive)); setEditing(null) },
    creating,
    openCreate: () => { setError(''); setForm({ date: todayIso(), designation: '', amount: '' }); setCreating(true) },
    closeCreate: () => { setError(''); setCreating(false) },
    outflows, totals, archiveLabel, form, setForm, error, success, submit, remove,
    editing, editForm, setEditForm, openEdit, closeEdit, update,
  }
}
