const TOKEN_KEY = 'contas_mensais_auth_token';
const USER_EMAIL_KEY = 'contas_mensais_auth_email';
const EXPIRES_AT_KEY = 'contas_mensais_auth_expires_at';

export type AuthSession = {
  token: string;
  email: string;
  expiresAt: string;
};

export function getAuthSession(): AuthSession | null {
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

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_EMAIL_KEY, session.email);
  localStorage.setItem(EXPIRES_AT_KEY, session.expiresAt);
  window.dispatchEvent(new Event('auth:changed'));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  window.dispatchEvent(new Event('auth:changed'));
}
