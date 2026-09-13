import type { AgeEntry } from '../../utils/record'
import { AGE_LIMITS } from '../../utils/record'
import { useAgeField } from './useAgeField'
import './AgeField.scss'

type Props = {
  value: AgeEntry
  onChange: (value: AgeEntry) => void
  disabled?: boolean
  // Registres d'adultes : l'âge se donne en années, sans choix d'unité
  yearsOnly?: boolean
}

const AgeField = ({ value, onChange, disabled, yearsOnly = false }: Props) => {
  const { units, rootRef, changeType, setValue, setMois, setJours } = useAgeField(value, onChange, disabled, yearsOnly)

  return (
    <div className="AgeField" ref={rootRef}>
      {!yearsOnly && (
        <select
          value={value.type}
          onChange={(e) => changeType(e.target.value as AgeEntry['type'])}
          disabled={disabled}
          aria-label="Unité de l'âge"
        >
          {units.map((unit) => <option key={unit.key} value={unit.key}>{unit.label}</option>)}
        </select>
      )}

      {value.type === 'ans' && (
        <span className="amount">
          <input
            type="number" min="0" max={AGE_LIMITS.ans} placeholder="0" value={value.value} aria-label="Âge en années"
            onChange={(e) => setValue(e.target.value, AGE_LIMITS.ans)} readOnly={disabled}
          />
          <span className="unit">ans</span>
        </span>
      )}

      {value.type === 'mois_jours' && (
        <>
          <span className="amount">
            <input
              type="number" min="0" max={AGE_LIMITS.mois} placeholder="0" value={value.mois} aria-label="Âge en mois"
              onChange={(e) => setMois(e.target.value, AGE_LIMITS.mois)} readOnly={disabled}
            />
            <span className="unit">mois</span>
          </span>

          <span className="amount">
            <input
              type="number" min="0" max={AGE_LIMITS.jours} placeholder="0" value={value.jours} aria-label="Complément en jours"
              onChange={(e) => setJours(e.target.value, AGE_LIMITS.jours)} readOnly={disabled}
            />
            <span className="unit">jours</span>
          </span>
        </>
      )}

      {value.type === 'jours' && (
        <span className="amount">
          <input
            type="number" min="0" max={AGE_LIMITS.joursSeuls} placeholder="0" value={value.jours} aria-label="Âge en jours"
            onChange={(e) => setJours(e.target.value, AGE_LIMITS.joursSeuls)} readOnly={disabled}
          />
          <span className="unit">jours</span>
        </span>
      )}
    </div>
  )
}

export default AgeField
