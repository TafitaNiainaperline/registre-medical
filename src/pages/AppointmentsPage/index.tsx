import Icon from '../../components/Icon'
import { formatDay } from '../../utils/date'
import { getStatus, useAppointmentsPage } from './useAppointmentsPage'
import './AppointmentsPage.scss'

const AppointmentsPage = () => {
  const { appointments, filtered, search, setSearch, remove, removeAll, counts } = useAppointmentsPage()

  return (
    <section className="AppointmentsPage">
      <div className="page-header">
        <div>
          <h1>Rendez-vous</h1>
          <p>Liste de tous les rendez-vous des registres.</p>
        </div>
        <div className="page-badge">
          <Icon name="calendar" /> Rendez-vous
        </div>
      </div>

      <div className="cards-grid counters">
        <article className="stat-card red">
          <div className="top">
            <Icon name="clock" size="lg" />
            <h3>Passés</h3>
          </div>
          <strong className="value">{counts.past}</strong>
        </article>

        <article className="stat-card green">
          <div className="top">
            <Icon name="calendar" size="lg" />
            <h3>Aujourd'hui</h3>
          </div>
          <strong className="value">{counts.today}</strong>
        </article>

        <article className="stat-card blue">
          <div className="top">
            <Icon name="clock" size="lg" />
            <h3>À venir</h3>
          </div>
          <strong className="value">{counts.upcoming}</strong>
        </article>
      </div>

      <div className="search-bar">
        <div className="search-field">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Rechercher un patient ou une date..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {appointments.length > 0 && (
          <button className="btn-danger" onClick={removeAll}>
            <Icon name="trash" /> Supprimer tout
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Statut</th>
              <th>Patient</th>
              <th>Registre</th>
              <th>Diagnostic</th>
              <th>TDR</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="empty" colSpan={7}>
                  <Icon name="calendar" size="xxl" />
                  <div>Aucun rendez-vous</div>
                </td>
              </tr>
            )}

            {filtered.map((appointment) => {
              const status = getStatus(appointment.appointment_date)
              return (
                <tr key={appointment.id}>
                  <td className="date">{formatDay(appointment.appointment_date, { weekday: true })}</td>
                  <td><span className={`badge ${status.tone}`}>{status.text}</span></td>
                  <td>
                    <div className="patient">
                      <Icon name="user" />
                      <strong>{appointment.patient_nom}</strong> {appointment.patient_prenom}
                    </div>
                  </td>
                  <td className="center registry">{appointment.registry_number || '-'}</td>
                  <td>{appointment.diagnostic || '-'}</td>
                  <td className="center">{appointment.tdr_result || '-'}</td>
                  <td className="actions">
                    <div>
                      <button
                        className="icon-btn remove"
                        title="Supprimer le rendez-vous"
                        onClick={() => remove(appointment.id)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AppointmentsPage
