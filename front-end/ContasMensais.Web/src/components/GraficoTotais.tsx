import { useEffect, useState } from "react";
import api from "../services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Conta } from '../types/Conta';

interface Props {
    ano: number;
    atualizar: number;
}

const meses = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const GraficoTotais = ({ ano, atualizar }: Props) => {
    const [dados, setDados] = useState<{mes: string; total: number }[]>([]);

    useEffect(() => {
        //Buscar todos os meses do ano
        Promise.all(
            Array.from({ length: 12 }, (_, i) => 
                api.get<Conta[]>(`/contas?ano=${ano}&mes=${i + 1}`)
            )
        ).then(respostas => {
            const totais = respostas.map((res, index) => {
                const total = res.data.reduce(
                    (soma, conta) => soma + conta.valorParcela * conta.quantidadeParcelas,
                    0
                );
                return { mes: meses[index], total: parseFloat(total.toFixed(2))};
            });
            setDados(totais);
        });
    }, [ano, atualizar]);

    return (
        
    <div className="grafico-container">
        <h2>Total por Mês - {ano}</h2>
        <ResponsiveContainer width="100%" height={300}>
        <BarChart
            data={dados}
            style={{ backgroundColor: '#1f2937' }}
            margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
        >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="mes" stroke="#f9fafb" />
            <YAxis stroke="#f9fafb" />
            <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: 'none', color: '#f3f4f6' }}
            labelStyle={{ color: '#93c5fd' }}
            />
            <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
        </ResponsiveContainer>
        </div>
    );
};

export default GraficoTotais;