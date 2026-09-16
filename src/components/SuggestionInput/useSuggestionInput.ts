import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { normalize } from '../../utils/text'

export const useSuggestionInput = (value: string, suggestions: string[], onChange?: (value: string) => void) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = suggestions.filter((s) => normalize(s).includes(normalize(query)))

  const select = (item: string) => {
    onChange?.(item)
    setQuery(item)
    setOpen(false)
    inputRef.current?.blur()
  }

  const change = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setOpen(true)
    onChange?.(e.target.value)
  }

  return { open, query, filtered, wrapperRef, inputRef, select, change, focus: () => setOpen(true) }
}
