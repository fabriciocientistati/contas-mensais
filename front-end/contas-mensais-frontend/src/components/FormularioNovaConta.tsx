import React, { useState } from 'react';
import api from '../services/api';
import type { Conta } from '../types/Conta';

interface Props {
  ano: number;
  mes: number;
  onContaAdicionada: (conta: Conta) => void;
}

const FormularioNovaConta = ({ ano, mes, onContaAdicionada }: Props) => {
  const [nome, setNome] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [valorParcela, setvalorParcela] = useState('');
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('');

  const adicionar = () => {
    if (!nome.trim() || !valorParcela) {
      alert('Campo nome ou valor da parcela são invalidos.')
      return;
    } 

    api.post<Conta>('/contas', {
      nome,
      ano,
      mes,
      paga: false,
      dataVencimento,
      valorParcela: parseFloat(valorParcela),
      quantidadeParcelas: parseInt(quantidadeParcelas),
    }).then(res => {
      onContaAdicionada(res.data);
      setNome('');
      setDataVencimento('');
      setQuantidadeParcelas('');
    });
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
        onChange={(e => setvalorParcela(e.target.value))}
        step={"0.01"}
      />
      <input
        type='number'
        placeholder='Digite a quantidade de parcelas...'
        value={quantidadeParcelas}
        onChange={e => setQuantidadeParcelas(e.target.value)}
      />
      <button onClick={adicionar}>Adicionar</button>
    </div>
  );
};

export default FormularioNovaConta;
