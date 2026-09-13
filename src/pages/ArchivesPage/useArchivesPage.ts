import { useEffect, useState } from 'react'
import type { Archive, MedicalRecord } from '../../../electron/types'
import { errorMessage } from '../../utils/error'
import { matches } from '../../utils/text'

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
      setRows((data || []).filter((row) =>
        matches(search, [row.patient_nom, row.patient_prenom, row.diagnostic, row.registry_number])))
    } catch (e) {
      setRows([])
      setMessage(errorMessage(e, 'Erreur de chargement.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadArchives() }, [])
  useEffect(() => { loadRows(selected) }, [selected, category, search])

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
      setTimeout(() => setMessage(''), 3500)
    } catch (e) {
      setMessage(errorMessage(e, 'Export impossible.'))
    }
  }

  return {
    archives, selected, setSelected, category, setCategory, search, setSearch,
    rows, loading, message, reload: () => loadRows(selected), exportExcel,
    total: rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0),
    canExport: Boolean(selected?.year && selected?.month) && !loading,
  }
}
