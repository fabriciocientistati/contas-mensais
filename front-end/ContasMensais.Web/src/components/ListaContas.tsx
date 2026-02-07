import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../services/api';
import type { Conta } from '../types/Conta';
import FormularioNovaConta from './FormularioNovaConta';
import SeletorMesAno from './SeletorMesAno';
import { FaTrash, FaCheck, FaUndo, FaEdit } from 'react-icons/fa';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import GraficoTotais from './GraficoTotais';

const ListaContas = () => {
  const [contas, setContas] = useState<Conta[]>([]);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [atualizacaoGrafico, setAtualizacaoGrafico] = useState(0);
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pagas' | 'nao-pagas'>('todas');
  const [busca, setBusca] = useState('');
  const [receitaTotal, setReceitaTotal] = useState<string>('');

  useEffect(() => {
    const chave = `receita-total-${ano}-${mes}`;
    const salva = localStorage.getItem(chave);
    setReceitaTotal(salva ?? '');
  }, [ano, mes]);

  const totalMes = contas.length
    ? contas.reduce((total, conta) =>
        total + (conta.valorParcela ?? 0) * (conta.quantidadeParcelas ?? 0), 0)
    : 0;

  const totalPago = contas.length
    ? contas.reduce((total, conta) =>
        total + (conta.paga
          ? (conta.valorParcela ?? 0) * (conta.quantidadeParcelas ?? 0)
          : 0), 0)
    : 0;

  const totalPendente = Math.max(totalMes - totalPago, 0);
  const receitaTotalNumerica = Number.isFinite(Number(receitaTotal)) ? Number(receitaTotal) : 0;
  const saldoReceita = receitaTotalNumerica - totalPago;

  const atualizarReceitaTotal = (valor: string) => {
    setReceitaTotal(valor);
    const chave = `receita-total-${ano}-${mes}`;
    if (!valor.trim()) {
      localStorage.removeItem(chave);
      return;
    }
    localStorage.setItem(chave, valor);
  };

  const carregar = useCallback(() => {
    api.get<Conta[]>(`/contas?ano=${ano}&mes=${mes}`)
      .then(res => {
        const dados = res.data;
        const contasSeguras = Array.isArray(dados) ? dados : [];
        setContas(contasSeguras);
        localStorage.setItem(`contas-cache-${ano}-${mes}`, JSON.stringify(contasSeguras));
      })
      .catch(err => {
        console.error('Erro ao buscar contas:', err);
        setContas([]);
      });
  }, [ano, mes]);
    
  useEffect(() => {
    const listener = () => {
      console.log('🔁 Esperando para recarregar...');
      setTimeout(() => {
        carregar();
      }, 1000); // aguarda 1 segundo para garantir que a API terminou
    };

    window.addEventListener('sincronizacao-finalizada', listener);
    return () => window.removeEventListener('sincronizacao-finalizada', listener);
  }, [carregar]);

  useEffect(() => {
    if (!navigator.onLine) {
      const cacheKey = `contas-cache-${ano}-${mes}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setContas(JSON.parse(cached));
        console.log("📦 Carregado do cache offline:", cacheKey);
      }
      return;
    }
    carregar();
  }, [ano, mes, carregar]);

  useEffect(() => {
    if (!navigator.onLine) {
      const cacheKey = `contas-cache-${ano}-${mes}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setContas(JSON.parse(cached));
        console.log("📦 Carregado do cache offline:", cacheKey);
      }
      return;
    }
    if (!busca.trim()) {
      carregar();
      return;
    }

    const delayDebounce = setTimeout(() => {
      api.get<Conta[]>(`/contas/busca?valor=${encodeURIComponent(busca)}&ano=${ano}&mes=${mes}`)
        .then(res => {
          setContas(res.data);
        })
        .catch(err => {
          toast.error('Nenhuma conta encontrada.');
          setContas([]);
          console.error('Erro ao buscar contas:', err);
        });

    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [busca, ano, mes, carregar]);

  const alternarPagamento = (conta: Conta) => {
    const rota = conta.paga ? 'desmarcar' : 'pagar';
    api.put(`/contas/${conta.id}/${rota}`).then(() => {
      setContas(prev =>
        prev.map(c => c.id === conta.id ? { ...c, paga: !c.paga } : c)
      );
    });
  };

  const remover = (id: string) => {
    Swal.fire({
      title: 'Tem certeza?',
      text: 'Essa ação não poderá ser desfeita!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, apagar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        api.delete(`/contas/${id}`).then(() => {
          setContas(prev => prev.filter(c => c.id !== id));
          setAtualizacaoGrafico(prev => prev + 1);
          toast.success('Conta removida com sucesso.');
        }).catch(() => {
          toast.error('Erro ao remover a conta.');
        });
      }
    });
  };
  
  const gerarPdfCompleto = async () => {
    try {
      const response = await api.get('/contas/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Relatorio-Completo.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erro ao gerar o PDF completo:', error);
      toast.error('Erro ao gerar o PDF completo.');
    }
  };

  const gerarPdfFiltrado = async () => {
    try {
      const params = new URLSearchParams({
        ano: String(ano),
        mes: String(mes),
        status: filtroStatus,
        nome: busca.trim()
      });

      const response = await api.get(`/contas/pdf?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Relatorio-Filtrado.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erro ao gerar o PDF filtrado:', error);
      toast.error('Erro ao gerar o PDF filtrado.');
    }
  };

  const isVencida = (conta: Conta) => {
    return !conta.paga && dayjs(conta.dataVencimento).isBefore(dayjs(), 'day');
  };

  return (
    <div>
      <SeletorMesAno ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />

      <FormularioNovaConta
        ano={ano}
        mes={mes}
        contaParaEditar={contaEditando}
        onContasSalvas={(contasCriadas) => {
          setContaEditando(null);
          setAtualizacaoGrafico(prev => prev + 1);

          // ✅ Recarrega o mês atual para refletir alterações corretamente
          carregar();

          const contasDoMesAtual = contasCriadas.filter(c => c.ano === ano && c.mes === mes);

          setContas(prev => {
            const idsCriadas = contasCriadas.map(c => c.id);
            const semEditadas = prev.filter(c => !idsCriadas.includes(c.id));
            return [...contasDoMesAtual, ...semEditadas];
          });

          setAtualizacaoGrafico(prev => prev + 1);
        }}
      />

      <div className="resumo-receita">
        <h2>Receita e Descontos</h2>
        <label htmlFor="receita-total" className="resumo-label">
          Receita total do mes
        </label>
        <input
          id="receita-total"
          type="number"
          step="0.01"
          min="0"
          value={receitaTotal}
          onChange={(e) => atualizarReceitaTotal(e.target.value)}
          placeholder="Informe a receita total do mes..."
        />

        <div className="resumo-grid">
          <div className="resumo-item">
            <span className="resumo-item-label">Receita total</span>
            <strong className="resumo-item-valor">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(receitaTotalNumerica)}
            </strong>
          </div>
          <div className="resumo-item">
            <span className="resumo-item-label">Total descontado (pagas)</span>
            <strong className="resumo-item-valor">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(totalPago)}
            </strong>
          </div>
          <div className="resumo-item">
            <span className="resumo-item-label">Saldo da receita</span>
            <strong className={`resumo-item-valor ${saldoReceita < 0 ? 'saldo-negativo' : 'saldo-positivo'}`}>
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(saldoReceita)}
            </strong>
          </div>
          <div className="resumo-item">
            <span className="resumo-item-label">Total pendente</span>
            <strong className="resumo-item-valor">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(totalPendente)}
            </strong>
          </div>
        </div>
      </div>

    <div className="botoes-relatorio">
      <button onClick={gerarPdfFiltrado}>📄 Gerar PDF filtrado</button>
      <button onClick={gerarPdfCompleto}>📄 Gerar PDF completo</button>
    </div>


      <div style={{ margin: '10px 0' }}>
        <input
          type="text"
          placeholder="Buscar contas pelo nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{
            padding: '10px',
            width: '100%',
            fontSize: '16px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ margin: '10px 0' }}>
        <label htmlFor="filtro" style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
          Filtrar por:
        </label>
        <select
          id="filtro"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as 'todas' | 'pagas' | 'nao-pagas')}
          style={{
            padding: '10px',
            width: '100%',
            fontSize: '16px',
            boxSizing: 'border-box'
          }}
        >
          <option value="todas">Todas</option>
          <option value="pagas">Pagas</option>
          <option value="nao-pagas">Não pagas</option>
        </select>
      </div>

      <ul className="lista">
        {contas
          .filter(conta => {
            if (filtroStatus === 'pagas') return conta.paga === true;
            if (filtroStatus === 'nao-pagas') return conta.paga === false;
            return true;
          })
          .map(conta => (
            <motion.li
              key={conta.id}
              className={
                conta.paga
                  ? 'paga'
                  : isVencida(conta)
                    ? 'vencida'
                    : 'nao-paga'
              }
            >
              <span className='nome-conta'>
                {busca.trim()
                  ? conta.nome.split(new RegExp(`(${busca})`, 'gi')).map((parte, i) =>
                      parte.toLowerCase() === busca.toLowerCase() ? (
                        <mark key={i} style={{ backgroundColor: 'yellow' }}>{parte}</mark>
                      ) : (
                        <span key={i}>{parte}</span>
                      )
                    )
                  : conta.nome}
              </span>
              <span>Venc.: {dayjs(conta.dataVencimento).format('DD/MM/YYYY')}</span>
              <span>Parcela: {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(conta.valorParcela)}</span>
              <span>Qtd: <small style={{ color: '#666' }}>({conta.indiceParcela}/{conta.totalParcelas})</small></span>
              <span>Total: {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format((conta.valorParcela ?? 0) * (conta.quantidadeParcelas ?? 1))}</span>
              <div>
                <button
                  className={conta.paga ? 'desmarcar' : 'pagar'}
                  onClick={() => alternarPagamento(conta)}
                >
                  {conta.paga ? <><FaUndo /> Desmarcar</> : <><FaCheck /> Pagar</>}
                </button>

                <button className='editar' onClick={() => {
                  setContaEditando(conta);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>
                  <FaEdit /> Editar
                </button>

                <button className="remover" onClick={() => remover(conta.id)}>
                  <FaTrash /> Remover
                </button>

              </div>
            </motion.li>
          ))}
      </ul>

      <div className="total-mes">
        Total do mês: {new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(totalMes)}
      </div>

      <GraficoTotais ano={ano} atualizar={atualizacaoGrafico} />

    </div>
  );
};

export default ListaContas;
