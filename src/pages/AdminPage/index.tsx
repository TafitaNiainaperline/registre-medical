import Icon from '../../components/Icon'
import { useAdminPage } from './useAdminPage'
import './AdminPage.scss'

const AdminPage = () => {
  const {
    users, currentUser, message, newPwd, showPwd,
    setPassword, togglePasswordVisibility, toggleActive, resetPassword, remove,
  } = useAdminPage()

  if (currentUser.role !== 'admin') {
    return (
      <section className="AdminPage">
        <h1>Accès refusé</h1>
        <p>Seul l'administrateur peut accéder à cette page.</p>
      </section>
    )
  }

  return (
    <section className="AdminPage">
      <div className="page-header">
        <div>
          <h1>Gestion des utilisateurs</h1>
          <p>Activez, désactivez et gérez les comptes utilisateurs de la clinique.</p>
        </div>
        <div className="page-badge">
          <Icon name="users" /> Administration
        </div>
      </div>

      {message.text && (
        <div className={message.type === 'err' ? 'error-msg' : 'success-msg'}>
          <Icon name={message.type === 'err' ? 'alert' : 'check-circle'} />
          {message.text}
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
              <tr><td className="empty" colSpan={6}>Aucun utilisateur trouvé.</td></tr>
            )}

            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.username}</strong></td>
                <td>{user.name}</td>
                <td>
                  <span className={user.role === 'admin' ? 'badge brand' : 'badge neutral'}>
                    {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                  </span>
                </td>
                <td>
                  <span className={user.is_active ? 'badge ok' : 'badge ko'}>
                    {user.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  {user.username === 'admin' ? (
                    <span className="protected">Protégé</span>
                  ) : (
                    <div className="reset">
                      <div className="pwd-field">
                        <input
                          type={showPwd[user.id] ? 'text' : 'password'}
                          placeholder="Nouveau mot de passe..."
                          value={newPwd[user.id] || ''}
                          onChange={(e) => setPassword(user.id, e.target.value)}
                        />
                        <button
                          type="button"
                          className="eye-btn"
                          onClick={() => togglePasswordVisibility(user.id)}
                          tabIndex={-1}
                        >
                          <Icon name={showPwd[user.id] ? 'eye-off' : 'eye'} />
                        </button>
                      </div>
                      <button className="apply" onClick={() => resetPassword(user.id)}>Réinitialiser</button>
                    </div>
                  )}
                </td>
                <td className="actions">
                  {user.username === 'admin' ? (
                    <span className="protected">—</span>
                  ) : (
                    <div>
                      <button
                        className={user.is_active ? 'btn-light' : ''}
                        onClick={() => toggleActive(user.id, user.is_active)}
                      >
                        {user.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button className="btn-danger" onClick={() => remove(user.id)}>Supprimer</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminPage
