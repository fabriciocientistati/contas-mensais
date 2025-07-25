import { toast } from 'react-toastify';
import { useEffect, useState } from 'react';
import api from '../services/api';
import type { Conta } from '../types/Conta';
import { handleApiError } from '../utils/handleApiError';

interface Props {
  ano: number;
  mes: number;
  contaParaEditar?: Conta | null;
  onContasSalvas: (contas: Conta[]) => void;
}

const hoje = new Date();
const dia = String(hoje.getDate()).padStart(2, '0');
const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
const anoAtual = hoje.getFullYear();
const dataFormatada = `${anoAtual}-${mesAtual}-${dia}`;

const FormularioNovaConta = ({ ano, mes, contaParaEditar, onContasSalvas }: Props) => {
  const [nome, setNome] = useState('');
  const [dataVencimento, setDataVencimento] = useState(dataFormatada);
  const [valorParcela, setValorParcela] = useState('0');
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('1');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const valorParcelaNumerico = parseFloat(valorParcela);
  const quantidadeParcelasNumerico = parseInt(quantidadeParcelas);

  useEffect(() => {
    if (contaParaEditar) {
      setNome(contaParaEditar.nome);
      setDataVencimento(contaParaEditar.dataVencimento.split('T')[0]);
      setValorParcela(contaParaEditar.valorParcela.toString());
      setQuantidadeParcelas(contaParaEditar.quantidadeParcelas.toString());
      setErrors({});
    }
  }, [contaParaEditar]);

  const salvar = async () => {
    if (isNaN(valorParcelaNumerico) || isNaN(quantidadeParcelasNumerico)) {
      toast.error('Valor da parcela e quantidade de parcelas devem ser números válidos.');
      return;
    }

    const payload = {
      nome,
      ano,
      mes,
      paga: contaParaEditar?.paga ?? false,
      dataVencimento,
      valorParcela: valorParcelaNumerico,
      quantidadeParcelas: quantidadeParcelasNumerico,
    };

    try {
      if (contaParaEditar) {
        const res = await api.put<Conta>(`/contas/${contaParaEditar.id}`, payload);
        onContasSalvas([res.data]); // envia como lista
      } else {
        const res = await api.post<Conta[]>('/contas', payload);
        onContasSalvas(res.data);
      }

      resetarFormulario();

      toast.success(
        contaParaEditar
          ? 'Conta atualizada com sucesso!'
          : 'Conta(s) adicionada(s) com sucesso!'
      );
    } catch (err: any) {
      handleApiError(err, setErrors);
    }
  };

  const resetarFormulario = () => {
    setNome('');
    setDataVencimento(dataFormatada);
    setValorParcela('');
    setQuantidadeParcelas('1');
    setErrors({});
  };

  return (
    <div className='formulario'>
      <input
        type='text'
        placeholder='Digite o nome da conta...'
        value={nome}
        onChange={e => {
          setNome(e.target.value);
          setErrors(prev => ({ ...prev, Nome: [] }));
        }}
        style={{ borderColor: errors.Nome ? 'red' : undefined }}
      />
      {errors.Nome?.map((msg, i) => (
        <small key={i} style={{ color: 'red' }}>{msg}</small>
      ))}

      <input
        type='date'
        value={dataVencimento}
        onChange={e => {
          setDataVencimento(e.target.value);
          setErrors(prev => ({ ...prev, DataVencimento: [] }));
        }}
        style={{ borderColor: errors.DataVencimento ? 'red' : undefined }}
      />
      {errors.DataVencimento?.map((msg, i) => (
        <small key={i} style={{ color: 'red' }}>{msg}</small>
      ))}

      <input
        type='number'
        placeholder='Digite o valor da parcela...'
        value={valorParcela}
        onChange={e => {
          setValorParcela(e.target.value);
          setErrors(prev => ({ ...prev, ValorParcela: [] }));
        }}
        step='0.01'
        style={{ borderColor: errors.ValorParcela ? 'red' : undefined }}
      />
      {errors.ValorParcela?.map((msg, i) => (
        <small key={i} style={{ color: 'red' }}>{msg}</small>
      ))}

      <input
        type='number'
        placeholder='Digite a quantidade de parcelas...'
        value={quantidadeParcelas}
        onChange={e => {
          setQuantidadeParcelas(e.target.value);
          setErrors(prev => ({ ...prev, QuantidadeParcelas: [] }));
        }}
        style={{ borderColor: errors.QuantidadeParcelas ? 'red' : undefined }}
      />
      {errors.QuantidadeParcelas?.map((msg, i) => (
        <small key={i} style={{ color: 'red' }}>{msg}</small>
      ))}

      <button onClick={salvar}>
        {contaParaEditar ? 'Salvar alterações' : 'Salvar'}
      </button>
    </div>
  );
};

export default FormularioNovaConta;
