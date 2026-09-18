import { useEffect, useState } from 'react'
import type { Patient, PatientMatch } from '../../../electron/types'
import type { AgeEntry } from '../../utils/record'
import { birthDateToAgeEntry, emptyAge } from '../../utils/record'

// Identité saisie dans le formulaire : elle sert soit à retrouver un patient,
// soit à en créer un nouveau au moment de l'enregistrement.
export type PatientIdentity = {
  nom: string
  domicile: string
  sexe: string
  phone: string
  age: AgeEntry
}

export const emptyIdentity: PatientIdentity = {
  nom: '', domicile: '', sexe: '', phone: '', age: emptyAge,
}

export const identityFromPatient = (patient: Patient): PatientIdentity => ({
  nom: `${patient.nom}${patient.prenom ? ` ${patient.prenom}` : ''}`,
  domicile: patient.domicile || '',
  sexe: patient.sexe || '',
  phone: patient.phone || '',
  age: birthDateToAgeEntry(patient.birth_date),
})

export const usePatientPicker = (identity: PatientIdentity, patient: Patient | null) => {
  const [matches, setMatches] = useState<PatientMatch[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [addresses, setAddresses] = useState<string[]>([])

  useEffect(() => {
    if (patient) return
    let cancelled = false
    window.api.listPatientAddresses()
      .then((found) => { if (!cancelled) setAddresses(found) })
      .catch(() => { if (!cancelled) setAddresses([]) })
    return () => { cancelled = true }
  }, [patient])

  // Suggestions tolérantes aux fautes, tant qu'aucun patient n'est retenu
  useEffect(() => {
    if (patient || identity.nom.trim().length < 2) { setMatches([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      window.api.suggestPatients(identity.nom, identity.domicile || undefined)
        .then((found) => { if (!cancelled) setMatches(found) })
        .catch(() => { if (!cancelled) setMatches([]) })
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [identity.nom, identity.domicile, patient])

  // Une nouvelle recherche réaffiche les propositions
  useEffect(() => { setDismissed(false) }, [identity.nom])

  return {
    addresses,
    matches,
    showMatches: !patient && !dismissed && matches.length > 0,
    dismiss: () => setDismissed(true),
  }
}
