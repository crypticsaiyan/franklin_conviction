import type { MarketData } from '../types';
import styles from './MarketDataBar.module.css';

interface Props {
  data: MarketData | null;
}

export function MarketDataBar({ data }: Props) {
  if (!data) return null;

  const priceStr = data.price >= 1
    ? data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : data.price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });

  return (
    <div className={styles.bar}>
      <span className={styles.label}>// LIVE_MARKET</span>
      <span className={styles.divider}>·</span>
      <span className={styles.symbol}>{data.symbol}</span>
      <span className={styles.price}>${priceStr}</span>
      <span className={styles.divider}>·</span>
      <span className={styles.source}>via {data.source ?? 'pyth'}</span>
      <span className={styles.pulse} />
    </div>
  );
}
