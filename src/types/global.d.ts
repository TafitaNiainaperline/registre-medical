import type { ElectronApi } from '../../electron/types'

declare global {
  // Pont exposé par le preload Electron (window.api)
  var api: ElectronApi
}

export {}
