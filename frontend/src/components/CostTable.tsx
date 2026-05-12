import type { CostEntry } from '../types';
import styles from './CostTable.module.css';

interface Props {
  breakdown: CostEntry[];
  totalCost: number;
  totalGpt4Cost: number;
  totalSavings: number;
}

const AGENT_ICONS: Record<string, string> = {
  bull: '🐂',
  bear: '🐻',
  macro: '🌍',
  narrative: '📡',
  moderator: '⚖️',
  synthesis: '🧠',
  risk: '🛡️',
};

export function CostTable({ breakdown, totalCost, totalGpt4Cost, totalSavings }: Props) {
  const savingsPct = totalGpt4Cost > 0 ? ((totalSavings / totalGpt4Cost) * 100).toFixed(0) : '0';

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span>💰</span> Cost Breakdown
        </h2>
        <div className={styles.savingsBadge}>
          Saved {savingsPct}% vs GPT-4-only
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Model</th>
              <th className={styles.numCol}>Tokens In</th>
              <th className={styles.numCol}>Tokens Out</th>
              <th className={styles.numCol}>Cost</th>
              <th className={styles.numCol}>GPT-4 Cost</th>
              <th className={styles.numCol}>Savings</th>
              <th className={styles.numCol}>Latency</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((entry, i) => (
              <tr key={i} className={entry.agent === 'moderator' ? styles.escalatedRow : ''}>
                <td>
                  <span className={styles.agentCell}>
                    <span>{AGENT_ICONS[entry.agent] ?? '🤖'}</span>
                    <span className={styles.agentName}>{entry.agent}</span>
                    {entry.agent === 'moderator' && (
                      <span className={styles.escalatedTag}>escalated</span>
                    )}
                  </span>
                </td>
                <td>
                  <span className={styles.modelBadge}>{entry.model}</span>
                </td>
                <td className={styles.numCol}>{entry.tokensIn.toLocaleString()}</td>
                <td className={styles.numCol}>{entry.tokensOut.toLocaleString()}</td>
                <td className={`${styles.numCol} ${styles.cost}`}>
                  ${entry.costUsd.toFixed(5)}
                </td>
                <td className={`${styles.numCol} ${styles.gpt4Cost}`}>
                  ${entry.gpt4Cost.toFixed(5)}
                </td>
                <td className={`${styles.numCol} ${styles.savings}`}>
                  +${entry.savings.toFixed(5)}
                </td>
                <td className={styles.numCol}>{entry.latencyMs}ms</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td colSpan={4}><strong>Total</strong></td>
              <td className={`${styles.numCol} ${styles.cost}`}>
                <strong>${totalCost.toFixed(4)}</strong>
              </td>
              <td className={`${styles.numCol} ${styles.gpt4Cost}`}>
                <strong>${totalGpt4Cost.toFixed(4)}</strong>
              </td>
              <td className={`${styles.numCol} ${styles.savings}`}>
                <strong>+${totalSavings.toFixed(4)}</strong>
              </td>
              <td className={styles.numCol} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
