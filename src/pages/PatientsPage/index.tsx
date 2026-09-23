import Icon from '../../components/Icon'
import AgeField from '../../components/AgeField'
import { categories } from '../../constants'
import { formatDate, formatDateTime, formatDay, formatMonth } from '../../utils/date'
import { displayRegistryNumber, treatmentsLabel } from '../../utils/record'
import { usePatientsPage } from './usePatientsPage'
import './PatientsPage.scss'


const labelOf = (key: string) => categories.find((c) => c.key === key)?.label || key

const PatientsPage = () => {
  const {
    patients, search, setSearch, selected, records, addressLog, editing, form, setForm, message,
    open, close, startCreate, startEdit, save, cancelEdit,
  } = usePatientsPage()

  return (
    <section className="PatientsPage">
      <div className="page-header">
        <div>
          <h1>Patients</h1>
          <p>Fiches patients et suivi médical dans le temps.</p>
        </div>
        <div className="page-badge">
          <Icon name="users" /> {patients.length} patients
        </div>
      </div>

      {message.text && (
        <div className={message.type === 'err' ? 'error-msg' : 'success-msg'}>
          <Icon name={message.type === 'err' ? 'alert' : 'check-circle'} /> {message.text}
        </div>
      )}

      <div className="columns">
        <div className="panel list">
          <div className="search-field">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Rechercher un patient, une adresse, un n°..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button className="new" onClick={startCreate}>
            <Icon name="plus" /> Nouveau patient
          </button>

          <div className="rows">
            {patients.length === 0 && <span className="empty">Aucun patient.</span>}

            {patients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className={selected?.id === patient.id ? 'row active' : 'row'}
                onClick={() => open(patient)}
              >
                <strong>{patient.nom} {patient.prenom || ''}</strong>
                <span className="meta">{patient.patient_number} · {patient.domicile || 'adresse inconnue'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel detail">
          {editing ? (
            <>
              <h3>{selected ? 'Modifier la fiche' : 'Nouveau patient'}</h3>

              <div className="fields">
                <label className="field">
                  <span>Nom et prénom</span>
                  <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                </label>

                <label className="field">
                  <span>Adresse</span>
                  <input value={form.domicile} onChange={(e) => setForm({ ...form, domicile: e.target.value })} />
                </label>

                <label className="field">
                  <span>Sexe</span>
                  <select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
                    <option value="">Non renseigné</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </label>

                <label className="field">
                  <span>Téléphone (optionnel)</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>

                <div className="field age">
                  <span>Âge</span>
                  <AgeField value={form.age} onChange={(age) => setForm({ ...form, age })} />
                </div>
              </div>

              <div className="actions">
                <button type="button" className="btn-light" onClick={cancelEdit}>Annuler</button>
                <button type="button" onClick={save}>Enregistrer</button>
              </div>
            </>
          ) : !selected ? (
            <div className="empty-state">
              <Icon name="users" size="xxl" />
              <p>Sélectionnez un patient pour voir son dossier médical.</p>
            </div>
          ) : (
            <>
              <div className="identity">
                <div>
                  <h3>{selected.nom} {selected.prenom || ''}</h3>
                  <span className="meta">
                    {selected.patient_number}
                    {selected.sexe ? ` · ${selected.sexe}` : ''}
                    {selected.phone ? ` · ${selected.phone}` : ''}
                  </span>
                  <span className="meta">
                    {selected.domicile || 'Adresse inconnue'}
                    {selected.birth_date ? ` · Né(e) en ${formatMonth(selected.birth_date)}` : ' · Naissance inconnue'}
                    {selected.birth_estimated ? ' (estimée)' : ''}
                  </span>
                </div>

                <div className="tools">
                  <button className="btn-light" onClick={startEdit}><Icon name="edit" /> Modifier</button>
                  <button className="btn-light" onClick={close}><Icon name="close" /></button>
                </div>
              </div>

              <h4><Icon name="history" /> Suivi médical ({records.length})</h4>

              {records.length === 0 ? (
                <p className="empty">Aucune consultation enregistrée.</p>
              ) : (
                <div className="timeline">
                  {records.map((record) => (
                    <article className={`visit ${record.category}`} key={record.id}>
                      <div className="head">
                        <span className="registry">{record.category === 'echographie' ? 'Id' : 'N°'} {displayRegistryNumber(record.registry_number, record.category)}</span>
                        <span className="category">{labelOf(record.category)}</span>
                        <span className="date">{formatDateTime(record.created_at)}</span>
                      </div>
                      <div className="body">
                        <strong>{record.diagnostic}</strong>
                        <span className="age">{record.age}</span>
                        <span className="treatments">{treatmentsLabel(record.treatments) || record.traitement || '-'}</span>
                        {record.observation && <span className="observation">{record.observation}</span>}
                      </div>
                      <div className="foot">
                        <span>{record.cost} Ar</span>
                        {record.appointment_date && <span>Rendez-vous : {formatDay(record.appointment_date, { weekday: true })}</span>}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {addressLog.length > 0 && (
                <>
                  <h4><Icon name="bank" /> Historique des adresses</h4>
                  <div className="addresses">
                    {addressLog.map((entry) => (
                      <span className="entry" key={entry.id}>
                        <strong>{entry.domicile}</strong>
                        <span className="meta">{formatDate(entry.created_at)}{entry.created_by_name ? ` · ${entry.created_by_name}` : ''}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default PatientsPage
