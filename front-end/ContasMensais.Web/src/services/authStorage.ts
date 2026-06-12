import {
  clearRegisteredBiometricCredential,
  getRegisteredBiometricCredential,
} from './deviceBiometrics';

const TOKEN_KEY = 'contas_mensais_auth_token';
const USER_EMAIL_KEY = 'contas_mensais_auth_email';
const EXPIRES_AT_KEY = 'contas_mensais_auth_expires_at';
const UNLOCKED_KEY = 'contas_mensais_auth_unlocked';

export type AuthSession = {
  token: string;
  email: string;
  expiresAt: string;
};

function readStoredAuthSession(): AuthSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const email = localStorage.getItem(USER_EMAIL_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);

  if (!token || !email || !expiresAt) {
    return null;
  }

  if (new Date(expiresAt).getTime() <= Date.now()) {
    clearAuthSession();
    return null;
  }

  return { token, email, expiresAt };
}

export function getAuthSession(): AuthSession | null {
  const session = readStoredAuthSession();

  if (!session) {
    return null;
  }

  const biometricCredential = getRegisteredBiometricCredential();

  if (
    biometricCredential?.email === session.email &&
    sessionStorage.getItem(UNLOCKED_KEY) !== 'true'
  ) {
    return null;
  }

  return session;
}

export function getBiometricLoginState() {
  const session = readStoredAuthSession();
  const credential = getRegisteredBiometricCredential();

  if (!session || !credential || credential.email !== session.email) {
    return null;
  }

  return {
    email: session.email,
    credential,
  };
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_EMAIL_KEY, session.email);
  localStorage.setItem(EXPIRES_AT_KEY, session.expiresAt);
  sessionStorage.setItem(UNLOCKED_KEY, 'true');
  window.dispatchEvent(new Event('auth:changed'));
}

export function unlockAuthSessionWithBiometrics() {
  const session = readStoredAuthSession();

  if (!session) {
    return null;
  }

  sessionStorage.setItem(UNLOCKED_KEY, 'true');
  window.dispatchEvent(new Event('auth:changed'));

  return session;
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  sessionStorage.removeItem(UNLOCKED_KEY);
  clearRegisteredBiometricCredential();
  window.dispatchEvent(new Event('auth:changed'));
}
