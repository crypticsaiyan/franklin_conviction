import { motion } from 'framer-motion';
import { renderMd } from '../renderMd';
import styles from './InvestmentMemo.module.css';

interface Props {
  memo: string;
  escalated: boolean;
  escalationReason?: string;
  entryZone?: string;
  stopLoss?: string;
  positionSize?: string;
  timeHorizon?: string;
}

function TradeRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={styles.tradeRow}>
      <span className={styles.tradeLabel}>{label}</span>
      <span className={styles.tradeValue} style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function TradeCard({ entryZone, stopLoss, positionSize, timeHorizon }: {
  entryZone?: string; stopLoss?: string; positionSize?: string; timeHorizon?: string;
}) {
  if (!entryZone && !stopLoss && !positionSize && !timeHorizon) return null;
  return (
    <motion.div
      className={styles.tradeCard}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.tradeHeader}>// TRADE_PARAMETERS</div>
      <div className={styles.tradeGrid}>
        {entryZone    && <TradeRow label="ENTRY_ZONE"  value={entryZone} accent="var(--neon-green)" />}
        {stopLoss     && <TradeRow label="STOP_LOSS"   value={stopLoss}  accent="var(--neon-red)" />}
        {positionSize && <TradeRow label="POSITION"    value={positionSize} />}
        {timeHorizon  && <TradeRow label="HORIZON"     value={timeHorizon} />}
      </div>
    </motion.div>
  );
}

export function InvestmentMemo({ memo, escalated, escalationReason, entryZone, stopLoss, positionSize, timeHorizon }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.bullet} />
          // INVESTMENT_MEMO
        </h2>
        {escalated && (
          <span className={styles.escalatedTag}>
            ⊳ CLAUDE_ARBITRATED
          </span>
        )}
      </div>
      {escalated && escalationReason && (
        <div className={styles.escalationNote}>
          <strong>NOTE:</strong> {escalationReason}
        </div>
      )}
      <div className={styles.memo}>{renderMd(memo)}</div>
      <TradeCard
        entryZone={entryZone}
        stopLoss={stopLoss}
        positionSize={positionSize}
        timeHorizon={timeHorizon}
      />
    </div>
  );
}
