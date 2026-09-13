import { useState } from 'react'
import type { Archive } from '../../../electron/types'

export const useMonthlyArchiveBanner = (archives: Archive[], allArchives: Archive[], current: Archive | null) => {
  const [showAll, setShowAll] = useState(false)

  const selectedKey = current ? `${current.year}-${String(current.month).padStart(2, '0')}` : ''
  const visible = (showAll ? allArchives : archives).slice(0, showAll ? 24 : 6)

  return {
    showAll,
    toggleShowAll: () => setShowAll(!showAll),
    selectedKey,
    visible,
    archiveKey: (a: Archive) => `${a.year}-${String(a.month).padStart(2, '0')}`,
  }
}
