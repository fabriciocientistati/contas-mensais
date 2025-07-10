import { useEffect, useState } from 'react';
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

  const totalMes = contas.length
    ? contas.reduce((total, conta) =>
        total + (conta.valorParcela ?? 0) * (conta.quantidadeParcelas ?? 0), 0)
    : 0;

  const carregar = () => {
    api.get<Conta[]>(`/contas?ano=${ano}&mes=${mes}`)
      .then(res => {
        const dados = res.data;
        const contasSeguras = Array.isArray(dados) ? dados : [];
        setContas(contasSeguras);
      })
      .catch(err => {
        console.error('Erro ao buscar contas:', err);
        setContas([]);
      });
  };

  const buscarContas = () => {
    if (!busca.trim()) {
      carregar();
      return;
    }
  

  api.get<Conta[]>(`/contas/busca?valor=${encodeURIComponent(busca)}`)
    .then(res => {
      setContas(res.data);
    })
    .catch(err => {
      toast.error('Nenhuma conta encontrada.');
      setContas([]);
      console.error('Erro ao buscar contas:', err);
    })
  }
  
  useEffect(() => {
    carregar();
  }, [ano, mes]);

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

  const salvarConta = (conta: Conta) => {
    setContaEditando(null);
    setContas(prev => {
      const semConta = prev.filter(c => c.id !== conta.id); // remove se já existir
      return [conta, ...semConta]; // adiciona no topo
    });
    setAtualizacaoGrafico(prev => prev + 1);
  };

  return (
    <div>
      <SeletorMesAno ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />
      <FormularioNovaConta
        ano={ano}
        mes={mes}
        contaParaEditar={contaEditando}
        onContaSalva={salvarConta}
      />

      <div className="filtro-status" style={{ margin: '10px 0' }}>
        <label htmlFor="filtro" style={{ marginRight: '8px' }}>Filtrar por:</label>
        <select
          id="filtro"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as 'todas' | 'pagas' | 'nao-pagas')}
        >
          <option value="todas">Todas</option>
          <option value="pagas">Pagas</option>
          <option value="nao-pagas">Não pagas</option>
        </select>
      </div>

      <div style={{ margin: '10px 0' }}>
        <input
          type="text"
          placeholder="Buscar contas pelo nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ padding: '6px', width: '300px', marginRight: '8px' }}
        />
        <button onClick={buscarContas} style={{ padding: '6px 12px' }}>
          Buscar
        </button>
      </div>

      <ul className="lista">
        {contas
          .filter(conta => {
            if (filtroStatus === 'pagas') return conta.paga === true;
            if (filtroStatus === 'nao-pagas') return conta.paga === false;
            return true;
          })
          .map(conta => (
            <motion.li key={conta.id} className={conta.paga ? 'paga' : ''}>
              <span className='nome-conta'>{conta.nome}</span>
              <span>Venc.: {dayjs(conta.dataVencimento).format('DD/MM/YYYY')}</span>
              <span>Parcela: {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(conta.valorParcela)}</span>
              <span>Qtd: {conta.quantidadeParcelas}</span>
              <span>Total: {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(conta.valorTotal)}</span>
              <div>
                <button
                  className={conta.paga ? 'desmarcar' : 'pagar'}
                  onClick={() => alternarPagamento(conta)}
                >
                  {conta.paga ? <><FaUndo /> Desmarcar</> : <><FaCheck /> Pagar</>}
                </button>

                <button onClick={() => setContaEditando(conta)}>
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
