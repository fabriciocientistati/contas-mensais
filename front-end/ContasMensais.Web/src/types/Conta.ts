export interface Conta {
  id: string;
  nome: string;
  ano: number;
  mes: number;
  paga: boolean;
  dataVencimento: string; //Formato ISO: "2025-06-10"
  valorParcela: number;
  quantidadeParcelas: number;
  valorTotal: number;
  contaParaEditar?: Conta | null;
  onContasSalvas: (contas: Conta[]) => void;
  indiceParcela: number;
  totalParcelas: number;
}
