import { useEffect, useState } from 'react';
import { Calendar, Search, Trash2, Clock, User, FileText, AlertTriangle } from 'lucide-react';

function getTodayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getStatus(date) {
  const today = getTodayDate();
  if (date < today) return { text: 'Passé', color: '#dc3545', bg: '#fdecea' };
  if (date === today) return { text: "Aujourd'hui", color: '#28a745', bg: '#e8f5e9' };
  return { text: 'À venir', color: '#007bff', bg: '#e8f0fe' };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');

  const remove = async (id) => {
    if (!window.confirm('Supprimer ce rendez-vous ?')) return;
    await window.api.clearAppointment(id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  };

  const removeAll = async () => {
    if (!window.confirm('Supprimer tous les rendez-vous ? Cette action est irréversible.')) return;
    for (const appointment of appointments) {
      await window.api.clearAppointment(appointment.id);
    }
    setAppointments([]);
  };

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

  const pastCount = appointments.filter(a => getStatus(a.appointment_date).text === 'Passé').length;
  const todayCount = appointments.filter(a => getStatus(a.appointment_date).text === "Aujourd'hui").length;
  const upcomingCount = appointments.filter(a => getStatus(a.appointment_date).text === 'À venir').length;

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Rendez-vous</h1>
          <p>Liste de tous les rendez-vous des registres.</p>
        </div>
        <div className="dashboard-badge">
          <Calendar size={16} style={{ marginRight: '6px' }} /> Rendez-vous
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #dc3545' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Clock size={18} color="#dc3545" />
            <span style={{ fontSize: '0.85rem', color: '#666' }}>Passés</span>
          </div>
          <strong style={{ fontSize: '1.8rem', color: '#dc3545' }}>{pastCount}</strong>
        </div>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #28a745' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Calendar size={18} color="#28a745" />
            <span style={{ fontSize: '0.85rem', color: '#666' }}>Aujourd'hui</span>
          </div>
          <strong style={{ fontSize: '1.8rem', color: '#28a745' }}>{todayCount}</strong>
        </div>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #007bff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Clock size={18} color="#007bff" />
            <span style={{ fontSize: '0.85rem', color: '#666' }}>À venir</span>
          </div>
          <strong style={{ fontSize: '1.8rem', color: '#007bff' }}>{upcomingCount}</strong>
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
          <input
            type="search"
            placeholder="Rechercher un patient ou une date..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #c8d9df', borderRadius: '8px', fontSize: '0.9rem' }}
          />
        </div>
        {appointments.length > 0 && (
          <button
            onClick={removeAll}
            style={{
              padding: '10px 18px',
              background: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <Trash2 size={16} /> Supprimer tout
          </button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#6c757d' }}>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Date</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Statut</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Patient</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Registre</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>Diagnostic</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>TDR</th>
              <th style={{ padding: '14px 12px', color: '#fff', fontWeight: 600, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <div>Aucun rendez-vous</div>
                </td>
              </tr>
            )}
            {filtered.map((appointment, index) => {
              const status = getStatus(appointment.appointment_date);
              return (
                <tr key={appointment.id} style={{ background: index % 2 === 0 ? '#fff' : '#f8fafa', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '14px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{appointment.appointment_date}</td>
                  <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: status.bg, color: status.color }}>
                      {status.text}
                    </span>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={14} color="#888" />
                      <strong>{appointment.patient_nom}</strong> {appointment.patient_prenom}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px', textAlign: 'center', color: '#5f7b84' }}>{appointment.registry_number || '-'}</td>
                  <td style={{ padding: '14px 12px' }}>{appointment.diagnostic || '-'}</td>
                  <td style={{ padding: '14px 12px', textAlign: 'center' }}>{appointment.tdr_result || '-'}</td>
                  <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => remove(appointment.id)}
                      title="Supprimer le rendez-vous"
                      style={{ padding: '6px', background: '#dc3545', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
