import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [newPwd, setNewPwd] = useState({});
  const [showPwd, setShowPwd] = useState({});
  const [msg, setMsg] = useState({ text: '', type: 'ok' });
  const [meds, setMeds] = useState([]);
  const [dispensations, setDispensations] = useState([]);
  const [dispError, setDispError] = useState('');
  const [editingDisp, setEditingDisp] = useState(null);
  const [editDispForm, setEditDispForm] = useState({ medication_id: '', quantity: '' });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const load = () => window.api.getAllUsers().then(setUsers).catch(() => {});
  const loadMeds = () =>
    window.api.listMedications()
      .then((r) => setMeds(r || []))
      .catch(() => setMeds([]));

  const loadDispensations = () =>
    window.api.getDispensations()
      .then((r) => { setDispensations(r || []); setDispError(''); })
      .catch((e) => { setDispensations([]); setDispError(e?.message || 'Impossible de charger les dispensations.'); });

  useEffect(() => { load(); loadMeds(); loadDispensations(); }, []);

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

  const deleteDispensation = async (id) => {
    if (!window.confirm('Supprimer cette dispensation ? Le stock sera recrédité.')) return;
    try {
      await window.api.deleteDispensation(id);
      notify('Dispensation supprimée, stock recrédité.');
      loadDispensations();
      loadMeds();
    } catch (err) {
      notify(err?.message || 'Erreur lors de la suppression.', 'err');
    }
  };

  const startEditDisp = (d) => {
    setEditingDisp(Number(d.id));
    setEditDispForm({ medication_id: String(d.medication_id), quantity: String(d.quantity) });
  };

  const saveEditDisp = async () => {
    try {
      await window.api.updateDispensation({
        id: editingDisp,
        medication_id: Number(editDispForm.medication_id),
        quantity: Number(editDispForm.quantity),
      });
      notify('Dispensation modifiée.');
      setEditingDisp(null);
      setEditDispForm({ medication_id: '', quantity: '' });
      loadDispensations();
      loadMeds();
    } catch (err) {
      notify(err?.message || 'Erreur lors de la modification.', 'err');
    }
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
          <h1 style={{ fontSize: '1.35rem' }}>Dispensations</h1>
          <p>Historique et gestion des dispensations de médicaments.</p>
        </div>
        <div className="dashboard-badge" style={{ background: '#4a90d9' }}>
          💊 Dispensations
        </div>
      </div>

      {dispError && <p className="error-msg">⚠ {dispError}</p>}

      {!dispError && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Médicament</th>
                <th>Unité</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dispensations.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#5f7b84', padding: '24px' }}>
                    Aucune dispensation enregistrée.
                  </td>
                </tr>
              )}
              {dispensations.map((d) => {
                const editing = editingDisp === d.id;
                return (
                  <tr key={d.id}>
                    <td style={{ fontSize: '0.85rem', color: '#5f7b84' }}>
                      {new Date(d.created_at).toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}
                    </td>
                    {editing ? (
                      <>
                        <td>
                          <select
                            style={{ width: '100%', padding: '7px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit' }}
                            value={editDispForm.medication_id}
                            onChange={(e) => setEditDispForm({ ...editDispForm, medication_id: e.target.value })}
                          >
                            <option value="">--</option>
                            {meds.map((m) => (
                              <option key={m.id} value={String(m.id)}>{m.name} ({m.unit || 'comprimé'})</option>
                            ))}
                          </select>
                        </td>
                        <td>{meds.find((m) => Number(m.id) === Number(editDispForm.medication_id))?.unit || 'comprimé'}</td>
                        <td>
                          <input type="number" min="1" value={editDispForm.quantity}
                            onChange={(e) => setEditDispForm({ ...editDispForm, quantity: e.target.value })}
                            style={{ width: '80px', padding: '7px', border: '1px solid #c8d9df', borderRadius: '8px', font: 'inherit' }} />
                        </td>
                        <td>-</td>
                        <td>-</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={saveEditDisp} style={{ background: '#1c96a4' }}>✓</button>
                            <button className="btn-light" onClick={() => setEditingDisp(null)}>✕</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{d.medication_name}</strong></td>
                        <td>{d.unit || 'comprimé'}</td>
                        <td>{d.quantity}</td>
                        <td>{Number(d.unit_price || 0).toLocaleString()} Ar</td>
                        <td>{(Number(d.unit_price || 0) * Number(d.quantity)).toLocaleString()} Ar</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="icon-btn" onClick={() => startEditDisp(d)} title="Modifier">✏️</button>
                            <button className="icon-btn danger" onClick={() => deleteDispensation(d.id)} title="Supprimer">🗑️</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
