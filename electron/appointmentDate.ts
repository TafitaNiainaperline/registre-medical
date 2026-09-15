export function localTodayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function appointmentDateError(value: unknown, now = new Date()): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'La date du rendez-vous est invalide.'
  }
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime()) || localTodayIso(date) !== value) {
    return 'La date du rendez-vous est invalide.'
  }
  return value < localTodayIso(now)
    ? 'La date du rendez-vous doit être aujourd’hui ou une date future.'
    : ''
}
