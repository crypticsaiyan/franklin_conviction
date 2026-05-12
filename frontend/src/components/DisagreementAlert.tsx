import styles from './DisagreementAlert.module.css';

interface Props {
  disagreement: { bullScore: number; bearScore: number; gap: number };
  escalated: boolean;
  escalating: boolean;
}

export function DisagreementAlert({ disagreement, escalated, escalating }: Props) {
  return (
    <div className={`${styles.alert} ${escalated ? styles.escalated : ''}`}>
      <div className={styles.top}>
        <span className={styles.alertIcon}>⚠</span>
        <div className={styles.alertText}>
          <strong>DISAGREEMENT_DETECTED</strong>
          <span>
            BULL=<strong style={{ color: 'var(--neon-green)' }}>{disagreement.bullScore}</strong>{' '}
            BEAR=<strong style={{ color: 'var(--neon-red)' }}>{disagreement.bearScore}</strong>{' '}
            GAP=<strong style={{ color: 'var(--neon-amber)' }}>{disagreement.gap}</strong>{' '}
            &gt; THRESHOLD=30
          </span>
        </div>
        {(escalated || escalating) && (
          <div className={styles.escalationBadge}>
            {escalating ? (
              <>
                <span className={styles.escalatingDot} />
                <span>ESCALATING → SONNET</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>CLAUDE_ARBITRATED</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
