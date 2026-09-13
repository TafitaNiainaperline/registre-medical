import { useEffect, useState } from 'react'
import { todayIso } from '../../utils/date'
import { matches } from '../../utils/text'
import type { AppointmentRow, Status, StatusTone } from './types'

export const getStatus = (date: string): Status => {
  const today = todayIso()
  if (date < today) return { text: 'Passé', tone: 'past' }
  if (date === today) return { text: "Aujourd'hui", tone: 'today' }
  return { text: 'À venir', tone: 'upcoming' }
}

export const useAppointmentsPage = () => {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.api.fetchAppointments()
      .then((rows) => setAppointments((rows || []) as AppointmentRow[]))
      .catch(() => setAppointments([]))
  }, [])

  const remove = async (id: number) => {
    if (!window.confirm('Supprimer ce rendez-vous ?')) return
    await window.api.clearAppointment(id)
    setAppointments((prev) => prev.filter((a) => a.id !== id))
  }

  const removeAll = async () => {
    if (!window.confirm('Supprimer tous les rendez-vous ? Cette action est irréversible.')) return
    for (const appointment of appointments) {
      await window.api.clearAppointment(appointment.id)
    }
    setAppointments([])
  }

  const filtered = appointments.filter((a) => matches(search, [
    a.patient_nom, a.patient_prenom, a.diagnostic, a.appointment_date,
  ]))

  const countByTone = (tone: StatusTone) =>
    appointments.filter((a) => getStatus(a.appointment_date).tone === tone).length

  return {
    appointments, filtered, search, setSearch, remove, removeAll,
    counts: { past: countByTone('past'), today: countByTone('today'), upcoming: countByTone('upcoming') },
  }
}
