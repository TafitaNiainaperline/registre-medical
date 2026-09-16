import { useEffect, useState } from 'react'
import type { Archive, MedicalRecord } from '../../../electron/types'
import { errorMessage } from '../../utils/error'
import { matches } from '../../utils/text'
import { notify } from '../../utils/notifications'
import { groupArchiveVisits } from './groupArchiveVisits'

export const archiveKey = (archive: Archive | null): string =>
  archive ? `${archive.year}-${String(archive.month).padStart(2, '0')}` : ''

export const useArchivesPage = () => {
  const [archives, setArchives] = useState<Archive[]>([])
  const [selected, setSelected] = useState<Archive | null>(null)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadArchives = async () => {
    const list = await window.api.listArchives()
    setArchives(list || [])

    if (!selected) {
      const current = await window.api.getCurrentArchive().catch(() => null)
      const found = (list || []).find((a) => archiveKey(a) === archiveKey(current))
      setSelected(found || (list || [])[0] || current)
    }
  }

  const loadRows = async (archive: Archive | null) => {
    if (!archive?.year || !archive?.month) { setRows([]); return }

    setLoading(true)
    setMessage('')
    try {
      const data = await window.api.fetchRecordsByArchive({
        year: archive.year,
        month: archive.month,
        category: category || undefined,
      })
      setRows(data || [])
    } catch (e) {
      setRows([])
      setMessage(errorMessage(e, 'Erreur de chargement.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadArchives() }, [])
  useEffect(() => { loadRows(selected) }, [selected, category])

  const exportExcel = async () => {
    if (!selected?.year || !selected?.month) return
    try {
      const result = await window.api.exportExcelByArchive({
        year: selected.year,
        month: selected.month,
        category: category || undefined,
      })
      if (result?.canceled) return
      setMessage(`Export réussi : ${result.filePath}`)
      notify(`Export réussi : ${result.filePath}`)
      setTimeout(() => setMessage(''), 3500)
    } catch (e) {
      setMessage(errorMessage(e, 'Export impossible.'))
      notify(errorMessage(e, 'Export impossible.'), 'err')
    }
  }

  const groups = groupArchiveVisits(rows).filter((group) => group.visits.some((row) =>
    matches(search, [row.patient_nom, row.patient_prenom, row.diagnostic, row.registry_number])))
  const visibleRows = groups.flatMap((group) => group.visits)
  return {
    archives, selected, setSelected, category, setCategory, search, setSearch,
    rows: visibleRows, groups, loading, message, reload: () => loadRows(selected), exportExcel,
    total: groups.reduce((sum, group) => sum + group.total, 0),
    canExport: Boolean(selected?.year && selected?.month) && !loading,
  }
}
