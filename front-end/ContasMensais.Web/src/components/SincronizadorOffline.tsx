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
    <div className="offline-banner">
      <span className="offline-banner-text">Voce possui acoes offline pendentes.</span>
      <button type="button" className="offline-banner-btn" onClick={sincronizar}>
        Sincronizar agora
      </button>
    </div>
  );
};

export default SincronizadorOffline;
