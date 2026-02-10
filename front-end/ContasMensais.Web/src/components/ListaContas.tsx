import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../services/api';
import type { Conta } from '../types/Conta';
import type { ReceitaMensal } from '../types/ReceitaMensal';
import FormularioNovaConta from './FormularioNovaConta';
import SeletorMesAno from './SeletorMesAno';
import { FaTrash, FaCheck, FaUndo, FaEdit } from 'react-icons/fa';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import GraficoTotais from './GraficoTotais';
import { addToQueue } from '../utils/offlineQueue';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../utils/currency';

const ListaContas = () => {
  const [contas, setContas] = useState<Conta[]>([]);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [atualizacaoGrafico, setAtualizacaoGrafico] = useState(0);
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pagas' | 'nao-pagas'>('todas');
  const [busca, setBusca] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const [receitaTotal, setReceitaTotal] = useState<string>('');
  const [receitaExtra, setReceitaExtra] = useState<string>('');
  const [receitaServidor, setReceitaServidor] = useState<number | null>(null);
  const [carregandoReceita, setCarregandoReceita] = useState(false);
  const [salvandoReceita, setSalvandoReceita] = useState(false);
  const [propagarReceita, setPropagarReceita] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscaSemResultado, setBuscaSemResultado] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [modalReceitaAberta, setModalReceitaAberta] = useState(false);
  const [modalContaFechando, setModalContaFechando] = useState(false);
  const [modalReceitaFechando, setModalReceitaFechando] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const timeoutFecharConta = useRef<number | null>(null);
  const timeoutFecharReceita = useRef<number | null>(null);
  const mesesPropagar = 12;
  const chavePropagarReceita = 'propagar-receita';

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
  const receitaTotalNumerica = parseCurrencyInput(receitaTotal);
  const receitaExtraNumerica = parseCurrencyInput(receitaExtra);
  const saldoReceita = receitaTotalNumerica - totalPago;
  const receitaValida = receitaTotal.trim() !== '';
  const receitaAlterada = receitaValida
    ? (receitaServidor === null || receitaTotalNumerica !== receitaServidor)
    : false;
  const receitaExtraValida = receitaExtra.trim() !== '' && receitaExtraNumerica > 0;
  const diaFiltroNumero = Number(filtroDia);
  const filtroDiaAtivo = Number.isInteger(diaFiltroNumero) && diaFiltroNumero >= 1 && diaFiltroNumero <= 31;
  const filtrosDisponiveis = [
    { value: 'todas', label: 'Todas' },
    { value: 'pagas', label: 'Pagas' },
    { value: 'nao-pagas', label: 'Em aberto' },
  ] as const;
  const buscaAtiva = busca.trim().length > 0;

  const abrirModalConta = (conta?: Conta | null) => {
    if (timeoutFecharConta.current) {
      window.clearTimeout(timeoutFecharConta.current);
      timeoutFecharConta.current = null;
    }
    setModalContaFechando(false);
    setContaEditando(conta ?? null);
    setFormKey(prev => prev + 1);
    setModalContaAberto(true);
  };

  const fecharModalConta = () => {
    if (!modalContaAberto || modalContaFechando) return;
    setModalContaFechando(true);
    timeoutFecharConta.current = window.setTimeout(() => {
      setModalContaAberto(false);
      setContaEditando(null);
      setFormKey(prev => prev + 1);
      setModalContaFechando(false);
      timeoutFecharConta.current = null;
    }, 200);
  };

  const abrirModalReceita = () => {
    if (timeoutFecharReceita.current) {
      window.clearTimeout(timeoutFecharReceita.current);
      timeoutFecharReceita.current = null;
    }
    setModalReceitaFechando(false);
    setModalReceitaAberta(true);
  };
  const fecharModalReceita = () => {
    if (!modalReceitaAberta || modalReceitaFechando) return;
    setModalReceitaFechando(true);
    timeoutFecharReceita.current = window.setTimeout(() => {
      setModalReceitaAberta(false);
      setModalReceitaFechando(false);
      timeoutFecharReceita.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (timeoutFecharConta.current) {
        window.clearTimeout(timeoutFecharConta.current);
      }
      if (timeoutFecharReceita.current) {
        window.clearTimeout(timeoutFecharReceita.current);
      }
    };
  }, []);

  useEffect(() => {
    const salvo = localStorage.getItem(chavePropagarReceita);
    if (salvo !== null) {
      setPropagarReceita(salvo === 'true');
    }
  }, []);

  const atualizarReceitaTotal = (valor: string) => {
    setReceitaTotal(formatCurrencyInput(valor));
  };

  const atualizarPropagacao = (valor: boolean) => {
    setPropagarReceita(valor);
    localStorage.setItem(chavePropagarReceita, String(valor));
  };

  const obterMesesFuturos = (anoBase: number, mesBase: number, quantidade: number) => {
    const meses: { ano: number; mes: number }[] = [];
    let anoAtual = anoBase;
    let mesAtual = mesBase;

    for (let i = 0; i < quantidade; i += 1) {
      mesAtual += 1;
      if (mesAtual > 12) {
        mesAtual = 1;
        anoAtual += 1;
      }
      meses.push({ ano: anoAtual, mes: mesAtual });
    }

    return meses;
  };

  const salvarReceitaMes = (anoDestino: number, mesDestino: number, valor: number) => {
    return api.put<ReceitaMensal>('/receitas', {
      ano: anoDestino,
      mes: mesDestino,
      valorTotal: valor
    });
  };

  const atualizarReceitaFutura = (valor: number) => {
    if (!propagarReceita) {
      return;
    }

    if (!receitaValida) {
      return;
    }

    const futuros = obterMesesFuturos(ano, mes, mesesPropagar);
    if (futuros.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      futuros.forEach((item) => {
        addToQueue({
          method: 'PUT',
          url: '/receitas',
          data: {
            ano: item.ano,
            mes: item.mes,
            valorTotal: valor
          }
        });
      });
      return;
    }

    Promise.all(futuros.map((item) => salvarReceitaMes(item.ano, item.mes, valor)))
      .catch((error) => {
        console.error('Erro ao atualizar receita nos próximos meses:', error);
        toast.error('Erro ao atualizar receita nos próximos meses.');
      });
  };

  const salvarReceitaComValor = (valorNumerico: number) => {
    if (!navigator.onLine) {
      addToQueue({
        method: 'PUT',
        url: '/receitas',
        data: {
          ano,
          mes,
          valorTotal: valorNumerico
        }
      });

      if (propagarReceita) {
        const futuros = obterMesesFuturos(ano, mes, mesesPropagar);
        futuros.forEach((item) => {
          addToQueue({
            method: 'PUT',
            url: '/receitas',
            data: {
              ano: item.ano,
              mes: item.mes,
              valorTotal: valorNumerico
            }
          });
        });
      }

      setReceitaServidor(valorNumerico);
      setReceitaTotal(formatCurrency(valorNumerico));
      setReceitaExtra('');
      toast.success('Receita salva offline. Será sincronizada ao voltar à internet.');
      return;
    }

    setSalvandoReceita(true);
    const futuros = propagarReceita ? obterMesesFuturos(ano, mes, mesesPropagar) : [];

    Promise.all([
      salvarReceitaMes(ano, mes, valorNumerico),
      ...futuros.map((item) => salvarReceitaMes(item.ano, item.mes, valorNumerico))
    ])
      .then(respostas => {
        const respostaAtual = respostas[0];
        setReceitaServidor(respostaAtual.data.valorTotal);
        setReceitaTotal(formatCurrency(respostaAtual.data.valorTotal));
        setReceitaExtra('');
        toast.success(propagarReceita
          ? 'Receita atualizada e aplicada aos próximos meses.'
          : 'Receita atualizada com sucesso.'
        );
      })
      .catch(error => {
        console.error('Erro ao salvar receita:', error);
        toast.error('Erro ao salvar receita.');
      })
      .finally(() => {
        setSalvandoReceita(false);
      });
  };

  const salvarReceita = () => {
    if (!receitaTotal.trim()) {
      toast.info('Informe a receita antes de salvar.');
      return;
    }

    const valorNumerico = parseCurrencyInput(receitaTotal);
    if (!Number.isFinite(valorNumerico)) {
      toast.error('Informe um valor de receita válido.');
      return;
    }

    if (receitaServidor !== null && valorNumerico === receitaServidor) {
      return;
    }

    salvarReceitaComValor(valorNumerico);
  };

  const somarReceita = () => {
    if (!receitaExtra.trim()) {
      toast.info('Informe um valor para somar.');
      return;
    }

    const valorExtra = receitaExtraNumerica;
    if (!Number.isFinite(valorExtra) || valorExtra <= 0) {
      toast.error('Informe um valor válido para somar.');
      return;
    }

    const base = receitaServidor ?? 0;
    const valorFinal = base + valorExtra;

    salvarReceitaComValor(valorFinal);
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

  const carregarReceita = useCallback(() => {
    setCarregandoReceita(true);
    setReceitaServidor(null);

    if (!navigator.onLine) {
      setReceitaTotal('');
      setCarregandoReceita(false);
      return;
    }

    api.get<ReceitaMensal>(`/receitas?ano=${ano}&mes=${mes}`)
      .then(res => {
        setReceitaServidor(res.data.valorTotal);
        setReceitaTotal(formatCurrency(res.data.valorTotal));
      })
      .catch(error => {
        if (error?.response?.status === 404) {
          setReceitaTotal('');
          return;
        }
        console.error('Erro ao carregar receita:', error);
        toast.error('Erro ao carregar receita.');
      })
      .finally(() => {
        setCarregandoReceita(false);
      });
  }, [ano, mes]);

  useEffect(() => {
    carregarReceita();
  }, [carregarReceita]);

  useEffect(() => {
    const listener = () => {
      console.log('🔁 Esperando para recarregar...');
      setTimeout(() => {
        carregar();
        carregarReceita();
      }, 1000); // aguarda 1 segundo para garantir que a API terminou
    };

    window.addEventListener('sincronizacao-finalizada', listener);
    return () => window.removeEventListener('sincronizacao-finalizada', listener);
  }, [carregar, carregarReceita]);

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
    if (!busca.trim()) {
      setBuscaSemResultado(false);
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
      return;
    }

    const buscarLocal = (dados: Conta[]) => {
      const termo = busca.trim().toLowerCase();
      const resultado = dados.filter(c =>
        c.nome?.toLowerCase().includes(termo)
      );
      setContas(resultado);
      setBuscaSemResultado(resultado.length === 0);
      setBuscando(false);
    };

    setBuscando(true);
    setBuscaSemResultado(false);

    if (!navigator.onLine) {
      const cacheKey = `contas-cache-${ano}-${mes}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        buscarLocal(JSON.parse(cached));
      } else {
        setContas([]);
        setBuscaSemResultado(true);
        setBuscando(false);
      }
      return;
    }

    const delayDebounce = setTimeout(() => {
      api.get<Conta[]>(`/contas/busca?valor=${encodeURIComponent(busca)}&ano=${ano}&mes=${mes}`)
        .then(res => {
          const dados = Array.isArray(res.data) ? res.data : [];
          setContas(dados);
          setBuscaSemResultado(dados.length === 0);
        })
        .catch(err => {
          if (err?.response?.status === 404) {
            setContas([]);
            setBuscaSemResultado(true);
            return;
          }
          console.error('Erro ao buscar contas:', err);
          toast.error('Erro ao buscar contas.');
        })
        .finally(() => {
          setBuscando(false);
        });

    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [busca, ano, mes, carregar]);

  const alternarPagamento = (conta: Conta) => {
    const rota = conta.paga ? 'desmarcar' : 'pagar';
    const valorConta = (conta.valorParcela ?? 0) * (conta.quantidadeParcelas ?? 0);
    const deltaPago = conta.paga ? -valorConta : valorConta;
    const saldoAtual = receitaTotalNumerica - totalPago;
    const saldoNovo = saldoAtual - deltaPago;

    api.put(`/contas/${conta.id}/${rota}`).then(() => {
      setContas(prev =>
        prev.map(c => c.id === conta.id ? { ...c, paga: !c.paga } : c)
      );

      atualizarReceitaFutura(saldoNovo);
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

  const contasFiltradas = contas.filter(conta => {
    if (filtroStatus === 'pagas' && conta.paga !== true) return false;
    if (filtroStatus === 'nao-pagas' && conta.paga !== false) return false;
    if (filtroDiaAtivo) {
      return dayjs(conta.dataVencimento).date() === diaFiltroNumero;
    }
    return true;
  });

  const limparBusca = () => {
    setBusca('');
    setBuscaSemResultado(false);
  };

  const limparFiltroDia = () => {
    setFiltroDia('');
  };

  return (
    <div>
      <div className="topo-sticky">
        <SeletorMesAno ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />
      </div>

      <div className="acao-rapida">
        <button type="button" className="btn-acao" onClick={() => abrirModalConta()}>
          Nova conta
        </button>
      </div>

      <div className="resumo-receita">
        <div className="resumo-header">
          <h2>Receita e Descontos</h2>
          <button type="button" className="btn-outline" onClick={abrirModalReceita}>
            {receitaServidor === null ? 'Adicionar receita' : 'Editar receita'}
          </button>
        </div>

        <div className="resumo-grid">
          <div className="resumo-item">
            <span className="resumo-item-label">Receita total</span>
            <strong className="resumo-item-valor">
              {formatCurrency(receitaTotalNumerica)}
            </strong>
          </div>
          <div className="resumo-item">
            <span className="resumo-item-label">Total descontado (pagas)</span>
            <strong className="resumo-item-valor">
              {formatCurrency(totalPago)}
            </strong>
          </div>
          <div className="resumo-item">
            <span className="resumo-item-label">Saldo da receita</span>
            <strong className={`resumo-item-valor ${saldoReceita < 0 ? 'saldo-negativo' : 'saldo-positivo'}`}>
              {formatCurrency(saldoReceita)}
            </strong>
          </div>
          <div className="resumo-item">
            <span className="resumo-item-label">Total pendente</span>
            <strong className="resumo-item-valor">
              {formatCurrency(totalPendente)}
            </strong>
          </div>
        </div>
      </div>

      <div className="botoes-relatorio">
        <button onClick={gerarPdfFiltrado}>Gerar PDF filtrado</button>
        <button onClick={gerarPdfCompleto}>Gerar PDF completo</button>
      </div>

      <div className="busca-container">
        <div className="busca-input">
          <span className="busca-icon" aria-hidden="true"></span>
          <input
            type="search"
            className="campo-busca"
            placeholder="Buscar contas pelo nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
          />
          {buscaAtiva && (
            <button
              type="button"
              className="busca-limpar"
              onClick={limparBusca}
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>
        <div className="busca-info">
          {buscando && <span className="busca-status">Buscando...</span>}
          {!buscando && buscaAtiva && (
            <span className="busca-status">
              {buscaSemResultado ? 'Nenhuma conta encontrada.' : `${contasFiltradas.length} resultado(s)`}
            </span>
          )}
        </div>
      </div>

      <div className="filtro-container">
        <span className="filtro-titulo">Filtrar por</span>
        <div className="filtro-chips" role="group" aria-label="Filtrar contas">
          {filtrosDisponiveis.map(filtro => (
            <button
              key={filtro.value}
              type="button"
              className={`chip ${filtroStatus === filtro.value ? 'ativa' : ''}`}
              onClick={() => setFiltroStatus(filtro.value)}
              aria-pressed={filtroStatus === filtro.value}
            >
              {filtro.label}
            </button>
          ))}
        </div>
        <div className="filtro-dia">
          <label htmlFor="filtro-dia">Dia do mes</label>
          <div className="filtro-dia-controles">
            <div className="filtro-dia-input">
              <input
                id="filtro-dia"
                type="number"
                min={1}
                max={31}
                step={1}
                inputMode="numeric"
                placeholder="Dia (1-31)"
                value={filtroDia}
                onChange={(e) => setFiltroDia(e.target.value)}
                aria-label="Filtrar por dia do mes"
              />
              {filtroDia.trim() !== '' && (
                <button
                  type="button"
                  className="filtro-dia-limpar"
                  onClick={limparFiltroDia}
                  aria-label="Limpar filtro de dia"
                >
                  Ã—
                </button>
              )}
            </div>
            <button
              type="button"
              className="filtro-dia-hoje"
              onClick={() => setFiltroDia(String(dayjs().date()))}
            >
              Hoje
            </button>
          </div>
          <span className="filtro-dia-ajuda">Filtra pelo dia do vencimento (1-31).</span>
        </div>
      </div>

      {modalContaAberto && (
        <div
          className={`modal-overlay ${modalContaFechando ? 'closing' : ''}`}
          role="dialog"
          aria-modal="true"
          onClick={fecharModalConta}
        >
          <div className={`modal ${modalContaFechando ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{contaEditando ? 'Editar conta' : 'Nova conta'}</h3>
              <button type="button" className="modal-close" onClick={fecharModalConta}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <FormularioNovaConta
                key={formKey}
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
                  fecharModalConta();
                }}
              />
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={fecharModalConta}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalReceitaAberta && (
        <div
          className={`modal-overlay ${modalReceitaFechando ? 'closing' : ''}`}
          role="dialog"
          aria-modal="true"
          onClick={fecharModalReceita}
        >
          <div className={`modal ${modalReceitaFechando ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Receita do mês</h3>
              <button type="button" className="modal-close" onClick={fecharModalReceita}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="resumo-receita receita-modal">
              <label htmlFor="receita-total" className="resumo-label">
                Receita total do mes
              </label>
              <input
                id="receita-total"
                type="text"
                inputMode="decimal"
                value={receitaTotal}
                onChange={(e) => atualizarReceitaTotal(e.target.value)}
                placeholder="R$ 0,00"
                disabled={carregandoReceita}
              />
                <button
                  type="button"
                  className="btn-receita"
                  onClick={salvarReceita}
                  disabled={carregandoReceita || salvandoReceita || !receitaAlterada}
                >
                  {salvandoReceita ? 'Salvando...' : 'Salvar receita'}
                </button>

                <div className="resumo-extra">
                <label htmlFor="receita-extra">Valor extra para somar</label>
                <input
                  id="receita-extra"
                  type="text"
                  inputMode="decimal"
                  value={receitaExtra}
                  onChange={(e) => setReceitaExtra(formatCurrencyInput(e.target.value))}
                  placeholder="R$ 0,00"
                  disabled={carregandoReceita || salvandoReceita}
                />
                  <button
                    type="button"
                    className="btn-receita secundario"
                    onClick={somarReceita}
                    disabled={carregandoReceita || salvandoReceita || !receitaExtraValida}
                  >
                    {salvandoReceita ? 'Salvando...' : 'Somar receita'}
                  </button>
                </div>

                <label className="resumo-checkbox">
                  <input
                    type="checkbox"
                    checked={propagarReceita}
                    onChange={(e) => atualizarPropagacao(e.target.checked)}
                    disabled={carregandoReceita || salvandoReceita}
                  />
                  Aplicar para os próximos {mesesPropagar} meses
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={fecharModalReceita}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ul className="lista">
        {contasFiltradas.map(conta => {
            const vencida = isVencida(conta);
            const statusClasse = conta.paga ? 'paga' : vencida ? 'vencida' : 'nao-paga';
            const statusLabel = conta.paga ? 'Paga' : vencida ? 'Vencida' : 'Em aberto';
            const totalParcelas = (conta.totalParcelas && conta.totalParcelas > 0)
              ? conta.totalParcelas
              : (conta.quantidadeParcelas ?? 1);
            const indiceParcela = (conta.indiceParcela && conta.indiceParcela > 0)
              ? conta.indiceParcela
              : 1;
            const totalConta = (conta.valorParcela ?? 0) * totalParcelas;
            const calculoDetalhado = `${formatCurrency(conta.valorParcela ?? 0)} x ${totalParcelas} = ${formatCurrency(totalConta)}`;
            const mostrarQtd = totalParcelas > 1;

            return (
              <motion.li
                key={conta.id}
                className={statusClasse}
              >
                <div className="conta-topo">
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
                  <span className={`status-pill ${statusClasse}`}>{statusLabel}</span>
                </div>
                <div className="conta-detalhes">
                  <span>Venc.: {dayjs(conta.dataVencimento).format('DD/MM/YYYY')}</span>
                  <span>Parcela: {formatCurrency(conta.valorParcela ?? 0)}</span>
                  {mostrarQtd && (
                    <span>Qtd: <small>({indiceParcela}/{totalParcelas})</small></span>
                  )}
                  <span className="conta-total">
                    {mostrarQtd ? 'Total do contrato' : 'Total'}: {formatCurrency(totalConta)}
                    {mostrarQtd && (
                      <span
                        className="info-tooltip"
                        title={calculoDetalhado}
                        aria-label={`Calculo: ${calculoDetalhado}`}
                      >
                        i
                      </span>
                    )}
                  </span>
                  {mostrarQtd && (
                    <span className="info-tooltip-detail">
                      {calculoDetalhado}
                    </span>
                  )}
                </div>
                <div className="conta-acoes">
                  <button
                    className={conta.paga ? 'desmarcar' : 'pagar'}
                    onClick={() => alternarPagamento(conta)}
                  >
                    {conta.paga ? <><FaUndo /> Desmarcar</> : <><FaCheck /> Pagar</>}
                  </button>

                  <button className='editar' onClick={() => abrirModalConta(conta)}>
                    <FaEdit /> Editar
                  </button>

                  <button className="remover" onClick={() => remover(conta.id)}>
                    <FaTrash /> Remover
                  </button>

                </div>
              </motion.li>
            );
          })}
      </ul>

      {contasFiltradas.length === 0 && !buscando && (
        <div className="estado-vazio">
          {buscaAtiva ? 'Nenhuma conta encontrada para esta busca.' : 'Nenhuma conta encontrada para este mes.'}
        </div>
      )}

      <div className="total-mes">
        Total do mes: {formatCurrency(totalMes)}
      </div>

      <GraficoTotais ano={ano} atualizar={atualizacaoGrafico} />

    </div>
  );
};

export default ListaContas;


