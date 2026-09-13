import type { AuthUser } from '../../electron/types'

// Utilisateur connecté, tel que stocké au moment de la connexion
export function getCurrentUser(): Partial<AuthUser> {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Partial<AuthUser> : {}
  } catch {
    return {}
  }
}
