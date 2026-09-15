import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Archive, MedicalRecord, Medication, Patient } from '../../../electron/types'
import type { PatientIdentity } from '../../components/PatientPicker/usePatientPicker'
import { emptyIdentity, identityFromPatient } from '../../components/PatientPicker/usePatientPicker'
import { ageEntryError, ageEntryToBirthDate } from '../../utils/record'
import type { Category } from '../../constants'
import { getCurrentUser } from '../../utils/currentUser'
import { errorMessage } from '../../utils/error'
import { capitalize, matches, normalize } from '../../utils/text'
import { todayIso } from '../../utils/date'
import { appointmentDateError } from '../../../electron/appointmentDate'
import { buildTreatmentsFromText } from '../../utils/treatments'
import {
  displayRegistryNumber, mergeRecords, toTreatment,
} from '../../utils/record'
import type { HistoryRow, MergedRecord } from '../../utils/record'
import type { RecordForm } from './types'

const emptyForm: RecordForm = {
  patient: null, identity: emptyIdentity, diagnostic: '', traitement: '', observation: '', appointment_date: '',
  tdr_result: '', reference: '', cost: '', treatments: [], pf_method: '', cpn_type: '',
}

// Les champs libres sont remis en forme à la saisie
const TEXT_FIELDS = new Set(['diagnostic', 'traitement', 'observation'])

export function appointmentStatus(date: string | null): string {
  if (!date) return ''
  const today = todayIso()
  if (date < today) return 'Rendez-vous passé'
  if (date === today) return 'Rendez-vous aujourd’hui'
  return 'Rendez-vous à venir'
}

export type RecordsTab = 'liste' | 'nouveau'

export const useRecordsPage = (category: Category) => {
  // La saisie d'un nouveau dossier est l'usage courant : c'est l'onglet d'entrée
  const [activeTab, setActiveTab] = useState<RecordsTab>('nouveau')
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [suggestionRecords, setSuggestionRecords] = useState<MergedRecord[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [archives, setArchives] = useState<Archive[]>([])
  const [activeArchive, setActiveArchive] = useState<Archive | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])

  const [form, setForm] = useState<RecordForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filters, setFilters] = useState({ search: '', diagnostic: '', age: '', date: '', act: '' })

  const [actionError, setActionError] = useState('')
  const [actionOk, setActionOk] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    form: RecordForm; editingId: number | null; category: string
  } | null>(null)
  const [historyRow, setHistoryRow] = useState<HistoryRow | null>(null)
  const [dossierHistory, setDossierHistory] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const historyRequest = useRef(0)
  const [toast, setToast] = useState('')
  const notifiedAppointments = useRef(new Set<number>())

  const currentUser = getCurrentUser()

  const load = (archive: Archive | null = activeArchive) => {
    const period = archive?.year && archive?.month
      ? { year: archive.year, month: archive.month }
      : { year: archive?.year || selectedYear }

    return Promise.all([
      window.api.fetchRecordsByArchive({ ...period, category: category.key }),
      window.api.fetchRecordsByArchive(period),
    ])
      .then(([result, suggestions]) => {
        setRecords((result || []).map((row) => ({ ...row, treatments: row.treatments || [] })))
        setSuggestionRecords((suggestions || []).map((row) => ({ ...row, treatments: row.treatments || [] })))
      })
      .catch((err: unknown) => {
        console.error('fetchRecords failed:', err)
        setRecords([])
        setSuggestionRecords([])
      })
  }

  const loadPatientHistory = async (row: HistoryRow) => {
    const request = ++historyRequest.current
    setHistoryRow(row)
    setDossierHistory([])
    setHistoryLoading(true)
    try {
      const visits = row.patient_id ? await window.api.fetchRecordsByPatient(row.patient_id) : [row]
      if (request !== historyRequest.current) return
      setDossierHistory(visits.filter((visit) => visit.category === category.key)
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id - b.id))
    } catch (err) {
      if (request !== historyRequest.current) return
      console.error('fetchRecordsByPatient failed:', err)
      setActionError('Impossible de charger l’historique du patient.')
      setDossierHistory([])
    } finally {
      if (request === historyRequest.current) setHistoryLoading(false)
    }
  }

  useEffect(() => {
    window.api.listMedications()
      .then((r) => setMedications(r || []))
      .catch(() => setMedications([]))

    window.api.listArchives()
      .then((list) => {
        setArchives(list || [])
        const years = [...new Set((list || []).map((a) => a.year))].sort((a, b) => b - a)
        if (!years.length) return
        setAvailableYears(years)
        const currentYear = new Date().getFullYear()
        setSelectedYear(years.includes(currentYear) ? currentYear : years[0])
      })
      .catch(() => setArchives([]))

    window.api.getCurrentArchive()
      .then((archive) => { setActiveArchive(archive); return load(archive) })
      .catch(() => load(null))

    setForm(emptyForm)
    setEditingId(null)
    historyRequest.current++
    setHistoryRow(null)
    setActiveTab('nouveau')
    setFilters({ search: '', diagnostic: '', age: '', date: '', act: '' })
    setActionError('')
    setActionOk('')
  }, [category.key])

  useEffect(() => {
    if (!selectedYear) return
    setActiveArchive(null)
    load({ year: selectedYear, month: new Date().getMonth() + 1, label: `${selectedYear}` })
  }, [selectedYear])

  // Rappel des rendez-vous du jour, vérifié chaque minute
  useEffect(() => {
    const check = () => {
      const appointment = records.find((row) =>
        row.appointment_date === todayIso() && !notifiedAppointments.current.has(row.id))
      if (!appointment) return
      notifiedAppointments.current.add(appointment.id)
      setToast(`Rendez-vous aujourd’hui pour ${appointment.patient_nom || 'ce patient'}.`)
      setTimeout(() => setToast(''), 5000)
    }
    check()
    const timer = setInterval(check, 60000)
    return () => clearInterval(timer)
  }, [records])

  const change = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: TEXT_FIELDS.has(name) ? capitalize(value, true) : value })
  }

  const patientVisits = records.filter((row) => form.patient
    && row.patient_id === form.patient.id
    && Number(row.archive_year) === (activeArchive?.year || new Date().getFullYear())
    && Number(row.archive_month) === (activeArchive?.month || new Date().getMonth() + 1))

  const needsTreatmentConfirmation = pendingConfirmation?.form === form
    && pendingConfirmation.editingId === editingId && pendingConfirmation.category === category.key

  useEffect(() => { setPendingConfirmation(null) }, [activeTab])

  const submit = async (e: { preventDefault: () => void }, confirmed = false) => {
    e.preventDefault()
    if (savingRef.current) return
    setActionError('')
    setActionOk('')

    const identity = form.identity
    const dateError = appointmentDateError(form.appointment_date)
    if (dateError) { setActionError(dateError); return }
    if (!form.patient) {
      if (!identity.nom.trim()) { setActionError('Le nom du patient est requis.'); return }
      if (!identity.domicile.trim()) { setActionError('L’adresse identifie le patient, elle est requise.'); return }

      const ageError = ageEntryError(identity.age)
      if (ageError) { setActionError(ageError); return }
    }

    let treatments = form.treatments
    try {
      if (!treatments.length && form.traitement.trim()) {
        treatments = buildTreatmentsFromText(form.traitement, medications)
      }
    } catch (err) {
      setActionError(errorMessage(err, 'Traitement invalide.'))
      return
    }

    if (!treatments.length) {
      if (category.key !== 'consultation') {
        setActionError('Veuillez sélectionner au moins un médicament ou un acte médical.')
        return
      }
      if (!confirmed || !needsTreatmentConfirmation) {
        setPendingConfirmation({ form, editingId, category: category.key })
        return
      }
    }

    setPendingConfirmation(null)
    // Sans sélection, le patient est créé avant l'enregistrement du dossier
    savingRef.current = true
    setSaving(true)
    let patient = form.patient
    if (!patient) {
      try {
        patient = await window.api.createPatient({
          nom: capitalize(identity.nom.trim()),
          domicile: capitalize(identity.domicile.trim()),
          sexe: identity.sexe || null,
          phone: identity.phone.trim() || null,
          birth_date: ageEntryToBirthDate(identity.age),
          created_by: currentUser.id || null,
        })
        setForm({ ...form, patient, identity: identityFromPatient(patient) })
      } catch (err) {
        setActionError(errorMessage(err, 'Impossible de créer le patient.'))
        savingRef.current = false
        setSaving(false)
        return
      }
    }

    const payload = {
      created_by: currentUser.id || null,
      patient_id: patient.id,
      diagnostic: capitalize(form.diagnostic),
      appointment_date: form.appointment_date || null,
      tdr_result: category.key === 'consultation' ? (form.tdr_result || null) : null,
      reference: category.key === 'consultation' ? (form.reference.trim() || null) : null,
      pf_method: category.key === 'pf' ? (form.pf_method || null) : null,
      cpn_type: category.key === 'cpn' ? (form.cpn_type || null) : null,
      traitement: capitalize(form.traitement),
      treatments,
      observation: capitalize(form.observation),
      cost: treatments.reduce((sum, t) => sum + Number(t.unit_price) * Number(t.quantity), 0),
    }

    try {
      if (editingId) {
        await window.api.updateRecord(editingId, payload)
        setActionOk('Visite modifiée.')
      } else {
        await window.api.createRecord({
          category: category.key,
          archive_year: activeArchive?.year,
          archive_month: activeArchive?.month,
          ...payload,
        })
        setActionOk('Visite enregistrée. Son reçu reste disponible dans la liste.')
      }
      setForm(emptyForm)
      setEditingId(null)
      historyRequest.current++
      setHistoryRow(null)
      setActiveTab('liste')
      await load()
    } catch (err) {
      console.error('submit failed:', err)
      setActionError(errorMessage(err, 'Erreur lors de l’enregistrement.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const edit = (row: MergedRecord) => {
    historyRequest.current++
    setHistoryRow(null)
    setEditingId(row.id)
    setActiveTab('nouveau')
    const patient = row.patient_id ? {
        id: row.patient_id,
        patient_number: row.patient_number,
        nom: row.patient_nom,
        prenom: row.patient_prenom || null,
        sexe: row.sexe,
        domicile: row.domicile,
        phone: row.patient_phone,
        birth_date: row.birth_date,
        birth_estimated: 0,
      created_at: row.created_at,
      updated_at: null,
    } : null

    setForm({
      patient,
      identity: patient ? identityFromPatient(patient) : emptyIdentity,
      diagnostic: capitalize(row.diagnostic || ''),
      appointment_date: row.appointment_date || '',
      tdr_result: row.tdr_result || '',
      reference: row.reference || '',
      traitement: capitalize(row.traitement || ''),
      observation: capitalize(row.observation || ''),
      cost: row.cost || '',
      treatments: row.treatments.map(toTreatment),
      pf_method: row.pf_method || '',
      cpn_type: row.cpn_type || '',
    })
  }

  const viewHistory = async (row: HistoryRow) => {
    setActionError('')
    await loadPatientHistory(row)
  }

  const downloadReceipt = async (row: { id: number }) => {
    setActionError('')
    setActionOk('')
    try {
      const result = await window.api.exportReceiptPdf(row.id)
      if (result?.canceled) return
      setActionOk(`Reçu téléchargé : ${result.filePath}`)
    } catch (err) {
      console.error('exportReceiptPdf failed:', err)
      setActionError(errorMessage(err, 'Impossible de générer le reçu.'))
    }
  }

  const remove = (id: number) => window.api.deleteRecord(id).then(() => load())


  const diagnosticOptions = useMemo(() => {
    const counts = new Map<string, number>()
    suggestionRecords.forEach((row) => {
      const diagnostic = String(row.diagnostic || '').trim()
      if (diagnostic) counts.set(diagnostic, (counts.get(diagnostic) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr', { sensitivity: 'base' }))
      .map(([diagnostic]) => diagnostic)
  }, [suggestionRecords])

  const groupedRecords = useMemo(() => mergeRecords(records), [records])

  const filteredRecords = groupedRecords.filter((row) => {
    const acts = row.treatments.filter((t) => t.item_type === 'act').map((t) => normalize(t.name))
    return matches(filters.search, [
      `${row.patient_nom || ''} ${row.patient_prenom || ''}`, row.diagnostic,
      displayRegistryNumber(row.registry_number), row.registry_number, row.reference,
    ])
      && (!filters.diagnostic || normalize(row.diagnostic).includes(normalize(filters.diagnostic)))
      && (!filters.age || normalize(row.age).includes(normalize(filters.age)))
      && (!filters.date || row.created_at?.slice(0, 10) === filters.date)
      && (!filters.act || acts.some((name) => name.includes(normalize(filters.act))))
  })

  const diagnosticSummary = useMemo(() => {
    const counts = new Map<string, number>()
    groupedRecords.forEach((row) => {
      const diagnostic = String(row.diagnostic || '').trim()
      if (diagnostic) counts.set(diagnostic, (counts.get(diagnostic) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [groupedRecords])

  return {
    activeTab, setActiveTab,
    records: groupedRecords, medications, archives, activeArchive, setActiveArchive, selectedYear, setSelectedYear,
    availableYears, form, setForm, editingId, filters, setFilters, actionError, actionOk, toast,
    patientVisits, saving, historyRow, dossierHistory, historyLoading,
    needsTreatmentConfirmation,
    dismissTreatmentConfirmation: () => setPendingConfirmation(null),
    confirmWithoutTreatment: () => {
      if (needsTreatmentConfirmation) return submit({ preventDefault() {} }, true)
    },
    isAdmin: currentUser.role === 'admin',
    change, submit, edit, viewHistory, downloadReceipt, remove, load,
    closeHistory: () => { historyRequest.current++; setHistoryRow(null) },
    selectPatient: (patient: Patient) => {
      historyRequest.current++
      setHistoryRow(null)
      setForm({ ...form, patient, identity: identityFromPatient(patient) })
    },
    // On repart d'une identité vierge : aucun mélange possible entre deux fiches
    clearPatient: () => {
      historyRequest.current++
      setHistoryRow(null)
      setForm({ ...form, patient: null, identity: emptyIdentity })
    },
    setIdentity: (identity: PatientIdentity) => setForm({ ...form, identity }),
    cancelEdit: () => { setEditingId(null); setForm(emptyForm) },
    clearFilters: () => setFilters({ search: '', diagnostic: '', age: '', date: '', act: '' }),
    diagnosticOptions,
    filteredRecords,
    diagnosticSummary,
  }
}
