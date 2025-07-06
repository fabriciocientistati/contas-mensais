interface Props {
  ano: number;
  mes: number;
  onChange: (ano: number, mes: number) => void;
}

const SeletorMesAno = ({ ano, mes, onChange }: Props) => {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="seletor">
      <select value={mes} onChange={e => onChange(ano, parseInt(e.target.value))}>
        {meses.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
      <input type="number" value={ano} onChange={e => onChange(parseInt(e.target.value), mes)} />
    </div>
  );
};

export default SeletorMesAno;
