export const calculateSplit = (rate: number, type: 'bw' | 'color') => {
  const base = type === 'bw' ? 2 : 5;
  const markup = Math.max(0, rate - base);
  
  if (markup === 0) return { fee: 0, profit: 0 };

  const platformFee = markup * 0.20; // 20% of the extra profit
  const runnerProfit = markup - platformFee;

  return {
    fee: platformFee.toFixed(2),
    profit: runnerProfit.toFixed(2)
  };
};
