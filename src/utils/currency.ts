export const EXCHANGE_RATE = 4100; // Standard exchange rate for Riel

export const formatUSD = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatKHR = (amount: number) => {
  const rielAmount = amount * EXCHANGE_RATE;
  return new Intl.NumberFormat('km-KH', {
    style: 'currency',
    currency: 'KHR',
    maximumFractionDigits: 0,
  }).format(rielAmount);
};

export const formatDualCurrency = (amount: number) => {
  return `${formatUSD(amount)} / ${formatKHR(amount)}`;
};
