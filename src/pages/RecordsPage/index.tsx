import Icon from '../../components/Icon'
import MonthlyArchiveBanner from '../../components/MonthlyArchiveBanner'
import SuggestionInput from '../../components/SuggestionInput'
import TreatmentSelector from '../../components/TreatmentSelector'
import PatientPicker from '../../components/PatientPicker'
import DatePicker from '../../components/DatePicker'
import DossierHistory from './DossierHistory'
import TreatmentConfirmation from './TreatmentConfirmation'
import type { Category } from '../../constants'
import { formatDateTime, formatDay, todayIso } from '../../utils/date'
import { capitalize } from '../../utils/text'
import { ageUnit, displayAge, displayRegistryNumber, treatmentsLabel } from '../../utils/record'
import { appointmentStatus, useRecordsPage } from './useRecordsPage'
import './RecordsPage.scss'

type Props = {
  category: Category
}

const RecordsPage = ({ category }: Props) => {
  const {
    activeTab, setActiveTab, records,
    medications, archives, activeArchive, setActiveArchive, selectedYear, setSelectedYear, availableYears,
    form, setForm, editingId, filters, setFilters, actionError, actionOk,
    patientVisits, saving, historyRow, dossierHistory, historyLoading, isAdmin, closeHistory,
    needsTreatmentConfirmation, dismissTreatmentConfirmation, confirmWithoutTreatment,
    change, submit, edit, viewHistory, downloadReceipt, printReceipt, printingId, remove, load,
    cancelEdit, clearFilters, diagnosticOptions, pfMethodOptions, selectPatient, clearPatient, setIdentity,
    filteredRecords, diagnosticSummary, cpnSummary, pfSummary,
  } = useRecordsPage(category)

  const isEchographie = category.key === 'echographie'
  const today = todayIso()
  const clinicalLabel = isEchographie ? 'RC (renseignement clinique)' : 'Diagnostic'
  const isConsultation = category.key === 'consultation'
  // Dans les registres CPN et PF, l'âge est saisi en années.
  const isAdultRegistry = category.key === 'cpn' || category.key === 'pf'

  // Chaque registre affiche sa donnée propre dans la liste
  const extraColumn =
    category.key === 'consultation' ? { label: 'TDR', value: null }
    : category.key === 'cpn' ? { label: 'N° CPN', value: 'cpn_type' as const }
    : category.key === 'pf' ? { label: 'Produit PF', value: 'pf_method' as const }
    : null

  const columnCount = 12 - (isAdultRegistry ? 1 : 0) + (isConsultation ? 1 : 0) + (extraColumn ? 1 : 0)
  const hasFilters = Object.values(filters).some(Boolean)
  const registrySummary = category.key === 'cpn' ? cpnSummary : pfSummary
  const registryFilterLabel = category.key === 'cpn'
    ? 'Filtrer par CPN (CPN1, CPN2...)'
    : category.key === 'pf' ? 'Filtrer par produit PF...' : 'Filtrer par acte médical...'

  return (
    <section className="RecordsPage">
      <div className="page-header">
        <div>
          <h1>Registre {category.label}</h1>
          {isConsultation && <p>Médicaments et actes médicaux.</p>}
          {isEchographie && <p>Registre continu : toutes les échographies restent visibles au fil des mois et des années.</p>}
        </div>

        <div className="tools">
          {!isEchographie && <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>}

          <div className={`page-badge ${category.key}`}>
            <Icon name={category.icon} /> {category.label}
          </div>
        </div>
      </div>

      {!isEchographie && <MonthlyArchiveBanner
        current={activeArchive}
        archives={archives.filter((a) => a.year === selectedYear)}
        allArchives={archives}
        onChange={(archive) => { setActiveArchive(archive); load(archive) }}
      />}

      {isAdultRegistry && (
        <section className={`registry-summary ${category.key}`} aria-label={category.key === 'cpn' ? 'Compteurs CPN' : 'Compteurs produits PF'}>
          <h2 title={category.key === 'cpn' ? 'Nombre de consultations pour la période sélectionnée' : 'Nombre de dossiers mensuels par produit, selon la dernière visite du patient'}><Icon name={category.icon} /> {category.key === 'cpn' ? 'CPN de la période' : 'Produits PF de la période'}</h2>
          <dl className="summary-cards">
            {registrySummary.map(([label, count]) => (
              <div key={label} className={count === 0 ? 'summary-card zero' : 'summary-card'}>
                <dt>{label}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          {registrySummary.length === 0 && <p>Aucun produit PF renseigné pour cette période.</p>}
        </section>
      )}

      <div className={`tabs ${category.key}`} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'liste'}
          className={activeTab === 'liste' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('liste')}
        >
          <Icon name="history" size="md" />
          Liste
          <span className="count">{records.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'nouveau'}
          className={activeTab === 'nouveau' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('nouveau')}
        >
          <Icon name={editingId ? 'edit' : 'plus'} size="md" />
          {editingId ? 'Modifier la visite' : 'Nouvelle visite'}
        </button>
      </div>

      {actionError && <p className="error-msg"><Icon name="alert" /> {actionError}</p>}
      {actionOk && <p className="success-msg"><Icon name="check-circle" /> {actionOk}</p>}
      {needsTreatmentConfirmation && <TreatmentConfirmation onConfirm={confirmWithoutTreatment} onCancel={dismissTreatmentConfirmation} />}

      {activeTab === 'liste' && (
      <div className="panel-liste" role="tabpanel">

      {diagnosticSummary.length > 0 && (
        <div className="diagnostics">
          <strong><Icon name="check-circle" /> {isEchographie ? 'Synthèse RC :' : 'Synthèse diagnostics ce mois :'}</strong>

          <div className="list">
            {diagnosticSummary.slice(0, 6).map(([diagnostic, count]) => (
              <button
                key={diagnostic}
                type="button"
                className={filters.diagnostic === diagnostic ? 'tag active' : 'tag'}
                onClick={() => setFilters({ ...filters, diagnostic })}
              >
                {diagnostic} <span className="count">{count}</span>
              </button>
            ))}

            {diagnosticSummary.length > 6 && (
              <span className="more">+{diagnosticSummary.length - 6} {isEchographie ? 'autres RC' : 'autres diagnostics'}</span>
            )}
          </div>
        </div>
      )}

      {historyRow && <DossierHistory rows={dossierHistory} loading={historyLoading} patientName={historyRow.patient_nom || ''} onReceipt={downloadReceipt} onPrint={printReceipt} printingId={printingId} onClose={closeHistory} />}

      <div className="search-bar">
        <div className="search-field">
          <Icon name="search" />
          <input
            type="text"
            placeholder={isEchographie ? 'Recherche par nom, RC ou Id...' : 'Recherche par nom, diagnostic ou N° registre...'}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        <input
          type="text"
          placeholder="Filtrer par âge"
          value={filters.age}
          onChange={(e) => setFilters({ ...filters, age: e.target.value })}
        />

        <div className="date-filter">
          <DatePicker
            value={filters.date}
            onChange={(date) => setFilters({ ...filters, date })}
            label="Rechercher par date"
            clearLabel="Effacer le filtre de date"
          />
        </div>

        <input
          type="text"
          placeholder={registryFilterLabel}
          aria-label={registryFilterLabel}
          value={filters.act}
          onChange={(e) => setFilters({ ...filters, act: e.target.value })}
        />

        {hasFilters && (
          <button type="button" className="btn-light" onClick={clearFilters}>
            <Icon name="close" /> Effacer
          </button>
        )}

        <span className="count">
          {filteredRecords.length} résultat{filteredRecords.length !== 1 ? 's' : ''}
        </span>
      </div>


      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{isEchographie ? 'Id' : 'N° registre'}</th>
              {isConsultation && <th>Référence</th>}
              <th>Patient</th>
              {!isAdultRegistry && <th>Sexe</th>}
              <th>Âge</th>
              <th>Domicile</th>
              <th>{clinicalLabel}</th>
              <th>Traitement</th>
              <th>Observation</th>
              {extraColumn && <th>{extraColumn.label}</th>}
              <th>Coût</th>
              <th>Date / Heure</th>
              <th>Rendez-vous</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 && (
              <tr>
                <td className="empty" colSpan={columnCount}>Aucune donnée enregistrée.</td>
              </tr>
            )}

            {filteredRecords.map((row) => (
              <tr key={row.id}>
                <td className="registry">{displayRegistryNumber(row.registry_number, row.category)}</td>
                {isConsultation && <td className="reference">{row.reference || '-'}</td>}
                <td><strong>{row.patient_nom}</strong> {row.patient_prenom}</td>
                {!isAdultRegistry && <td>{row.sexe || '-'}</td>}
                <td><span className={`badge age ${ageUnit(row.age_months)}`}>{displayAge(row.age)}</span></td>
                <td>{row.domicile}</td>
                <td>{row.diagnostic}</td>
                <td className="treatments">{treatmentsLabel(row.treatments) || row.traitement}</td>
                <td>{row.observation || '-'}</td>

                {extraColumn && (
                  <td>
                    {extraColumn.value
                      ? (row[extraColumn.value] || '-')
                      : row.tdr_result
                        ? <span className={`badge tdr ${row.tdr_result}`}>{row.tdr_result === 'positif' ? 'Positif' : 'Négatif'}</span>
                        : '-'}
                  </td>
                )}

                <td className="cost">{row.cost} Ar</td>
                <td className="date">{formatDateTime(row.created_at)}</td>
                <td className="appointment">
                  {row.appointment_date ? (
                    <>
                      <strong>{formatDay(row.appointment_date, { weekday: true })}</strong>
                      <span className={`status ${row.appointment_date < today ? 'past' : row.appointment_date === today ? 'today' : 'upcoming'}`}>
                        {appointmentStatus(row.appointment_date, today)}
                      </span>
                    </>
                  ) : '-'}
                </td>
                <td className="actions">
                  <div>
                    <button className="icon-btn" title="Modifier cette visite" aria-label="Modifier cette visite" onClick={() => edit(row)}>
                      <Icon name="edit" />
                    </button>
                    <button className="icon-btn" title="Voir l'historique" aria-label="Voir l'historique" onClick={() => viewHistory(row)}>
                      <Icon name="history" />
                    </button>
                    {isAdmin && (
                      <button className="icon-btn danger" title="Supprimer" aria-label="Supprimer" onClick={() => remove(row.id)}>
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      )}

      {activeTab === 'nouveau' && (
      <div className="panel-nouveau" role="tabpanel">

        {!editingId && form.patient && (
          <div className="visit-context" role="status">
            <Icon name="history" />
            <div>
              <strong>{patientVisits.length ? `Nouvelle visite · ${form.patient.nom}` : `${isEchographie ? 'Première échographie' : 'Première visite du mois'} · ${form.patient.nom}`}</strong>
              <p>{patientVisits.length
                ? `${patientVisits.length} visite(s) enregistrée(s)${isEchographie ? '' : ' ce mois'} · ${isEchographie ? 'Id' : 'N°'} ${displayRegistryNumber(patientVisits[0].registry_number, category.key)}. Chaque visite possède son propre reçu.`
                : 'Cette saisie sera ajoutée à l’historique du patient avec son propre reçu.'}</p>
            </div>
            {patientVisits.length > 0 && <button type="button" className="btn-light" onClick={() => viewHistory(patientVisits[0])}>Voir l’historique</button>}
          </div>
        )}

        {historyRow && <DossierHistory rows={dossierHistory} loading={historyLoading} patientName={historyRow.patient_nom || ''} onReceipt={downloadReceipt} onPrint={printReceipt} printingId={printingId} onClose={closeHistory} />}

        <form className={`record-form ${category.key}`} onSubmit={submit}>
          <fieldset className="block patient">
          <legend>Patient</legend>
          <PatientPicker
            hideSex={isAdultRegistry}
            patient={form.patient}
            identity={form.identity}
            onIdentityChange={setIdentity}
            onSelect={selectPatient}
            onClear={clearPatient}
            yearsOnly={isAdultRegistry}
          />
        </fieldset>

        <fieldset className="block diagnostic">
            <legend>{isEchographie ? clinicalLabel : 'Diagnostic et suivi'}</legend>

            {isEchographie && (
              <label>
                Id
                <input name="registry_number" placeholder="Identifiant saisi manuellement" value={form.registry_number} onChange={change} required />
              </label>
            )}

            <SuggestionInput
              value={form.diagnostic}
              onChange={(value) => setForm({ ...form, diagnostic: capitalize(value, true) })}
              suggestions={diagnosticOptions}
              placeholder={isEchographie ? 'Renseignement clinique obligatoire' : 'Diagnostic obligatoire'}
              id="diagnostic"
              required
            />

            <div className="field appointment">
              <span>Rendez-vous</span>
              <DatePicker
                value={form.appointment_date}
                onChange={(value) => setForm({ ...form, appointment_date: value })}
                label="Ajouter un prochain rendez-vous"
                disablePast
                weekday
              />
            </div>

            {isConsultation && (
              <input name="reference" placeholder="Référence (optionnel)" value={form.reference} onChange={change} />
            )}

            {isConsultation && (
              <select name="tdr_result" value={form.tdr_result} onChange={change}>
                <option value="">TDR (optionnel)</option>
                <option value="positif">Positif</option>
                <option value="negatif">Négatif</option>
              </select>
            )}

            {category.key === 'pf' && (
              <SuggestionInput
                id="pf_method"
                placeholder="Produits PF"
                value={form.pf_method}
                suggestions={pfMethodOptions}
                onChange={(value) => setForm({ ...form, pf_method: capitalize(value, true) })}
              />
            )}

            {category.key === 'cpn' && (
              <select name="cpn_type" aria-label="Numéro de consultation prénatale" value={form.cpn_type} onChange={change}>
                <option value="">N° CPN (optionnel)</option>
                <option value="CPN1">CPN1</option>
                <option value="CPN2">CPN2</option>
                <option value="CPN3">CPN3</option>
                <option value="CPN4">CPN4</option>
                <option value="CPN5">CPN5</option>
              </select>
            )}
          </fieldset>

          <fieldset className="block traitement">
            <legend>{isConsultation || isEchographie ? 'Traitement (facultatif)' : 'Traitement'}</legend>

            <div className="treatments">
              <TreatmentSelector
                medications={medications}
                value={form.treatments}
                onChange={(treatments) => setForm({ ...form, treatments })}
              />
            </div>
          </fieldset>

          <fieldset className="block observation">
            <legend>Observation</legend>

            <textarea name="observation" placeholder="Observation" value={form.observation} onChange={change} />
          </fieldset>

          <div className="actions">
            <button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : editingId ? 'Modifier' : 'Ajouter'}</button>
            {editingId && <button type="button" className="btn-light" onClick={cancelEdit}>Annuler</button>}
          </div>
        </form>

      </div>
      )}
    </section>
  )
}

export default RecordsPage
