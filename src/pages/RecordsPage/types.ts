import type { Patient, TdrResult, Treatment } from '../../../electron/types'
import type { PatientIdentity } from '../../components/PatientPicker/usePatientPicker'

export type RecordForm = {
  patient: Patient | null
  identity: PatientIdentity
  diagnostic: string
  traitement: string
  observation: string
  appointment_date: string
  tdr_result: TdrResult | ''
  cost: number | string
  treatments: Treatment[]
  pf_method: string
  cpn_type: string
  reference: string
}
