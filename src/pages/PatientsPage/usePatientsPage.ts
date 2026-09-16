import { notify as showToast, confirmAction } from '../../utils/notifications'
import { useEffect, useState } from 'react'
import type { MedicalRecord, Patient, PatientAddressEntry } from '../../../electron/types'
import { getCurrentUser } from '../../utils/currentUser'
import { errorMessage } from '../../utils/error'
import { capitalize } from '../../utils/text'
import type { AgeEntry } from '../../utils/record'
import { ageEntryError, ageEntryToBirthDate, birthDateToAgeEntry, emptyAge } from '../../utils/record'

export type PatientForm = {
  nom: string
  domicile: string
  sexe: string
  phone: string
  age: AgeEntry
}

const emptyForm: PatientForm = { nom: '', domicile: '', sexe: '', phone: '', age: emptyAge }

const toForm = (patient: Patient): PatientForm => ({
  nom: patient.nom,
  domicile: patient.domicile || '',
  sexe: patient.sexe || '',
  phone: patient.phone || '',
  age: birthDateToAgeEntry(patient.birth_date),
})

export const usePatientsPage = () => {
  const currentUser = getCurrentUser()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [addressLog, setAddressLog] = useState<PatientAddressEntry[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<PatientForm>(emptyForm)
  const [message, setMessage] = useState<{ text: string; type: 'ok' | 'err' }>({ text: '', type: 'ok' })

  const load = (query = search) =>
    window.api.listPatients(query).then(setPatients).catch(() => setPatients([]))

  useEffect(() => { load() }, [])
  useEffect(() => {
    const timer = setTimeout(() => load(search), 200)
    return () => clearTimeout(timer)
  }, [search])

  const notify = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMessage({ text, type })
    showToast(text, type)
    setTimeout(() => setMessage({ text: '', type: 'ok' }), 3000)
  }

  const open = async (patient: Patient) => {
    setSelected(patient)
    setEditing(false)
    setRecords(await window.api.fetchRecordsByPatient(patient.id).catch(() => []))
    setAddressLog(await window.api.getPatientAddressLog(patient.id).catch(() => []))
  }

  const close = () => {
    setSelected(null)
    setRecords([])
    setAddressLog([])
    setEditing(false)
  }

  const startCreate = () => {
    setSelected(null)
    setForm(emptyForm)
    setEditing(true)
  }

  const startEdit = () => {
    if (!selected) return
    setForm(toForm(selected))
    setEditing(true)
  }

  const save = async () => {
    if (!form.nom.trim()) { notify('Le nom du patient est requis.', 'err'); return }
    if (!form.domicile.trim()) { notify('L’adresse identifie le patient, elle est requise.', 'err'); return }

    const ageError = ageEntryError(form.age)
    if (ageError) { notify(ageError, 'err'); return }

    const payload = {
      nom: capitalize(form.nom.trim()),
      domicile: capitalize(form.domicile.trim()),
      sexe: form.sexe || null,
      phone: form.phone.trim() || null,
      birth_date: ageEntryToBirthDate(form.age),
      created_by: currentUser.id || null,
    }

    try {
      await confirmAction({ title: 'Enregistrer la fiche patient ?',
        message: `${payload.nom} : ${selected ? "mettre à jour les informations" : "créer la fiche"}.`, confirmLabel: 'Enregistrer',
      }, async () => {
        if (selected) {
          await window.api.updatePatient(selected.id, payload)
          notify('Fiche patient mise à jour.')
          const refreshed = await window.api.getPatient(selected.id)
          if (refreshed) await open(refreshed)
        } else {
          const created = await window.api.createPatient(payload)
          notify('Patient créé.')
          await open(created)
        }
        setEditing(false)
        load()
      })
    } catch (err) {
      notify(errorMessage(err, 'Enregistrement impossible.'), 'err')
    }
  }

  return {
    patients, search, setSearch, selected, records, addressLog, editing, form, setForm, message,
    open, close, startCreate, startEdit, save,
    cancelEdit: () => setEditing(false),
  }
}
