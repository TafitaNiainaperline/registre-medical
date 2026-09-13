import type { Appointment } from '../../../electron/types'

// La requête ne renvoie que des dossiers ayant une date de rendez-vous
export type AppointmentRow = Appointment & { appointment_date: string }

export type StatusTone = 'past' | 'today' | 'upcoming'

export type Status = {
  text: string
  tone: StatusTone
}
