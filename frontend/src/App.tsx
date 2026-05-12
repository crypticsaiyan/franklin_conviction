import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  AgentName,
  AgentState,
  FinalVerdict,
  AnalysisPhase,
  SSEEvent,
  MarketData,
} from './types';
import { AgentBento } from './components/AgentBento';
import { ConvictionGauge } from './components/ConvictionGauge';
import { ActivityLog, type LogEvent, type LogType } from './components/ActivityLog';
import { CostTicker } from './components/CostTicker';
import { Receipt } from './components/Receipt';
import { DisagreementAlert } from './components/DisagreementAlert';
import { InvestmentMemo } from './components/InvestmentMemo';
import { MarketDataBar } from './components/MarketDataBar';
import { renderMd } from './renderMd';
import { DEMO_RUNS } from './demoRuns';
import styles from './App.module.css';

const AGENT_LABELS: Record<AgentName, string> = {
  bull: 'Bull', bear: 'Bear', macro: 'Macro', narrative: 'Narrative',
  moderator: 'Arbitrator', synthesis: 'Synthesis', risk: 'Risk Officer',
};

function initAgents(): Record<AgentName, AgentState> {
  const all: AgentName[] = ['bull', 'bear', 'macro', 'narrative', 'moderator', 'synthesis', 'risk'];
  return all.reduce((acc, a) => { acc[a] = { status: 'idle' }; return acc; }, {} as Record<AgentName, AgentState>);
}

function nowTime(): string {
  const d = new Date();
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

let logId = 0;

export default function App() {
  const [token, setToken] = useState('');
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [agents, setAgents] = useState<Record<AgentName, AgentState>>(initAgents());
  const [verdict, setVerdict] = useState<FinalVerdict | null>(null);
  const [disagreement, setDisagreement] = useState<{ bullScore: number; bearScore: number; gap: number } | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [freeMode, setFreeMode] = useState(true);
  const [demoLabel, setDemoLabel] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  function updateAgent(name: AgentName, patch: Partial<AgentState>) {
    setAgents(prev => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }

  function pushEvent(type: LogType, verb: string, payload: string) {
    setEvents(prev => [...prev, { id: ++logId, time: nowTime(), type, verb, payload }]);
  }

  const analyze = useCallback(() => {
    const t = token.trim();
    if (!t) return;

    setPhase('agents');
    setAgents(initAgents());
    setVerdict(null);
    setDisagreement(null);
    setEscalated(false);
    setError(null);
    setEvents([]);
    setMarketData(null);
    setDemoLabel(null);
    logId = 0;

    if (eventSourceRef.current) eventSourceRef.current.close();

    pushEvent('init', 'INIT', `pipeline.start token=${t.toUpperCase()}`);

    const es = new EventSource(`/api/analyze?token=${encodeURIComponent(t)}&freeMode=${freeMode}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const event: SSEEvent = JSON.parse(e.data);
      const { type, data } = event;

      switch (type) {
        case 'data_fetched': {
          const d = data as MarketData;
          setMarketData(d);
          pushEvent('info', 'DATA', `${d.symbol} $${d.price.toLocaleString()} (live · ${d.source ?? 'pyth'})`);
          break;
        }
        case 'agent_start': {
          const d = data as { agent: AgentName; routingProfile: string };
          updateAgent(d.agent, { status: 'running', routingProfile: d.routingProfile });
          pushEvent('spawn', 'SPAWN', `[${d.agent}] profile=${d.routingProfile}`);
          break;
        }
        case 'agent_complete': {
          const d = data as { agent: AgentName; result: NonNullable<AgentState['result']> };
          updateAgent(d.agent, { status: 'complete', result: d.result });
          const ms = (d.result.latencyMs / 1000).toFixed(2);
          const score = d.result.score !== undefined ? ` SCORE=${d.result.score}` : '';
          const tier = d.result.routingTier ? ` [${d.result.routingTier}]` : '';
          const mdl = ` → ${d.result.model.split('/').pop()}`;
          pushEvent('done', 'DONE', `[${d.agent}]${tier}${mdl} ${ms}s${score}`);
          break;
        }
        case 'disagreement_detected': {
          const d = data as { bullScore: number; bearScore: number; gap: number; threshold: number };
          setDisagreement(d);
          setPhase('disagreement');
          pushEvent('detect', 'DETECT', `gap=${d.gap} threshold=${d.threshold} bull=${d.bullScore} bear=${d.bearScore}`);
          break;
        }
        case 'escalation_start': {
          const d = data as { routingProfile: string };
          updateAgent('moderator', { status: 'running', routingProfile: d.routingProfile });
          setPhase('escalation');
          setEscalated(true);
          pushEvent('escalate', 'ESCALATE', `→ profile=${d.routingProfile}`);
          break;
        }
        case 'escalation_complete': {
          const d = data as { result: NonNullable<AgentState['result']> };
          updateAgent('moderator', { status: 'complete', result: d.result });
          pushEvent('done', 'DONE', `[arbitrator] ${(d.result.latencyMs / 1000).toFixed(2)}s · ${d.result.tokensIn + d.result.tokensOut}t`);
          break;
        }
        case 'synthesis_start': {
          const d = data as { routingProfile: string };
          updateAgent('synthesis', { status: 'running', routingProfile: d.routingProfile });
          setPhase('synthesis');
          pushEvent('synth', 'SYNTH', `→ profile=${d.routingProfile}`);
          break;
        }
        case 'synthesis_complete': {
          const d = data as { result: NonNullable<AgentState['result']> };
          updateAgent('synthesis', { status: 'complete', result: d.result });
          pushEvent('done', 'DONE', `[synthesis] ${(d.result.latencyMs / 1000).toFixed(2)}s · ${d.result.tokensIn + d.result.tokensOut}t`);
          break;
        }
        case 'risk_start': {
          const d = data as { routingProfile: string };
          updateAgent('risk', { status: 'running', routingProfile: d.routingProfile });
          setPhase('risk');
          pushEvent('risk', 'RISK', `→ profile=${d.routingProfile}`);
          break;
        }
        case 'risk_complete': {
          const d = data as { result: NonNullable<AgentState['result']> };
          updateAgent('risk', { status: 'complete', result: d.result });
          pushEvent('done', 'DONE', `[risk] ${(d.result.latencyMs / 1000).toFixed(2)}s · CONVICTION=${d.result.score ?? '?'}`);
          break;
        }
        case 'final': {
          const d = data as FinalVerdict;
          setVerdict(d);
          setPhase('complete');
          pushEvent('final', 'FINAL', `verdict.delivered conviction=${d.convictionScore}/100`);
          es.close();
          break;
        }
        case 'error': {
          const d = data as { message: string };
          setError(d.message);
          setPhase('error');
          pushEvent('error', 'ERROR', d.message);
          es.close();
          break;
        }
      }
    };

    es.onerror = () => {
      if (phase !== 'complete') {
        setError('Connection lost. Check backend.');
        setPhase('error');
        pushEvent('error', 'ERROR', 'sse.connection_lost');
      }
      es.close();
    };
  }, [token, freeMode]);

  const loadDemo = useCallback((demo: (typeof DEMO_RUNS)[number]) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setToken(demo.token);
    setPhase('complete');
    setAgents(demo.agents);
    setVerdict(demo.verdict);
    setDisagreement(demo.disagreement);
    setEscalated(demo.verdict.escalated);
    setError(null);
    setEvents(demo.events);
    setMarketData(demo.marketData);
    setFreeMode(demo.verdict.freeMode ?? freeMode);
    setDemoLabel(demo.label);
    logId = demo.events.length;
  }, [freeMode]);

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  return (
    <div className={styles.app}>
      {/* === HEADER STRIP === */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoMark}>FCE</div>
          <div className={styles.logoStack}>
            <span className={styles.logoTitle}>FRANKLIN <span className={styles.logoAccent}>CONVICTION</span></span>
            <span className={styles.logoSub}>// multi-agent crypto investment engine · v1.0</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.modeToggle}
            data-free={freeMode}
            onClick={() => !isRunning && setFreeMode(f => !f)}
            disabled={isRunning}
            title={freeMode ? 'FREE MODE — click to switch to SMART ROUTING (costs ~$0.01/run)' : 'SMART ROUTING — click to switch to FREE MODE ($0)'}
          >
            <span className={styles.modeToggleDot} />
            {freeMode ? 'FREE' : 'SMART'}
          </button>
          <span className={styles.statusPill} data-status={phase}>
            <span className={styles.statusDot} />
            {phase.toUpperCase()}
          </span>
        </div>
      </header>

      {/* === COMMAND BAR === */}
      <section className={styles.commandBar}>
        <span className={styles.prompt}>{'>'}</span>
        <input
          className={styles.input}
          type="text"
          placeholder="ENTER TOKEN OR PROJECT — e.g. ONDO · ARBITRUM · SOLANA"
          value={token}
          onChange={e => setToken(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && !isRunning && analyze()}
          disabled={isRunning}
          spellCheck={false}
        />
        <button
          className={styles.executeBtn}
          onClick={analyze}
          disabled={isRunning || !token.trim()}
        >
          {isRunning ? (
            <span className={styles.btnRunning}>
              <span className={styles.btnSpinner} />
              EXECUTING
            </span>
          ) : (
            <>EXECUTE <span className={styles.btnArrow}>↵</span></>
          )}
        </button>
      </section>

      <JudgeConsole
        isRunning={isRunning}
        freeMode={freeMode}
        demoLabel={demoLabel}
        onDemo={loadDemo}
      />

      {/* === MARKET DATA BAR === */}
      <AnimatePresence>
        {marketData && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <MarketDataBar data={marketData} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* === DISAGREEMENT ALERT === */}
      <AnimatePresence>
        {disagreement && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <DisagreementAlert
              disagreement={disagreement}
              escalated={escalated}
              escalating={phase === 'escalation'}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* === MAIN GRID === */}
      <main className={styles.grid}>
        {/* Orbit takes full row when no verdict, becomes left col when complete */}
        <div className={styles.orbitPanel}>
          {phase === 'idle' ? (
            <IdleHero />
          ) : (
            <AgentBento agents={agents} />
          )}
        </div>

        {/* Right side: gauge (when verdict) or status panel */}
        <div className={styles.sidePanel}>
          {verdict ? (
            <ConvictionGauge
              score={verdict.convictionScore}
              token={verdict.token}
              escalated={verdict.escalated}
            />
          ) : (
            <StatusPanel agents={agents} phase={phase} />
          )}
        </div>

        {/* Activity log spans full width below */}
        <div className={styles.logPanel}>
          <ActivityLog events={events} />
        </div>

        {/* Cost ticker — full width when verdict */}
        {verdict && (
          <div className={styles.tickerPanel}>
            <CostTicker
              totalCost={verdict.totalCost}
              totalGpt4Cost={verdict.totalGpt4Cost}
              totalSavings={verdict.totalSavings}
              totalRoutingSavings={verdict.totalRoutingSavings}
              freeMode={verdict.freeMode ?? freeMode}
            />
          </div>
        )}
      </main>

      {/* === VERDICT BREAKDOWN === */}
      {verdict && (
        <>
          <section className={styles.breakdownSection}>
            <AutonomyBrief escalated={verdict.escalated} freeMode={verdict.freeMode ?? freeMode} />
          </section>

          <section className={styles.breakdownSection}>
            <h2 className={styles.sectionTitle}>// ANALYSIS_BREAKDOWN</h2>
            <div className={styles.breakdownGrid}>
              <BreakCard label="BULL"      content={verdict.bullSummary}        color="var(--color-bull)" />
              <BreakCard label="BEAR"      content={verdict.bearSummary}        color="var(--color-bear)" />
              <BreakCard label="MACRO"     content={verdict.macroContext}       color="var(--color-macro)" />
              <BreakCard label="NARRATIVE" content={verdict.narrativeSentiment} color="var(--color-narrative)" />
            </div>
          </section>

          <section className={styles.breakdownSection}>
            <InvestmentMemo
              memo={verdict.investmentMemo}
              escalated={verdict.escalated}
              escalationReason={verdict.escalationReason}
              entryZone={verdict.entryZone}
              stopLoss={verdict.stopLoss}
              positionSize={verdict.positionSize}
              timeHorizon={verdict.timeHorizon}
            />
          </section>

          <section className={styles.breakdownSection}>
            <RoutingAudit
              breakdown={verdict.costBreakdown}
              totalCost={verdict.totalCost}
              totalGpt4Cost={verdict.totalGpt4Cost}
              totalSavings={verdict.totalSavings}
              freeMode={verdict.freeMode ?? freeMode}
            />
          </section>

          <section className={styles.breakdownSection}>
            <Receipt
              token={verdict.token}
              breakdown={verdict.costBreakdown}
              totalCost={verdict.totalCost}
              totalGpt4Cost={verdict.totalGpt4Cost}
              totalSavings={verdict.totalSavings}
              escalated={verdict.escalated}
              convictionScore={verdict.convictionScore}
            />
          </section>
        </>
      )}

      {error && (
        <div className={styles.errorBox}>
          <strong>// ERROR:</strong> {error}
        </div>
      )}

      <footer className={styles.footer}>
        <span>POWERED BY @blockrun/llm</span>
        <span>·</span>
        <span>x402 ON BASE MAINNET</span>
        <span>·</span>
        <span>UTC {new Date().toISOString().slice(0, 10)}</span>
      </footer>
    </div>
  );
}

function JudgeConsole({
  isRunning,
  freeMode,
  demoLabel,
  onDemo,
}: {
  isRunning: boolean;
  freeMode: boolean;
  demoLabel: string | null;
  onDemo: (demo: (typeof DEMO_RUNS)[number]) => void;
}) {
  return (
    <section className={styles.judgeConsole}>
      <div className={styles.judgeIntro}>
        <span className={styles.judgeKicker}>// JUDGE_FLOW</span>
        <strong>Franklin-native autonomous investment committee</strong>
        <span>
          Live mode uses BlockRun LLM + PriceClient. Demo mode replays the same pipeline for instant evaluation.
        </span>
      </div>
      <div className={styles.judgeActions}>
        {DEMO_RUNS.map(demo => (
          <button
            key={demo.token}
            className={styles.demoBtn}
            onClick={() => onDemo(demo)}
            disabled={isRunning}
            title={demo.description}
          >
            <span>{demo.token}</span>
            <small>{demo.label}</small>
          </button>
        ))}
      </div>
      <div className={styles.judgeState} data-free={freeMode}>
        <span>{demoLabel ? 'DEMO_REPLAY' : 'LIVE_READY'}</span>
        <strong>{demoLabel ?? (freeMode ? '$0 FREE ROUTE' : 'SMART ROUTING')}</strong>
      </div>
    </section>
  );
}

function IdleHero() {
  return (
    <div className={styles.idleHero}>
      <div className={styles.idleScan} />
      <div className={styles.idleContent}>
        <span className={styles.idleLabel}>// SYSTEM_READY</span>
        <h1 className={styles.idleTitle}>
          AWAITING<br/>
          <span className={styles.idleTitleAccent}>TARGET</span>
        </h1>
        <p className={styles.idleHint}>
          7 agents standby. Enter a crypto token above or launch a judge replay.
          Disagreement &gt; 30pts triggers arbitration; risk can veto oversized allocations.
        </p>
        <div className={styles.idleStats}>
          <div className={styles.idleStat}>
            <span className={styles.idleStatNum}>4</span>
            <span className={styles.idleStatLabel}>PARALLEL AGENTS</span>
          </div>
          <div className={styles.idleStat}>
            <span className={styles.idleStatNum}>3</span>
            <span className={styles.idleStatLabel}>SYNTHESIS NODES</span>
          </div>
          <div className={styles.idleStat}>
            <span className={styles.idleStatNum}>97%</span>
            <span className={styles.idleStatLabel}>COST SAVINGS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutonomyBrief({ escalated, freeMode }: { escalated: boolean; freeMode: boolean }) {
  const cells = [
    ['PARALLEL SCOUTS', 'Bull, bear, macro, and narrative agents run concurrently.'],
    ['CHALLENGE GATE', escalated ? 'Bull/bear conflict exceeded threshold; arbitration was triggered.' : 'Bull/bear conflict stayed under threshold; arbitration was skipped.'],
    ['CAPITAL VETO', 'Risk officer converts thesis into entry, stop, sizing, and time horizon.'],
    ['ROUTING POLICY', freeMode ? 'All LLM nodes pinned to zero-cost NVIDIA models.' : 'Franklin routes cheap tasks down and reserves premium only for arbitration.'],
  ];

  return (
    <div className={styles.autonomyBrief}>
      <header className={styles.auditHeader}>
        <span>// AUTONOMY_MAP</span>
        <strong>{escalated ? 'DISPUTE RESOLVED' : 'CONSENSUS PATH'}</strong>
      </header>
      <div className={styles.autonomyGrid}>
        {cells.map(([label, text]) => (
          <article key={label} className={styles.autonomyCell}>
            <span>{label}</span>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function RoutingAudit({
  breakdown,
  totalCost,
  totalGpt4Cost,
  totalSavings,
  freeMode,
}: {
  breakdown: FinalVerdict['costBreakdown'];
  totalCost: number;
  totalGpt4Cost: number;
  totalSavings: number;
  freeMode: boolean;
}) {
  const savingsPct = totalGpt4Cost > 0 ? Math.round((totalSavings / totalGpt4Cost) * 100) : 0;
  const premiumCount = breakdown.filter(e => e.routingProfile === 'premium').length;
  const freeCount = breakdown.filter(e => e.costUsd === 0 || e.routingProfile === 'free').length;

  return (
    <div className={styles.routingAudit}>
      <header className={styles.auditHeader}>
        <span>// ROUTING_AUDIT</span>
        <strong>{savingsPct}% SAVED VS GPT-4-ONLY</strong>
      </header>
      <div className={styles.auditStats}>
        <div>
          <span>ACTUAL COST</span>
          <strong>${totalCost.toFixed(6)}</strong>
        </div>
        <div>
          <span>GPT-4 BASELINE</span>
          <strong>${totalGpt4Cost.toFixed(6)}</strong>
        </div>
        <div>
          <span>FREE NODES</span>
          <strong>{freeCount}/{breakdown.length}</strong>
        </div>
        <div>
          <span>PREMIUM ESCALATIONS</span>
          <strong>{premiumCount}</strong>
        </div>
      </div>
      <div className={styles.auditTableWrap}>
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Profile</th>
              <th>Tier</th>
              <th>Selected model</th>
              <th>Why Franklin routed it there</th>
              <th>Actual</th>
              <th>Baseline</th>
              <th>Saved</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map(entry => {
              const savedPct = entry.gpt4Cost > 0 ? Math.round((entry.savings / entry.gpt4Cost) * 100) : 100;
              const reason = routeReason(entry.routingProfile, entry.routingTier, freeMode);
              return (
                <tr key={`${entry.agent}-${entry.model}`}>
                  <td>{entry.agent.toUpperCase()}</td>
                  <td><span className={styles.profileChip} data-profile={entry.routingProfile}>{entry.routingProfile ?? 'auto'}</span></td>
                  <td>{entry.routingTier ?? '--'}</td>
                  <td className={styles.modelCell}>{entry.model}</td>
                  <td>{reason}</td>
                  <td>${entry.costUsd.toFixed(6)}</td>
                  <td>${entry.gpt4Cost.toFixed(6)}</td>
                  <td className={styles.savedCell}>{savedPct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.auditNote}>
        Franklin is treated as the routing substrate: cheap/free models handle routine scouting, while high-stakes disagreement can escalate.
      </p>
    </div>
  );
}

function routeReason(profile?: string, tier?: string, freeMode?: boolean): string {
  if (freeMode || profile === 'free') return 'Zero-cost judge-safe route pinned to NVIDIA free tier.';
  if (profile === 'premium') return 'Only used when disagreement requires higher-quality arbitration.';
  if (profile === 'eco') return 'Lightweight narrative task routed to lowest-cost capable model.';
  if (tier === 'COMPLEX' || tier === 'REASONING') return 'Franklin detected higher complexity and selected a stronger model.';
  return 'Routine analysis routed to a cheap capable model instead of defaulting to GPT-4.';
}

function StatusPanel({ agents, phase }: { agents: Record<AgentName, AgentState>; phase: AnalysisPhase }) {
  const list: AgentName[] = ['bull', 'bear', 'macro', 'narrative', 'moderator', 'synthesis', 'risk'];
  const complete = list.filter(a => agents[a].status === 'complete').length;
  return (
    <div className={styles.statusPanel}>
      <div className={styles.statusHeader}>
        <span className={styles.statusHeaderLabel}>// PIPELINE_STATUS</span>
        <span className={styles.statusPhase}>{phase.toUpperCase()}</span>
      </div>

      <div className={styles.statusProgress}>
        <div className={styles.statusProgressBar} style={{ width: `${(complete / 7) * 100}%` }} />
        <span className={styles.statusProgressLabel}>{complete} / 7 NODES</span>
      </div>

      <ul className={styles.statusList}>
        {list.map(name => {
          const state = agents[name];
          return (
            <li key={name} className={styles.statusItem} data-status={state.status}>
              <span className={styles.statusItemDot} />
              <span className={styles.statusItemName}>{AGENT_LABELS[name]}</span>
              <span className={styles.statusItemValue}>
                {state.status === 'complete' && state.result?.score !== undefined
                  ? state.result.score
                  : state.status === 'running'
                    ? '...'
                    : state.status === 'complete'
                      ? '✓'
                      : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BreakCard({ label, content, color }: { label: string; content: string; color: string }) {
  return (
    <article className={styles.breakCard} style={{ '--c': color } as any}>
      <header className={styles.breakHeader}>
        <span className={styles.breakBullet} />
        <span className={styles.breakLabel}>{label}</span>
      </header>
      <p className={styles.breakContent}>{renderMd(content)}</p>
    </article>
  );
}
