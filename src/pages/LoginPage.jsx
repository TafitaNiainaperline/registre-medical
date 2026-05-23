import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isRegister) {
        if (form.password !== form.confirm) {
          setError('Les mots de passe ne correspondent pas.');
          return;
        }
        await window.api.register({ username: form.username, name: form.name, password: form.password });
        setSuccess('Compte créé ! Attendez que l\'administrateur active votre compte.');
        setIsRegister(false);
        setForm({ username: '', name: '', password: '', confirm: '' });
        return;
      }
      const user = await window.api.login({ username: form.username, password: form.password });
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/');
    } catch (err) {
      const raw = String(err?.message || 'Erreur d\'authentification');
      const m1 = raw.match(/Error invoking remote method '[^']+':\s*Error:\s*(.*)$/i);
      const m2 = raw.match(/Error:\s*(.*)$/i);
      const clean = (m1?.[1] || m2?.[1] || raw).trim();
      setError(clean || 'Erreur d\'authentification');
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <div className="auth-circle"></div>
          <div className="auth-circle auth-circle-2"></div>
        </div>
        
        <img src="./Logo.png" alt="Logo" className="auth-logo" />
        <h1>{isRegister ? 'Créer un compte' : 'Connexion'}</h1>
        <p>Application de registre médical sécurisée.</p>

        <form onSubmit={submit}>
          {isRegister && (
            <input
              name="name"
              placeholder="Nom complet"
              value={form.name}
              onChange={onChange}
              required
            />
          )}

          <input
            name="username"
            placeholder="Pseudo"
            value={form.username}
            onChange={onChange}
            required
            autoComplete="username"
          />

          <div className="pwd-field">
            <input
              name="password"
              type={showPwd ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={form.password}
              onChange={onChange}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button type="button" className="eye-btn" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>

          {isRegister && (
            <div className="pwd-field">
              <input
                name="confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirmer le mot de passe"
                value={form.confirm}
                onChange={onChange}
                required
                autoComplete="new-password"
              />
              <button type="button" className="eye-btn" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          )}

          {error && <p className="error-msg">⚠ {error}</p>}
          {success && <p className="success-msg">✓ {success}</p>}

          <button type="submit">
            {isRegister ? 'Envoyer la demande' : 'Se connecter'}
          </button>
        </form>

        <button className="link-btn" onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}>
          {isRegister ? 'J\'ai déjà un compte' : 'Créer un compte'}
        </button>
      </div>
    </section>
  );
}
