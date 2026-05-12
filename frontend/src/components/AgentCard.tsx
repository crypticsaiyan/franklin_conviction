import type { AgentName, AgentState } from '../types';
import styles from './AgentCard.module.css';

interface Props {
  name: AgentName;
  label: string;
  icon: string;
  color: string;
  state: AgentState;
  highlight?: boolean;
}

export function AgentCard({ label, icon, color, state, highlight }: Props) {
  const { status, model, result } = state;

  return (
    <div
      className={`${styles.card} ${styles[status]} ${highlight ? styles.highlight : ''}`}
      style={{ '--agent-color': color } as React.CSSProperties}
    >
      <div className={styles.header}>
        <div className={styles.iconLabel}>
          <span className={styles.icon}>{icon}</span>
          <span className={styles.label}>{label}</span>
        </div>
        <StatusBadge status={status} />
      </div>

      {model && (
        <div className={styles.model}>{model}</div>
      )}

      {status === 'running' && (
        <div className={styles.pulse}>
          <div className={styles.pulseDot} />
          <span>Analyzing...</span>
        </div>
      )}

      {status === 'complete' && result && (
        <div className={styles.stats}>
          {result.score !== undefined && (
            <div className={styles.score} style={{ color }}>
              Score: {result.score}
            </div>
          )}
          <div className={styles.meta}>
            <span>{result.tokensIn + result.tokensOut} tok</span>
            <span>{result.latencyMs}ms</span>
            <span>${result.costUsd.toFixed(5)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    idle: { label: 'Idle', cls: styles.badgeIdle },
    running: { label: 'Running', cls: styles.badgeRunning },
    complete: { label: 'Done', cls: styles.badgeComplete },
    error: { label: 'Error', cls: styles.badgeError },
  };
  const { label, cls } = map[status] ?? map.idle;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}
