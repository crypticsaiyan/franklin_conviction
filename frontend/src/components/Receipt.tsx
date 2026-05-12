import { motion } from 'framer-motion';
import type { CostEntry } from '../types';
import styles from './Receipt.module.css';

interface Props {
  token: string;
  breakdown: CostEntry[];
  totalCost: number;
  totalGpt4Cost: number;
  totalSavings: number;
  escalated: boolean;
  convictionScore: number;
}

function fmtUsd(v: number): string {
  if (v === 0) return '$0.000000';
  if (v >= 1)    return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function rpad(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

export function Receipt({
  token,
  breakdown,
  totalCost,
  totalGpt4Cost,
  totalSavings,
  escalated,
  convictionScore,
}: Props) {
  const pct = totalGpt4Cost > 0
    ? Math.round((totalSavings / totalGpt4Cost) * 100)
    : 0;
  const now = new Date();
  const ts = `${now.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
  const txId = `0x${Math.random().toString(16).slice(2, 18).toUpperCase()}`;

  /* line items — each animated in sequentially via stagger */
  const lines: Array<{ id: string; node: React.ReactNode; emphasized?: boolean }> = [];

  // header lines
  lines.push({ id: 'h1', node: <span className={styles.center}>FRANKLIN CONVICTION ENGINE</span> });
  lines.push({ id: 'h2', node: <span className={styles.center}>x402 // BLOCKRUN.AI // BASE</span> });
  lines.push({ id: 'h3', node: <span className={styles.thinRule}>{'='.repeat(42)}</span> });
  lines.push({ id: 'h4', node: <span>{pad('TXN ID', 12)}{txId}</span> });
  lines.push({ id: 'h5', node: <span>{pad('DATE', 12)}{ts}</span> });
  lines.push({ id: 'h6', node: <span>{pad('TARGET', 12)}<span className={styles.bright}>{token.toUpperCase()}</span></span> });
  lines.push({ id: 'h7', node: <span className={styles.thinRule}>{'-'.repeat(42)}</span> });
  lines.push({ id: 'h8', node: <span className={styles.dim}>{pad('AGENT', 11)}{pad('TIER', 7)}{pad('TOK', 7)}{rpad('COST', 11)}</span> });
  lines.push({ id: 'h9', node: <span className={styles.thinRule}>{'-'.repeat(42)}</span> });

  // tier abbreviation map
  const TIER_ABBR: Record<string, string> = { SIMPLE: 'SI', MEDIUM: 'ME', COMPLEX: 'CO', REASONING: 'RE' };

  // each agent line
  breakdown.forEach((entry, i) => {
    const totalTok = entry.tokensIn + entry.tokensOut;
    const tier = entry.routingTier ? (TIER_ABBR[entry.routingTier] ?? entry.routingTier.slice(0, 2)) : '--';
    lines.push({
      id: `a${i}`,
      node: (
        <span>
          {pad(entry.agent.toUpperCase().slice(0, 10), 11)}
          {pad(tier, 7)}
          {pad(String(totalTok), 7)}
          <span className={styles.cost}>{rpad(fmtUsd(entry.costUsd), 11)}</span>
        </span>
      ),
    });
  });

  lines.push({ id: 'm1', node: <span className={styles.thinRule}>{'-'.repeat(42)}</span> });
  lines.push({
    id: 's1',
    node: (
      <span>
        {pad('SUBTOTAL', 22)}
        <span className={styles.cost}>{rpad(fmtUsd(totalCost), 12)}</span>
      </span>
    ),
  });
  lines.push({
    id: 's2',
    node: (
      <span className={styles.dim}>
        {pad('GPT-4 EQV', 22)}
        <span className={styles.strike}>{rpad(fmtUsd(totalGpt4Cost), 12)}</span>
      </span>
    ),
  });
  lines.push({
    id: 's3',
    node: (
      <span className={styles.green}>
        {pad('SAVED', 22)}
        {rpad(fmtUsd(totalSavings), 12)}
      </span>
    ),
  });
  lines.push({ id: 'm2', node: <span className={styles.thinRule}>{'='.repeat(42)}</span> });
  lines.push({
    id: 'big',
    emphasized: true,
    node: (
      <span className={styles.bigSavings}>
        <span className={styles.bigPct}>{pct}%</span>
        <span className={styles.bigLabel}>SAVINGS vs GPT-4</span>
      </span>
    ),
  });
  lines.push({ id: 'm3', node: <span className={styles.thinRule}>{'='.repeat(42)}</span> });
  lines.push({
    id: 'v1',
    node: (
      <span>
        {pad('CONVICTION', 22)}
        <span className={styles.bright}>{rpad(`${convictionScore}/100`, 12)}</span>
      </span>
    ),
  });
  if (escalated) {
    lines.push({
      id: 'v2',
      node: <span className={styles.magenta}>⊳ CLAUDE_SONNET_ARBITRATED</span>,
    });
  }
  lines.push({ id: 'f1', node: <span className={styles.thinRule}>{'-'.repeat(42)}</span> });
  lines.push({ id: 'f2', node: <span className={styles.center}>// THANK YOU FOR DEPLOYING CAPITAL //</span> });
  lines.push({ id: 'f3', node: <span className={styles.center + ' ' + styles.dim}>not financial advice</span> });
  lines.push({ id: 'f4', node: <span className={styles.center + ' ' + styles.dim}>signed by 7 agents</span> });

  return (
    <div className={styles.wrap}>
      <header className={styles.label}>
        <span>// THERMAL_RECEIPT</span>
        <span className={styles.labelDim}>x402-{txId.slice(0, 8)}</span>
      </header>

      <motion.div
        className={styles.paper}
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)' }}
        transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
      >
        {/* perforated top edge */}
        <span className={styles.perforation} />

        {/* paper grain overlay */}
        <span className={styles.grain} aria-hidden />

        <div className={styles.inner}>
          {lines.map((line, i) => (
            <motion.div
              key={line.id}
              className={`${styles.line} ${line.emphasized ? styles.lineEmph : ''}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.18,
                delay: 0.4 + i * 0.06,
                ease: 'linear',
              }}
            >
              {line.node}
            </motion.div>
          ))}
        </div>

        {/* perforated tear-off bottom edge */}
        <span className={styles.tearLine} />
      </motion.div>
    </div>
  );
}
