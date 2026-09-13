import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

export type Day = {
  iso: string
  label: number
  outside: boolean
  today: boolean
}

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export const useDatePicker = (value: string, onChange: (value: string) => void) => {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => (value ? new Date(value) : new Date()))
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) setCursor(new Date(value))
  }, [value])

  // Modale : la fermeture passe par le fond, la croix ou Échap
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const todayIso = iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  // Grille de 6 semaines commençant le lundi
  const firstDay = new Date(year, month, 1)
  const offset = (firstDay.getDay() + 6) % 7
  const days: Day[] = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index)
    const dayIso = iso(date.getFullYear(), date.getMonth(), date.getDate())
    return {
      iso: dayIso,
      label: date.getDate(),
      outside: date.getMonth() !== month,
      today: dayIso === todayIso,
    }
  })

  const select = (day: Day) => {
    onChange(day.iso)
    setOpen(false)
  }

  return {
    open, setOpen, wrapperRef, days, year, month,
    previous: () => setCursor(new Date(year, month - 1, 1)),
    next: () => setCursor(new Date(year, month + 1, 1)),
    select,
    selectToday: () => select({ iso: todayIso, label: 0, outside: false, today: true }),
    clear: () => { onChange(''); setOpen(false) },
    // Le clic ne ferme que s'il tombe sur le fond, pas dans le calendrier
    closeOnBackdrop: (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) setOpen(false)
    },
  }
}
