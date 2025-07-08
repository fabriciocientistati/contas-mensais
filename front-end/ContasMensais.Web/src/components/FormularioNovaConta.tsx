import { toast } from 'react-toastify';
import { useEffect, useState } from 'react';
import api from '../services/api';
import type { Conta } from '../types/Conta';

interface Props {
  ano: number;
  mes: number;
  contaParaEditar?: Conta | null;
  onContaSalva: (conta: Conta) => void;
}

const hoje = new Date();
const dia = String(hoje.getDate()).padStart(2, '0');
const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
const anoAtual = hoje.getFullYear();
const dataFormatada = `${anoAtual}-${mesAtual}-${dia}`; // formato YYYY-MM-DD para input[type="date"]

const FormularioNovaConta = ({ ano, mes, contaParaEditar, onContaSalva }: Props) => {
  const [nome, setNome] = useState('');
  const [dataVencimento, setDataVencimento] = useState(dataFormatada);
  const [valorParcela, setValorParcela] = useState('');
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('1');

  useEffect(() => {
    if (contaParaEditar) {
      setNome(contaParaEditar.nome);
      setDataVencimento(contaParaEditar.dataVencimento.split('T')[0]);
      setValorParcela(contaParaEditar.valorParcela.toString());
      setQuantidadeParcelas(contaParaEditar.quantidadeParcelas.toString());
    }
  }, [contaParaEditar]);

  const salvar = async () => {
    if (!nome.trim() || !valorParcela || !quantidadeParcelas) {
      toast.warn('Preencha todos os campos obrigatórios.');
      return;
    }

    const payload = {
      nome,
      ano,
      mes,
      paga: contaParaEditar?.paga ?? false,
      dataVencimento,
      valorParcela: parseFloat(valorParcela),
      quantidadeParcelas: parseInt(quantidadeParcelas),
    };

    try {
      const res = contaParaEditar
        ? await api.put<Conta>(`/contas/${contaParaEditar.id}`, payload)
        : await api.post<Conta>('/contas', payload);

      onContaSalva(res.data);
      resetarFormulario();

      toast.success(
        contaParaEditar
          ? 'Conta atualizada com sucesso!'
          : 'Conta adicionada com sucesso!'
      );
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar a conta. Tente novamente.');
    }
  };

  const resetarFormulario = () => {
    setNome('');
    setDataVencimento(dataFormatada);
    setValorParcela('');
    setQuantidadeParcelas('1');
  };

  return (
    <div className='formulario'>
      <input
        type='text'
        placeholder='Digite o nome da conta...'
        value={nome}
        onChange={e => setNome(e.target.value)}
      />
      <input
        type='date'
        value={dataVencimento}
        onChange={e => setDataVencimento(e.target.value)}
      />
      <input
        type='number'
        placeholder='Digite o valor da parcela...'
        value={valorParcela}
        onChange={e => setValorParcela(e.target.value)}
        step='0.01'
      />
      <input
        type='number'
        placeholder='Digite a quantidade de parcelas...'
        value={quantidadeParcelas}
        onChange={e => setQuantidadeParcelas(e.target.value)}
      />
      <button onClick={salvar}>
        {contaParaEditar ? 'Salvar alterações' : 'Salvar'}
      </button>
    </div>
  );
};

export default FormularioNovaConta;
