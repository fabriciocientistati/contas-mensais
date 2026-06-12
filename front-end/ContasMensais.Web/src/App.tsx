import 'react-toastify/dist/ReactToastify.css';
import { useEffect, useRef, useState } from 'react';
import { FaFingerprint, FaUsers } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import './App.css';
import GerenciadorUsuarios from './components/GerenciadorUsuarios';
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

function App() {
  const [session, setSession] = useState(() => getAuthSession());
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(() => {
    const biometricCredential = getRegisteredBiometricCredential();
    return Boolean(session && biometricCredential?.email === session.email);
  });
  const [biometricSaving, setBiometricSaving] = useState(false);
  const [usuariosAberto, setUsuariosAberto] = useState(false);
  const [usuariosFechando, setUsuariosFechando] = useState(false);
  const timeoutFecharUsuarios = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (timeoutFecharUsuarios.current) {
        window.clearTimeout(timeoutFecharUsuarios.current);
      }
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

  function abrirUsuarios() {
    if (timeoutFecharUsuarios.current) {
      window.clearTimeout(timeoutFecharUsuarios.current);
      timeoutFecharUsuarios.current = null;
    }

    setUsuariosFechando(false);
    setUsuariosAberto(true);
  }

  function fecharUsuarios() {
    if (!usuariosAberto || usuariosFechando) {
      return;
    }

    setUsuariosFechando(true);
    timeoutFecharUsuarios.current = window.setTimeout(() => {
      setUsuariosAberto(false);
      setUsuariosFechando(false);
      timeoutFecharUsuarios.current = null;
    }, 200);
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
          <button
            className="btn-usuarios"
            onClick={abrirUsuarios}
            title="Gerenciar usuarios de acesso"
          >
            <FaUsers aria-hidden="true" />
            Usuarios
          </button>
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
      <GerenciadorUsuarios
        aberto={usuariosAberto}
        fechando={usuariosFechando}
        onFechar={fecharUsuarios}
      />
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
