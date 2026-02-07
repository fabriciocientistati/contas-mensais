import { toast } from 'react-toastify';
import { addToQueue } from '../utils/offlineQueue';
import { useEffect, useState } from 'react';
import api from '../services/api';
import type { Conta } from '../types/Conta';
import { handleApiError } from '../utils/handleApiError';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '../utils/currency';

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
  const [valorParcela, setValorParcela] = useState('');
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('1');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const valorParcelaNumerico = parseCurrencyInput(valorParcela);
  const quantidadeParcelasNumerico = parseInt(quantidadeParcelas);
  const parcelasNumero = Number.parseInt(quantidadeParcelas, 10);
  const parcelasAtual = Number.isFinite(parcelasNumero) ? parcelasNumero : 1;
  const maxParcelas = 60;

  useEffect(() => {
    if (contaParaEditar) {
      setNome(contaParaEditar.nome);
      setDataVencimento(contaParaEditar.dataVencimento.split('T')[0]);
      setValorParcela(formatCurrency(contaParaEditar.valorParcela));
      setQuantidadeParcelas(contaParaEditar.totalParcelas?.toString() ?? contaParaEditar.quantidadeParcelas.toString());
      setErrors({});
    }
  }, [contaParaEditar]);

  const salvar = async () => {
  if (
    !valorParcela.trim()
    || !Number.isFinite(valorParcelaNumerico)
    || valorParcelaNumerico <= 0
    || !Number.isFinite(quantidadeParcelasNumerico)
    || quantidadeParcelasNumerico < 1
  ) {
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
    if (navigator.onLine) {
      if (contaParaEditar) {
        const res = await api.put<Conta>(`/contas/${contaParaEditar.id}`, payload);
        onContasSalvas([res.data]);
      } else {
        const res = await api.post<Conta[]>('/contas', payload);
        onContasSalvas(res.data);
      }

      toast.success(
        contaParaEditar
          ? 'Conta atualizada com sucesso!'
          : 'Conta(s) adicionada(s) com sucesso!'
      );
    } else {
      addToQueue({
        method: contaParaEditar ? 'PUT' : 'POST',
        url: contaParaEditar ? `/contas/${contaParaEditar.id}` : '/contas',
        data: payload
      });

      toast.success('Conta salva offline. Será sincronizada ao voltar à internet.');
    }

    resetarFormulario();
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

  const atualizarParcelas = (valor: string) => {
    setQuantidadeParcelas(valor);
    setErrors(prev => ({ ...prev, QuantidadeParcelas: [] }));
  };

  return (
    <div className='formulario'>
      <div className="campo">
        <label htmlFor="conta-nome">Nome da conta</label>
        <input
          id="conta-nome"
          className="campo-input"
          type='text'
          placeholder='Ex.: Energia, Internet...'
          value={nome}
          onChange={e => {
            setNome(e.target.value);
            setErrors(prev => ({ ...prev, Nome: [] }));
          }}
          style={{ borderColor: errors.Nome ? 'var(--danger)' : undefined }}
          aria-invalid={Boolean(errors.Nome?.length)}
        />
        {errors.Nome?.map((msg, i) => (
          <small key={i} className="campo-erro">{msg}</small>
        ))}
        <small className="campo-ajuda">Ex.: Energia, Internet, Cartao.</small>
      </div>

      <div className="campo">
        <label htmlFor="conta-vencimento">Vencimento</label>
        <input
          id="conta-vencimento"
          className="campo-input"
          type='date'
          value={dataVencimento}
          onChange={e => {
            setDataVencimento(e.target.value);
            setErrors(prev => ({ ...prev, DataVencimento: [] }));
          }}
          style={{ borderColor: errors.DataVencimento ? 'var(--danger)' : undefined }}
          aria-invalid={Boolean(errors.DataVencimento?.length)}
        />
        {errors.DataVencimento?.map((msg, i) => (
          <small key={i} className="campo-erro">{msg}</small>
        ))}
        <small className="campo-ajuda">Data de vencimento da parcela.</small>
      </div>

      <div className="campos-linha">
        <div className="campo">
          <label htmlFor="conta-valor">Valor da parcela</label>
          <input
            id="conta-valor"
            className="campo-input"
            type='text'
            placeholder='R$ 0,00'
            value={valorParcela}
            onChange={e => {
              setValorParcela(formatCurrencyInput(e.target.value));
              setErrors(prev => ({ ...prev, ValorParcela: [] }));
            }}
            inputMode='decimal'
            style={{ borderColor: errors.ValorParcela ? 'var(--danger)' : undefined }}
            aria-invalid={Boolean(errors.ValorParcela?.length)}
          />
          {errors.ValorParcela?.map((msg, i) => (
            <small key={i} className="campo-erro">{msg}</small>
          ))}
          <small className="campo-ajuda">Valor de cada parcela.</small>
        </div>

        <div className="campo">
          <label htmlFor="conta-parcelas">Quantidade de parcelas</label>
          <div className="slider-wrap">
            <input
              id="conta-parcelas"
              className="slider"
              type="range"
              min="1"
              max={maxParcelas}
              step="1"
              value={parcelasAtual}
              onChange={e => atualizarParcelas(e.target.value)}
              aria-invalid={Boolean(errors.QuantidadeParcelas?.length)}
            />
            <div className="slider-value">{parcelasAtual}x</div>
          </div>
          {errors.QuantidadeParcelas?.map((msg, i) => (
            <small key={i} className="campo-erro">{msg}</small>
          ))}
          <small className="campo-ajuda">Arraste para escolher. 1 = a vista.</small>
        </div>
      </div>

      <button onClick={salvar}>
        {contaParaEditar ? 'Salvar alteracoes' : 'Salvar'}
      </button>
    </div>
  );
};

export default FormularioNovaConta;

