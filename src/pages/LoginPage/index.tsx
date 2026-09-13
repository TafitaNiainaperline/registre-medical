import Icon from '../../components/Icon'
import { useLoginPage } from './useLoginPage'
import './LoginPage.scss'

const LoginPage = () => {
  const {
    isRegister, form, error, success, showPwd, showConfirm,
    change, submit, toggleMode, toggleShowPwd, toggleShowConfirm,
  } = useLoginPage()

  return (
    <section className="LoginPage">
      <div className="card">
        <span className="logo" role="img" aria-label="Logo" />
        <h1>{isRegister ? 'Créer un compte' : 'Connexion'}</h1>
        <p>Application de registre médical sécurisée.</p>

        <form onSubmit={submit}>
          {isRegister && (
            <div className="input-field">
              <Icon name="user" size="md" />
              <input name="name" placeholder="Nom complet" value={form.name} onChange={change} required />
            </div>
          )}

          <div className="input-field">
            <Icon name="user" size="md" />
            <input
              name="username"
              placeholder="Pseudo"
              value={form.username}
              onChange={change}
              required
              autoComplete="username"
            />
          </div>

          <div className="input-field">
            <Icon name="lock" size="md" />
            <input
              name="password"
              type={showPwd ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={form.password}
              onChange={change}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button type="button" className="eye-btn" onClick={toggleShowPwd} tabIndex={-1}>
              <Icon name={showPwd ? 'eye-off' : 'eye'} size="md" />
            </button>
          </div>

          {isRegister && (
            <div className="input-field">
              <Icon name="lock" size="md" />
              <input
                name="confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirmer le mot de passe"
                value={form.confirm}
                onChange={change}
                required
                autoComplete="new-password"
              />
              <button type="button" className="eye-btn" onClick={toggleShowConfirm} tabIndex={-1}>
                <Icon name={showConfirm ? 'eye-off' : 'eye'} size="md" />
              </button>
            </div>
          )}

          {error && <p className="error-msg"><Icon name="alert" /> {error}</p>}
          {success && <p className="success-msg"><Icon name="check-circle" /> {success}</p>}

          <button type="submit" className="submit">
            <Icon name={isRegister ? 'user-plus' : 'login'} size="md" />
            {isRegister ? 'Envoyer la demande' : 'Se connecter'}
          </button>
        </form>

        <button className="link-btn" onClick={toggleMode}>
          {isRegister ? 'J\'ai déjà un compte' : 'Créer un compte'}
        </button>
      </div>
    </section>
  )
}

export default LoginPage
