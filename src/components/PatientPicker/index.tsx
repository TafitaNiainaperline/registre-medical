import Icon from '../Icon'
import AgeField from '../AgeField'
import type { Patient } from '../../../electron/types'
import type { PatientIdentity } from './usePatientPicker'
import { usePatientPicker } from './usePatientPicker'
import './PatientPicker.scss'

type Props = {
  patient: Patient | null
  identity: PatientIdentity
  onIdentityChange: (identity: PatientIdentity) => void
  onSelect: (patient: Patient) => void
  onClear: () => void
  yearsOnly?: boolean
}

const PatientPicker = ({ patient, identity, onIdentityChange, onSelect, onClear, yearsOnly = false }: Props) => {
  const { matches, showMatches, dismiss } = usePatientPicker(identity, patient)
  const locked = Boolean(patient)
  const set = (field: keyof PatientIdentity, value: string) => onIdentityChange({ ...identity, [field]: value })

  return (
    <div className={locked ? 'PatientPicker locked' : 'PatientPicker'}>
      {locked ? (
        <div className="banner">
          <Icon name="user" size="md" />
          <span>
            Patient <strong>{patient?.patient_number}</strong> sélectionné — sa fiche est reprise telle quelle.
          </span>
          <button type="button" className="btn-light" onClick={onClear}>Changer de patient</button>
        </div>
      ) : (
        <p className="hint">
          <Icon name="search" /> Saisissez le nom : les patients déjà connus vous sont proposés.
          Sans sélection, un nouveau patient sera créé à l'enregistrement.
        </p>
      )}

      <div className="fields">
        <label className="field name">
          <span>Nom et prénom</span>
          <input
            value={identity.nom}
            onChange={(e) => set('nom', e.target.value)}
            readOnly={locked}
            autoComplete="off"
            required
          />

          {showMatches && (
            <div className="matches">
              {matches.map(({ patient: found, score }) => (
                <button type="button" className="match" key={found.id} onClick={() => onSelect(found)}>
                  <span className="who">
                    <strong>{found.nom} {found.prenom || ''}</strong>
                    <span className="meta">{found.patient_number} · {found.domicile || 'adresse inconnue'}</span>
                  </span>
                  <span className={score >= 85 ? 'score high' : 'score'}>{score}%</span>
                </button>
              ))}

              <button type="button" className="dismiss" onClick={dismiss}>
                <Icon name="plus" /> Aucun de ceux-là — créer « {identity.nom.trim()} »
              </button>
            </div>
          )}
        </label>

        <label className="field">
          <span>Adresse</span>
          <input
            value={identity.domicile}
            onChange={(e) => set('domicile', e.target.value)}
            readOnly={locked}
            autoComplete="off"
            required
          />
        </label>

        <label className="field">
          <span>Sexe</span>
          <select value={identity.sexe} onChange={(e) => set('sexe', e.target.value)} disabled={locked}>
            <option value="">Non renseigné</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </label>

        <label className="field">
          <span>Téléphone (optionnel)</span>
          <input
            value={identity.phone}
            onChange={(e) => set('phone', e.target.value)}
            readOnly={locked}
            autoComplete="off"
          />
        </label>

        <div className="field age">
          <span>Âge</span>
          <AgeField
            value={identity.age}
            onChange={(age) => onIdentityChange({ ...identity, age })}
            disabled={locked}
            yearsOnly={yearsOnly}
          />
        </div>
      </div>
    </div>
  )
}

export default PatientPicker
