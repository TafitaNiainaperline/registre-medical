import type { Archive } from '../../../electron/types'
import { useMonthlyArchiveBanner } from './useMonthlyArchiveBanner'
import './MonthlyArchiveBanner.scss'

type Props = {
  current: Archive | null
  archives: Archive[]
  allArchives: Archive[]
  onChange?: (archive: Archive) => void
}

const MonthlyArchiveBanner = ({ current, archives, allArchives, onChange }: Props) => {
  const { showAll, toggleShowAll, selectedKey, visible, archiveKey } =
    useMonthlyArchiveBanner(archives, allArchives, current)

  return (
    <div className="MonthlyArchiveBanner">
      <div className="current">
        <strong>Archive active :</strong>
        <span className="pill">{current?.label || '—'}</span>
      </div>

      <div className="picker">
        <span className="label">Changer :</span>

        <div className="chips">
          {visible.map((a) => (
            <button
              key={archiveKey(a)}
              type="button"
              className={archiveKey(a) === selectedKey ? 'chip active' : 'chip'}
              onClick={() => onChange?.(a)}
            >
              {a.label}
            </button>
          ))}
        </div>

        {allArchives.length > 6 && (
          <button type="button" className="chip more" onClick={toggleShowAll}>
            {showAll ? 'Réduire' : `Tout (${allArchives.length})`}
          </button>
        )}
      </div>
    </div>
  )
}

export default MonthlyArchiveBanner
