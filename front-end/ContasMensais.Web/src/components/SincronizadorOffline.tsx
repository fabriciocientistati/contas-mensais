import { useEffect, useState } from 'react';
import { processQueue, getQueue } from '../utils/offlineQueue';
import { toast } from 'react-toastify';

const SincronizadorOffline = () => {
  const [temPendencias, setTemPendencias] = useState(false);

  useEffect(() => {
    const fila = getQueue();
    setTemPendencias(fila.length > 0);

    const verificarFila = setInterval(() => {
      const filaAtual = getQueue();
      setTemPendencias(filaAtual.length > 0 && navigator.onLine);
    }, 5000); // checa a cada 5s

    return () => clearInterval(verificarFila);
  }, []);

  const sincronizar = async () => {
    try {
      await processQueue();
      toast.success('Dados sincronizados com sucesso!');
      setTemPendencias(false);
    } catch {
      toast.error('Erro ao sincronizar dados offline.');
    }
  };

  if (!temPendencias || !navigator.onLine) return null;

  return (
    <div style={{
      backgroundColor: '#facc15',
      color: '#000',
      padding: '12px',
      textAlign: 'center',
      position: 'fixed',
      bottom: 0,
      width: '100%',
      zIndex: 1000
    }}>
      <strong>Você possui ações offline pendentes.</strong>
      <button onClick={sincronizar} style={{
        marginLeft: '10px',
        background: '#000',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer'
      }}>
        🔄 Sincronizar agora
      </button>
    </div>
  );
};

export default SincronizadorOffline;