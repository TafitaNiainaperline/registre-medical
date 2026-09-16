import { errorMessage } from './error'

export type Notice = { id: number; text: string; type: 'ok' | 'err' | 'info' }
export type Confirmation = {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  action: () => void | Promise<unknown>
  resolve: () => void
  busy: boolean
}

let notices: Notice[] = []
let confirmation: Confirmation | null = null
let nextId = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getNotices = () => notices
export const getConfirmation = () => confirmation
export const dismissNotice = (id: number) => {
  notices = notices.filter((notice) => notice.id !== id)
  emit()
}
export const notify = (text: string, type: Notice['type'] = 'ok') => {
  if (!text) return
  notices = [...notices, { id: ++nextId, text, type }]
  emit()
}

// A single pending action prevents repeated clicks from queuing duplicate writes.
export const confirmAction = (
  options: Pick<Confirmation, 'title' | 'message' | 'confirmLabel' | 'danger'>,
  action: Confirmation['action'],
): Promise<void> => {
  if (confirmation) return Promise.resolve()
  return new Promise((resolve) => {
    confirmation = { ...options, action, resolve, busy: false }
    emit()
  })
}
export const cancelConfirmation = () => {
  if (!confirmation || confirmation.busy) return
  const pending = confirmation
  confirmation = null
  emit()
  pending.resolve()
}
export const acceptConfirmation = async () => {
  if (!confirmation || confirmation.busy) return
  const pending = confirmation
  confirmation = { ...pending, busy: true }
  emit()
  try {
    await pending.action()
  } catch (err) {
    notify(errorMessage(err, 'Impossible de terminer cette action. Veuillez réessayer.'), 'err')
  } finally {
    confirmation = null
    emit()
    pending.resolve()
  }
}
