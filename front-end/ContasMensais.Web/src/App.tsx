import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import './App.css';
import ListaContas from './components/ListaContas';
import Login from './components/Login';
import SincronizadorOffline from './components/SincronizadorOffline';
import { clearAuthSession, getAuthSession } from './services/authStorage';
import { processQueue } from './utils/offlineQueue';
import { useEffect, useState } from 'react';

function App() {
  const [session, setSession] = useState(() => getAuthSession());

  useEffect(() => {
    const syncSession = () => setSession(getAuthSession());

    window.addEventListener('auth:changed', syncSession);

    return () => {
      window.removeEventListener('auth:changed', syncSession);
    };
  }, []);

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
        <button className="btn-sair" onClick={clearAuthSession}>
          Sair
        </button>
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
