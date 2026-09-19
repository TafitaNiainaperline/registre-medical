import { todayIso } from './date'

// Check again on focus to handle a computer waking after the month changes.
export function watchCurrentMonth(onChange: (month: string) => void): () => void {
  let current = todayIso().slice(0, 7)
  const check = () => {
    const next = todayIso().slice(0, 7)
    if (next === current) return
    current = next
    onChange(next)
  }
  const timer = window.setInterval(check, 60000)
  window.addEventListener('focus', check)
  document.addEventListener('visibilitychange', check)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('focus', check)
    document.removeEventListener('visibilitychange', check)
  }
}
