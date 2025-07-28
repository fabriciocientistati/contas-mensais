import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import './App.css';
import ListaContas from './components/ListaContas';
import SincronizadorOffline from './components/SincronizadorOffline';
import { processQueue } from './utils/offlineQueue';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const handleOnline = () => {
      console.log('🔁 Voltamos online! Sincronizando fila offline...');
      processQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <main>
      <h1>Controle de Contas Mensais</h1>
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