import { useEffect, useState } from 'react';

function getTodayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getStatus(date) {
  const today = getTodayDate();
  if (date < today) return { text: 'Passé', color: '#dc3545' };
  if (date === today) return { text: "Aujourd'hui", color: '#28a745' };
  return { text: 'À venir', color: '#007bff' };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    window.api.fetchAppointments()
      .then((rows) => setAppointments(rows || []))
      .catch(() => setAppointments([]));
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = appointments.filter((appointment) => !query || [
    appointment.patient_nom,
    appointment.patient_prenom,
    appointment.diagnostic,
    appointment.appointment_date,
  ].some((value) => String(value || '').toLowerCase().includes(query)));

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Rendez-vous</h1>
          <p>Liste de tous les rendez-vous des registres.</p>
        </div>
        <div className="dashboard-badge">📅 Rendez-vous</div>
      </div>

      <div className="search-bar" style={{ marginBottom: '18px' }}>
        <input
          type="search"
          placeholder="Rechercher un patient ou une date..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Aucun rendez-vous.</td></tr>
            )}
            {filtered.map((appointment) => {
              const status = getStatus(appointment.appointment_date);
              return (
                <tr key={appointment.id}>
                  <td style={{ color: status.color, fontWeight: 600 }}>{appointment.appointment_date}</td>
                  <td style={{ color: status.color, fontWeight: 600 }}>{status.text}</td>
                  <td><strong>{appointment.patient_nom}</strong> {appointment.patient_prenom}</td>
                  <td>{appointment.registry_number || '-'}</td>
                  <td>{appointment.diagnostic || '-'}</td>
                  <td>{appointment.tdr_result || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
