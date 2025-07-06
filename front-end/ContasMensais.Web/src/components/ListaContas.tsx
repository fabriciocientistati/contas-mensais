import { useEffect, useState } from 'react';
import api from '../services/api';
import type { Conta } from '../types/Conta';
import FormularioNovaConta from './FormularioNovaConta';
import SeletorMesAno from './SeletorMesAno';
import { FaTrash, FaCheck, FaUndo } from 'react-icons/fa';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import GraficoTotais from './GraficoTotais';

const ListaContas = () => {
  const [contas, setContas] = useState<Conta[]>([]);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [atualizacaoGrafico , setAtualizacaoGrafico] = useState(0);

const totalMes = contas.length
  ? contas.reduce((total, conta) =>
      total + (conta.valorParcela ?? 0) * (conta.quantidadeParcelas ?? 0), 0)
  : 0;

  const carregar = () => {
    api.get<Conta[]>(`/contas?ano=${ano}&mes=${mes}`)
      .then(res => {
        console.log('Contas recebidas:', res.data);
        const dados = res.data;
        // Protege contra respostas inválidas, mesmo que raras
        const contasSeguras = Array.isArray(dados) ? dados : [];
        setContas(contasSeguras);
      })
      .catch(err => {
        console.error('Erro ao buscar contas:', err);
        setContas([]); // Garante que nunca passe valor indefinido
      });
  };

  useEffect(() => {
    carregar();
    console.log('Buscando contas para:', ano, mes);
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
    api.delete(`/contas/${id}`).then(() => {
      setContas(prev => prev.filter(c => c.id !== id));
      setAtualizacaoGrafico(prev => prev + 1);
    });
  };

  const adicionarConta = (nova: Conta) => {
    setContas(prev => [...prev, nova]);
    setAtualizacaoGrafico(prev => prev + 1); //Força atualização do gráfico
  };

  return (
    <div>
      <SeletorMesAno ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />
      <FormularioNovaConta ano={ano} mes={mes} onContaAdicionada={adicionarConta} />
      <ul className="lista">
        {contas.map(conta => (
        <motion.li key={conta.id} className={conta.paga ? 'paga' : ''}>
          <span className='nome-conta'>{conta.nome}</span>
          <span>Venc.: {dayjs(conta.dataVencimento).format('DD/MM/YYYY')}</span>  
          <span>Parcela: R$ {conta.valorParcela.toFixed(2)}</span>
          <span>Qtd: {conta.quantidadeParcelas}</span>
          <span>Total: R$ {conta.valorTotal.toFixed(2)}</span>
          <div>
            <button
              className={conta.paga ? 'desmarcar' : 'pagar'}
              onClick={() => alternarPagamento(conta)}
            >
              {conta.paga ? <><FaUndo /> Desmarcar</> : <><FaCheck /> Pagar</>}
            </button>

            <button className="remover" onClick={() => remover(conta.id)}>
              <FaTrash /> Remover
            </button>
          </div>
        </motion.li>
        ))}
      </ul>
      <div className="total-mes">
        Total do mês: R$ {totalMes.toFixed(2)}
      </div>
      
      <GraficoTotais ano={ano} atualizar={atualizacaoGrafico} />

    </div>
  );
};

export default ListaContas;
