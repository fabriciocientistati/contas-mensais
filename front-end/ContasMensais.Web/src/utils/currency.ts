const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

export const formatCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const number = Number(digits) / 100;
  return formatCurrency(number);
};

export const parseCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
};
