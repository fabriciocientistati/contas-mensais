import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { saveAuthSession } from '../services/authStorage';

type LoginResponse = {
  token: string;
  email: string;
  expiresAt: string;
};

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.warning('Informe e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      saveAuthSession({
        token: data.token,
        email: data.email,
        expiresAt: data.expiresAt,
      });

      toast.success('Acesso liberado.');
    } catch {
      toast.error('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-badge">Contas Mensais</div>
        <h1>Acesse seu painel</h1>
        <p className="login-subtitle">
          Entre com o usuário configurado no Railway para liberar seus dados financeiros.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="seu@email.com"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Sua senha"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="login-note">
          Próxima etapa: registrar uma passkey para usar Face ID, Touch ID ou biometria do aparelho.
        </p>
      </section>
    </main>
  );
}

export default Login;
