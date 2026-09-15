import { createPortal } from 'react-dom'
import Icon from '../Icon'
import { formatDay } from '../../utils/date'
import { useDatePicker } from './useDatePicker'
import './DatePicker.scss'

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
  // Nom du jour affiché uniquement là où il compte (rendez-vous)
  weekday?: boolean
  disablePast?: boolean
  clearLabel?: string
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const DatePicker = ({ value, onChange, label, weekday = false, disablePast = false, clearLabel = 'Retirer le rendez-vous' }: Props) => {
  const { open, setOpen, wrapperRef, days, year, month, previous, next, select, selectToday, clear, closeOnBackdrop } =
    useDatePicker(value, onChange, disablePast)

  return (
    <div className="DatePicker" ref={wrapperRef}>
      {value ? (
        <div className="chosen">
          <Icon name="calendar" />
          <span>{formatDay(value, { weekday })}</span>
          <button type="button" className="change" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>Changer</button>
          <button type="button" className="remove" onClick={clear} title={clearLabel} aria-label={clearLabel}>
            <Icon name="close" />
          </button>
        </div>
      ) : (
        <button type="button" className="trigger" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>
          <Icon name="calendar" /> {label}
        </button>
      )}

      {open && createPortal(
        <div className="DatePicker">
        <div className="modal-overlay" onMouseDown={closeOnBackdrop}>
          <div className="modal calendar" role="dialog" aria-modal="true" aria-label={label}>
            <div className="header">
              <h3>{label}</h3>
              <button type="button" className="close" onClick={() => setOpen(false)} aria-label="Fermer">
                <Icon name="close" />
              </button>
            </div>

            <div className="head">
              <button type="button" onClick={previous} aria-label="Mois précédent">‹</button>
              <strong>{MONTHS[month]} {year}</strong>
              <button type="button" onClick={next} aria-label="Mois suivant">›</button>
            </div>

            <div className="weekdays">
              {WEEKDAYS.map((day, index) => <span key={index}>{day}</span>)}
            </div>

            <div className="days">
              {days.map((day) => (
                <button
                  key={day.iso}
                  type="button"
                  disabled={day.disabled}
                  className={[
                    'day',
                    day.outside ? 'outside' : '',
                    day.today ? 'today' : '',
                    day.iso === value ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => select(day)}
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="foot">
              <button type="button" className="btn-light" onClick={selectToday}>Aujourd'hui</button>
            </div>
          </div>
        </div>
        </div>, document.body
      )}
    </div>
  )
}

export default DatePicker
