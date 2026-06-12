import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import './App.css';
import ListaContas from './components/ListaContas';
import Login from './components/Login';
import SincronizadorOffline from './components/SincronizadorOffline';
import { clearAuthSession, getAuthSession } from './services/authStorage';
import {
  getRegisteredBiometricCredential,
  isPlatformBiometricAvailable,
  registerPlatformBiometricCredential,
} from './services/deviceBiometrics';
import { processQueue } from './utils/offlineQueue';
import { useEffect, useState } from 'react';
import { FaFingerprint } from 'react-icons/fa';
import { toast } from 'react-toastify';

function App() {
  const [session, setSession] = useState(() => getAuthSession());
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(() => {
    const biometricCredential = getRegisteredBiometricCredential();
    return Boolean(session && biometricCredential?.email === session.email);
  });
  const [biometricSaving, setBiometricSaving] = useState(false);

  useEffect(() => {
    const syncSession = () => setSession(getAuthSession());

    window.addEventListener('auth:changed', syncSession);

    return () => {
      window.removeEventListener('auth:changed', syncSession);
    };
  }, []);

  useEffect(() => {
    isPlatformBiometricAvailable()
      .then(setBiometricAvailable)
      .catch(() => setBiometricAvailable(false));
  }, []);

  useEffect(() => {
    const biometricCredential = getRegisteredBiometricCredential();
    setBiometricEnabled(Boolean(session && biometricCredential?.email === session.email));
  }, [session]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Voltamos online! Sincronizando fila offline...');
      processQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  async function handleEnableBiometrics() {
    if (!session) {
      return;
    }

    setBiometricSaving(true);

    try {
      await registerPlatformBiometricCredential(session.email);
      setBiometricEnabled(true);
      toast.success('Biometria ativada neste dispositivo.');
    } catch {
      toast.error('Nao foi possivel ativar a biometria.');
    } finally {
      setBiometricSaving(false);
    }
  }

  if (!session) {
    return (
      <>
        <Login />
        <ToastContainer position="top-right" autoClose={3000} />
      </>
    );
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <span className="app-kicker">Controle financeiro</span>
          <h1>Controle de Contas Mensais</h1>
        </div>
        <div className="app-header-actions">
          {biometricAvailable && (
            <button
              className="btn-biometria"
              onClick={handleEnableBiometrics}
              disabled={biometricEnabled || biometricSaving}
              title="Ativar Face ID, Touch ID ou biometria neste dispositivo"
            >
              <FaFingerprint aria-hidden="true" />
              {biometricEnabled ? 'Biometria ativa' : biometricSaving ? 'Ativando...' : 'Ativar biometria'}
            </button>
          )}
          <button className="btn-sair" onClick={clearAuthSession}>
            Sair
          </button>
        </div>
      </header>
      <ListaContas />
      <SincronizadorOffline />
      <button className="btn-flutuante" onClick={() => window.scrollTo(0, 0)}>
        +
      </button>
      <ToastContainer position="top-right" autoClose={3000} />
    </main>
  );
}

export default App;
