import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FaFingerprint } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';
import {
  getBiometricLoginState,
  saveAuthSession,
  unlockAuthSessionWithBiometrics,
} from '../services/authStorage';
import {
  authenticateWithPlatformBiometrics,
  isPlatformBiometricAvailable,
} from '../services/deviceBiometrics';

type LoginResponse = {
  token: string;
  email: string;
  expiresAt: string;
};

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const biometricLoginState = getBiometricLoginState();

  useEffect(() => {
    isPlatformBiometricAvailable()
      .then(setBiometricAvailable)
      .catch(() => setBiometricAvailable(false));
  }, []);

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
      toast.error('E-mail ou senha invalidos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    if (!biometricLoginState) {
      toast.warning('Entre com e-mail e senha antes de ativar a biometria neste dispositivo.');
      return;
    }

    setBiometricLoading(true);

    try {
      const authenticated = await authenticateWithPlatformBiometrics(biometricLoginState.credential);

      if (!authenticated) {
        toast.error('Nao foi possivel confirmar a biometria.');
        return;
      }

      unlockAuthSessionWithBiometrics();
      toast.success('Acesso liberado pela biometria.');
    } catch {
      toast.error('Biometria cancelada ou indisponivel.');
    } finally {
      setBiometricLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-badge">Contas Mensais</div>
        <h1>Acesse seu painel</h1>
        <p className="login-subtitle">
          Entre com o usuario configurado no Railway para liberar seus dados financeiros.
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

        {biometricAvailable && biometricLoginState && (
          <div className="biometric-login">
            <div className="biometric-divider">
              <span>ou</span>
            </div>
            <button
              type="button"
              className="biometric-button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              title="Entrar com Face ID, Touch ID ou biometria do dispositivo"
            >
              <FaFingerprint aria-hidden="true" />
              {biometricLoading ? 'Confirmando...' : 'Entrar com biometria'}
            </button>
            <span className="biometric-email">{biometricLoginState.email}</span>
          </div>
        )}

        <p className="login-note">
          Ative a biometria depois do login por senha para desbloquear este dispositivo com Face ID,
          Touch ID ou leitor digital.
        </p>
      </section>
    </main>
  );
}

export default Login;
