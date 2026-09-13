const MADAGASCAR_OFFSET_MINUTES = 3 * 60

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function toLocal(utcString: string | Date): Date {
  const date = new Date(utcString)
  return new Date(date.getTime() + MADAGASCAR_OFFSET_MINUTES * 60 * 1000)
}

// « 09 Juin 2026 », ou « Lun 09 Juin 2026 » quand le jour de la semaine compte
function write(date: Date, withWeekday: boolean): string {
  const day = String(date.getDate()).padStart(2, '0')
  const rest = `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  return withWeekday ? `${WEEKDAYS[date.getDay()]} ${rest}` : rest
}

// Date du jour au format AAAA-MM-JJ
export function todayIso(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

// Horodatage enregistré en base, ramené à l'heure de Madagascar
export function formatDate(utcString: string | null | undefined, fallback = '-'): string {
  if (!utcString) return fallback
  return write(toLocal(utcString), false)
}

export function formatDateTime(utcString: string | null | undefined, fallback = '-'): string {
  if (!utcString) return fallback
  const local = toLocal(utcString)
  return `${write(local, false)} ${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`
}

// Date simple (AAAA-MM-JJ) : aucun décalage horaire à appliquer
export function formatDay(iso: string | null | undefined, options: { weekday?: boolean } = {}, fallback = '-'): string {
  if (!iso) return fallback
  const [year, month, day] = String(iso).split('-').map(Number)
  if (!year || !month || !day) return fallback
  return write(new Date(year, month - 1, day), Boolean(options.weekday))
}

// Mois de naissance : « Juin 1994 »
export function formatMonth(iso: string | null | undefined, fallback = '-'): string {
  if (!iso) return fallback
  const [year, month] = String(iso).split('-').map(Number)
  if (!year || !month) return fallback
  return `${MONTHS[month - 1]} ${year}`
}
