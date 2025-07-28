import api from '../services/api';

export type OfflineAction = {
  method: 'POST' | 'PUT';
  url: string;
  data?: any;
};

const KEY = 'offline-queue';

export function addToQueue(action: OfflineAction) {
  const fila = getQueue();
  fila.push(action);
  localStorage.setItem(KEY, JSON.stringify(fila));
}

export function getQueue(): OfflineAction[] {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function processQueue() {
  const fila = getQueue();
  const realizados: OfflineAction[] = [];

  for (const acao of fila) {
    try {
      await api.request({ method: acao.method, url: acao.url, data: acao.data });
      realizados.push(acao);
    } catch {
      break;
    }
  }

  const restantes = fila.filter(f => !realizados.includes(f));
  localStorage.setItem(KEY, JSON.stringify(restantes));

  // ✅ Disparar evento se houve sincronização com sucesso
  if (realizados.length > 0) {
    window.dispatchEvent(new CustomEvent('sincronizacao-finalizada'));
  }
}