import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CashOutflow } from '../../../electron/types'
import { errorMessage } from '../../utils/error'
import { todayIso } from '../../utils/date'

type Totals = {
  entries: number
  outflows: number
  balance: number
}

export const useSortiesPage = () => {
  const [creating, setCreating] = useState(false)
  const [outflows, setOutflows] = useState<CashOutflow[]>([])
  const [totals, setTotals] = useState<Totals>({ entries: 0, outflows: 0, balance: 0 })
  const [archiveLabel, setArchiveLabel] = useState('')
  const [form, setForm] = useState({ date: todayIso(), designation: '', amount: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<CashOutflow | null>(null)
  const [editForm, setEditForm] = useState({ date: '', designation: '', amount: '' })

  const loadData = async () => {
    try {
      const current = await window.api.getCurrentArchive()
      if (current?.label) setArchiveLabel(current.label)

      const period = { year: current?.year, month: current?.month }
      const list = await window.api.listCashOutflows(period) || []
      setOutflows(list)

      const outflowTotal = Number(await window.api.getCashOutflowTotal(period) || 0)
      const records = await window.api.fetchRecordsByArchive(period) || []
      const dispensed = Number(await window.api.getDispensationTotal(period) || 0)
      const entries = records.reduce((sum, row) => sum + (Number(row.cost) || 0), 0) + dispensed

      setTotals({ entries, outflows: outflowTotal, balance: entries - outflowTotal })
    } catch {
      setOutflows([])
      setTotals({ entries: 0, outflows: 0, balance: 0 })
    }
  }

  useEffect(() => { loadData() }, [])

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
      await window.api.createCashOutflow({
        outflow_date: form.date,
        designation: form.designation.trim(),
        amount: Number(form.amount),
      })
      setForm({ ...form, designation: '', amount: '' })
      setSuccess('Sortie enregistrée avec succès.')
      setCreating(false)
      setTimeout(() => setSuccess(''), 3000)
      loadData()
    } catch (err) {
      setError(errorMessage(err, 'Erreur lors de l\'enregistrement.'))
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Supprimer cette sortie ?')) return
    try {
      await window.api.deleteCashOutflow(id)
      loadData()
    } catch (err) {
      alert(errorMessage(err, 'Erreur lors de la suppression.'))
    }
  }

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
    if (reason) { alert(reason); return }

    try {
      await window.api.updateCashOutflow(editing.id, {
        outflow_date: editForm.date,
        designation: editForm.designation.trim(),
        amount: Number(editForm.amount),
      })
      closeEdit()
      loadData()
    } catch (err) {
      alert(errorMessage(err, 'Erreur lors de la modification.'))
    }
  }

  return {
    creating,
    openCreate: () => { setError(''); setCreating(true) },
    closeCreate: () => { setError(''); setCreating(false) },
    outflows, totals, archiveLabel, form, setForm, error, success, submit, remove,
    editing, editForm, setEditForm, openEdit, closeEdit, update,
  }
}
