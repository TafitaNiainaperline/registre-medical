import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Archive, Medication, Patient } from '../../../electron/types'
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
  const [records, setRecords] = useState<MergedRecord[]>([])
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
  const [duplicate, setDuplicate] = useState<MergedRecord | null>(null)
  const [historyRow, setHistoryRow] = useState<MergedRecord | null>(null)
  const [dossierHistory, setDossierHistory] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
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
        setRecords(mergeRecords(result || []))
        setSuggestionRecords(mergeRecords(suggestions || []))
      })
      .catch((err: unknown) => {
        console.error('fetchRecords failed:', err)
        setRecords([])
        setSuggestionRecords([])
      })
  }

  const loadDossierHistory = async (dossierId: number | null, fallback: MergedRecord | null) => {
    if (!dossierId) {
      if (!fallback) { setDossierHistory([]); return }
      setDossierHistory(records.filter((row) => Number(row.patient_id) === Number(fallback.patient_id)))
      setHistoryRow(fallback)
      return
    }

    setHistoryLoading(true)
    try {
      setDossierHistory(await window.api.fetchRecordsByDossier(dossierId) || [])
    } catch (err) {
      console.error('fetchRecordsByDossier failed:', err)
      setActionError('Impossible de charger l’historique du dossier.')
      setDossierHistory([])
    } finally {
      setHistoryLoading(false)
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

  // Même patient, même registre, même mois : c'est le même dossier
  const findMonthDuplicate = () => {
    if (!form.patient) return undefined
    return records.find((row) => (
      Number(row.id) !== Number(editingId)
      && Number(row.patient_id) === Number(form.patient?.id)
      && (!activeArchive?.year || Number(row.archive_year) === Number(activeArchive.year))
      && (!activeArchive?.month || Number(row.archive_month) === Number(activeArchive.month))
    ))
  }

  const submit = async (e: { preventDefault: () => void }, force = false) => {
    e.preventDefault()
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

    if (!editingId && !force) {
      const existing = findMonthDuplicate()
      if (existing) {
        setDuplicate(existing)
        loadDossierHistory(existing.dossier_id, existing)
        setActionError(`Ce patient a déjà un dossier ce mois dans ce registre (N° ${displayRegistryNumber(existing.registry_number)}). Une nouvelle consultation reprendra ce même numéro.`)
        return
      }
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
      setActionError('Veuillez sélectionner au moins un médicament ou un acte médical.')
      return
    }

    // Sans sélection, le patient est créé avant l'enregistrement du dossier
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
        setActionOk('Dossier modifié.')
      } else {
        await window.api.createRecord({
          category: category.key,
          archive_year: activeArchive?.year,
          archive_month: activeArchive?.month,
          ...payload,
        })
        setActionOk('Dossier ajouté.')
      }
      setForm(emptyForm)
      setEditingId(null)
      await load()
    } catch (err) {
      console.error('submit failed:', err)
      setActionError(errorMessage(err, 'Erreur lors de l’enregistrement.'))
    }
  }

  const edit = (row: MergedRecord) => {
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

  const viewHistory = async (row: MergedRecord) => {
    setActionError('')
    setActionOk('')
    setDuplicate(null)
    setHistoryRow(row)
    await loadDossierHistory(row.dossier_id, row)
  }

  const continueTreatment = async () => {
    if (!duplicate) return
    setActionError('')
    setActionOk('')

    // Les lignes du sélecteur font foi : jamais le texte repris d'un ancien dossier
    if (!form.treatments.length) {
      setActionError('Veuillez sélectionner au moins un médicament ou un acte médical.')
      return
    }

    try {
      await window.api.continueRecord(duplicate.id, {
        treatments: form.treatments,
        observation: form.observation,
        created_by: currentUser.id || null,
      })
      setActionOk('Traitement ajouté au dossier existant.')
      setForm(emptyForm)
      setDuplicate(null)
      setDossierHistory([])
      await load()
    } catch (err) {
      console.error('continueRecord failed:', err)
      setActionError(errorMessage(err, 'Impossible d\'ajouter le traitement.'))
    }
  }

  const loadDuplicate = () => {
    if (!duplicate) return
    edit(duplicate)
    setDuplicate(null)
    setActionError('')
    setDossierHistory([])
  }

  const downloadReceipt = async (row: MergedRecord) => {
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

  const filteredRecords = records.filter((row) => {
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
    records.forEach((row) => {
      const diagnostic = String(row.diagnostic || '').trim()
      if (diagnostic) counts.set(diagnostic, (counts.get(diagnostic) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [records])

  return {
    activeTab, setActiveTab,
    records, medications, archives, activeArchive, setActiveArchive, selectedYear, setSelectedYear,
    availableYears, form, setForm, editingId, filters, setFilters, actionError, actionOk, toast,
    duplicate, historyRow, dossierHistory, historyLoading,
    isAdmin: currentUser.role === 'admin',
    change, submit, edit, viewHistory, continueTreatment, loadDuplicate, downloadReceipt, remove, load,
    selectPatient: (patient: Patient) => setForm({ ...form, patient, identity: identityFromPatient(patient) }),
    // On repart d'une identité vierge : aucun mélange possible entre deux fiches
    clearPatient: () => setForm({ ...form, patient: null, identity: emptyIdentity }),
    setIdentity: (identity: PatientIdentity) => setForm({ ...form, identity }),
    cancelEdit: () => { setEditingId(null); setForm(emptyForm) },
    clearFilters: () => setFilters({ search: '', diagnostic: '', age: '', date: '', act: '' }),
    diagnosticOptions,
    filteredRecords,
    diagnosticSummary,
  }
}
