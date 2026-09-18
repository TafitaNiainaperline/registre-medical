import type { SaveResult } from './types'

// A locked destination can be retried or replaced only after the user chooses it.
export async function saveExportWithRetry(
  filePath: string,
  write: (destination: string) => Promise<void>,
  chooseDestination: (lockedPath: string) => Promise<string | null>,
): Promise<SaveResult> {
  let destination = filePath
  for (;;) {
    try {
      await write(destination)
      return { canceled: false, filePath: destination }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code !== 'EBUSY' && code !== 'EACCES' && code !== 'EPERM') throw error
      const next = await chooseDestination(destination)
      if (!next) return { canceled: true }
      destination = next
    }
  }
}
