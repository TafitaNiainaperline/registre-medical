import { useState } from 'react'
import { normalize } from '../../utils/text'
import type { FilterEntry } from './types'

const PREVIEW_COUNT = 6

export const useFilterCard = (entries: FilterEntry[]) => {
  const [filter, setFilter] = useState('')

  // Sans recherche on montre déjà les premières entrées : une carte vide n'apprend rien
  const matching = filter
    ? entries.filter((entry) => normalize(entry.label).includes(normalize(filter)))
    : entries.slice(0, PREVIEW_COUNT)

  return {
    filter,
    setFilter,
    matching,
    isEmpty: entries.length === 0,
    hiddenCount: filter ? 0 : Math.max(0, entries.length - PREVIEW_COUNT),
  }
}
