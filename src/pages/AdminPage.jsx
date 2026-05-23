import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [newPwd, setNewPwd] = useState({});
  const [showPwd, setShowPwd] = useState({});
  const [msg, setMsg] = useState({ text: '', type: 'ok' });
  const [meds, setMeds] = useState([]);
  const [medsError, setMedsError] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const load = () => window.api.getAllUsers().then(setUsers).catch(() => {});
  const loadMeds = () =>
    window.api.listMedications()
      .then((r) => { setMeds(r || []); setMedsError(''); })
      .catch((e) => { setMeds([]); setMedsError(e?.message || 'Impossible de charger les médicaments.'); });

  useEffect(() => { load(); loadMeds(); }, []);

  const notify = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 3000);
  };

  const toggle = async (id, current) => {
    await window.api.toggleUserActive(id, !current);
    notify(current ? 'Compte désactivé.' : 'Compte activé !');
    load();
  };

  const resetPwd = async (id) => {
    const pwd = newPwd[id];
    if (!pwd || pwd.length < 4) { notify('Mot de passe trop court (min 4 caractères).', 'err'); return; }
    await window.api.resetUserPassword(id, pwd);
    setNewPwd({ ...newPwd, [id]: '' });
    notify('Mot de passe réinitialisé avec succès !');
  };

  const remove = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur définitivement ?')) return;
    await window.api.deleteUser(id);
    notify('Utilisateur supprimé.');
    load();
  };

  if (currentUser.role !== 'admin') {
    return (
      <section>
        <h1>Accès refusé</h1>
        <p>Seul l'administrateur peut accéder à cette page.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p>
            Activez, désactivez et gérez les comptes utilisateurs de la clinique.
          </p>
        </div>

        <div className="dashboard-badge">
          👥 Administration
        </div>
      </div>

      {msg.text && (
        <div style={{
          background: msg.type === 'err' ? '#fee2e2' : '#e2f4f7',
          border: `1px solid ${msg.type === 'err' ? '#d34a65' : '#1c96a4'}`,
          borderRadius: '10px', padding: '10px 16px', marginBottom: '16px',
          color: msg.type === 'err' ? '#991b1b' : '#0d7280', fontWeight: 600
        }}>
          {msg.type === 'err' ? '⚠ ' : '✓ '}{msg.text}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pseudo</th>
              <th>Nom complet</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Réinitialiser mot de passe</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', color: '#5f7b84', padding: '24px' }}>
                Aucun utilisateur trouvé.
              </td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.name}</td>
                <td>
                  <span style={{
                    background: u.role === 'admin' ? '#e2f4f7' : '#f0f4f6',
                    color: u.role === 'admin' ? '#0d7280' : '#4a6671',
                    borderRadius: '20px', padding: '3px 10px',
                    fontSize: '0.82rem', fontWeight: 600
                  }}>
                    {u.role === 'admin' ? '👑 Admin' : '👤 Utilisateur'}
                  </span>
                </td>
                <td>
                  <span style={{
                    background: u.is_active ? '#d1fae5' : '#fee2e2',
                    color: u.is_active ? '#065f46' : '#991b1b',
                    borderRadius: '20px', padding: '3px 10px',
                    fontSize: '0.82rem', fontWeight: 600
                  }}>
                    {u.is_active ? '✓ Actif' : '✗ Inactif'}
                  </span>
                </td>
                <td>
                  {u.username !== 'admin' ? (
                    <div className="pwd-field" style={{ maxWidth: '280px' }}>
                      <input
                        type={showPwd[u.id] ? 'text' : 'password'}
                        placeholder="Nouveau mot de passe..."
                        value={newPwd[u.id] || ''}
                        onChange={(e) => setNewPwd({ ...newPwd, [u.id]: e.target.value })}
                        style={{
                          border: '1px solid #c8d9df', borderRadius: '8px',
                          padding: '7px 36px 7px 10px', font: 'inherit', width: '100%'
                        }}
                      />
                      <button
                        type="button" className="eye-btn"
                        onClick={() => setShowPwd({ ...showPwd, [u.id]: !showPwd[u.id] })}
                        tabIndex={-1}
                      >
                        {showPwd[u.id] ? '🙈' : '👁️'}
                      </button>
                      <button
                        onClick={() => resetPwd(u.id)}
                        style={{ marginLeft: '6px', padding: '7px 12px', background: '#8f60d0', borderRadius: '8px', fontSize: '0.85rem', flexShrink: 0 }}
                      >
                        Réinitialiser
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Protégé</span>
                  )}
                </td>
                <td>
                  {u.username !== 'admin' ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className={u.is_active ? 'btn-light' : ''}
                        style={!u.is_active ? { background: '#1c96a4', color: 'white' } : {}}
                        onClick={() => toggle(u.id, u.is_active)}
                      >
                        {u.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button className="btn-danger" onClick={() => remove(u.id)}>
                        Supprimer
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ height: '16px' }} />

      <div className="page-header" style={{ marginTop: '4px' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem' }}>Stock médicaments</h1>
          <p>Surveillance rapide pour éviter les ruptures de stock.</p>
        </div>

        <div className="dashboard-badge" style={{ background: '#8f60d0' }}>
          💊 Stock
        </div>
      </div>

      {medsError && (
        <p className="error-msg">⚠ {medsError}</p>
      )}

      {!medsError && (
        <>
        <div className="cards-grid" style={{ marginBottom: '14px' }}>
          {(() => {
            const tracked = meds.filter((m) => m.stock !== null && m.stock !== undefined).map((m) => ({ ...m, stock: Number(m.stock) }));
            const notTracked = meds.length - tracked.length;
            const out = tracked.filter((m) => (Number.isFinite(m.stock) ? m.stock : 0) <= 0).length;
            const low = tracked.filter((m) => (Number.isFinite(m.stock) ? m.stock : 0) > 0 && m.stock <= 5).length;
            const ok = tracked.length - out - low;
            const cards = [
              { title: 'Rupture', value: out, color: '#d34a65' },
              { title: 'Stock faible', value: low, color: '#e39d1f' },
              { title: 'Stock OK', value: ok, color: '#1c96a4' },
              { title: 'Non suivi', value: notTracked, color: '#8b9aa3' },
            ];
            return cards.map((c) => (
              <article key={c.title} className="stat-card" style={{ borderTop: `5px solid ${c.color}` }}>
                <h3>{c.title}</h3>
                <strong>{c.value}</strong>
              </article>
            ));
          })()}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Médicament</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {meds.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#5f7b84', padding: '24px' }}>
                  Aucun médicament.
                </td></tr>
              )}
              {meds.map((m) => {
                const stock = (m.stock === null || m.stock === undefined) ? null : Number(m.stock);
                const isOut = stock !== null && stock <= 0;
                const isLow = stock !== null && stock > 0 && stock <= 5;
                const badge = isOut ? { bg: '#fee2e2', fg: '#991b1b', text: 'Rupture' }
                  : isLow ? { bg: '#ffedd5', fg: '#9a3412', text: 'Faible' }
                  : stock === null ? { bg: '#e5e7eb', fg: '#374151', text: 'Non suivi' }
                  : { bg: '#d1fae5', fg: '#065f46', text: 'OK' };

                return (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong></td>
                    <td>{m.price} Ar</td>
                    <td>{stock === null ? '-' : stock}</td>
                    <td>
                      <span style={{
                        background: badge.bg,
                        color: badge.fg,
                        borderRadius: '20px',
                        padding: '3px 10px',
                        fontSize: '0.82rem',
                        fontWeight: 700
                      }}>
                        {badge.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}
