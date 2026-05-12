import type { LogEvent } from './components/ActivityLog';
import type { AgentName, AgentState, FinalVerdict, MarketData } from './types';

type DemoRun = {
  token: string;
  label: string;
  description: string;
  marketData: MarketData;
  disagreement: { bullScore: number; bearScore: number; gap: number } | null;
  verdict: FinalVerdict;
  agents: Record<AgentName, AgentState>;
  events: LogEvent[];
};

function cost(agent: string, model: string, tokensIn: number, tokensOut: number, latencyMs: number, routingTier: string, routingProfile: string, costUsd: number) {
  const gpt4Cost = (tokensIn / 1_000_000) * 5 + (tokensOut / 1_000_000) * 15;
  return {
    agent,
    model,
    tokensIn,
    tokensOut,
    costUsd,
    latencyMs,
    gpt4Cost,
    savings: gpt4Cost - costUsd,
    routingTier,
    routingProfile,
  };
}

function agentState(entry: ReturnType<typeof cost>, content: string, score?: number): AgentState {
  return {
    status: 'complete',
    routingProfile: entry.routingProfile,
    result: {
      agent: entry.agent as AgentName,
      model: entry.model,
      content,
      score,
      tokensIn: entry.tokensIn,
      tokensOut: entry.tokensOut,
      costUsd: entry.costUsd,
      latencyMs: entry.latencyMs,
      routingTier: entry.routingTier as any,
      routingProfile: entry.routingProfile as any,
      routingSavings: entry.costUsd === 0 ? 1 : Math.max(0, entry.savings / entry.gpt4Cost),
      routingConfidence: entry.costUsd === 0 ? 1 : 0.87,
      routingReasoning: entry.costUsd === 0
        ? 'FREE mode pinned to zero-cost NVIDIA model'
        : 'Franklin router selected cheapest capable model for this agent task',
    },
  };
}

function run(
  token: string,
  label: string,
  description: string,
  price: number,
  entries: ReturnType<typeof cost>[],
  contents: Record<AgentName, string>,
  scores: Partial<Record<AgentName, number>>,
  convictionScore: number,
  escalated: boolean,
  disagreement: DemoRun['disagreement'],
): DemoRun {
  const totalCost = entries.reduce((s, e) => s + e.costUsd, 0);
  const totalGpt4Cost = entries.reduce((s, e) => s + e.gpt4Cost, 0);
  const totalSavings = totalGpt4Cost - totalCost;
  const costBreakdown = entries;
  const agents = (['bull', 'bear', 'macro', 'narrative', 'moderator', 'synthesis', 'risk'] as AgentName[])
    .reduce((acc, name) => {
      const entry = entries.find(e => e.agent === name);
      acc[name] = entry
        ? agentState(entry, contents[name], scores[name])
        : { status: 'idle' };
      return acc;
    }, {} as Record<AgentName, AgentState>);

  return {
    token,
    label,
    description,
    marketData: { symbol: token, price, source: 'demo-pyth' },
    disagreement,
    agents,
    verdict: {
      freeMode: totalCost === 0,
      token,
      convictionScore,
      bullSummary: contents.bull,
      bearSummary: contents.bear,
      macroContext: contents.macro,
      narrativeSentiment: contents.narrative,
      investmentMemo: contents.risk,
      escalated,
      escalationReason: escalated && disagreement
        ? `Bull: ${disagreement.bullScore}/100 bullish · Bear: ${disagreement.bearScore}/100 bearish (inverted: ${100 - disagreement.bearScore}) · net gap ${disagreement.gap}pts > 30pt threshold`
        : undefined,
      costBreakdown,
      totalCost,
      totalGpt4Cost,
      totalSavings,
      totalRoutingSavings: costBreakdown.length
        ? costBreakdown.reduce((s, e) => s + (e.costUsd === 0 ? 1 : Math.max(0, e.savings / e.gpt4Cost)), 0) / costBreakdown.length
        : undefined,
      entryZone: token === 'SOL' ? '$165-$174' : token === 'ONDO' ? '$0.86-$0.94' : '$1.05-$1.18',
      stopLoss: token === 'SOL' ? '$151' : token === 'ONDO' ? '$0.78' : '$0.94',
      positionSize: escalated ? '2-3% pilot allocation' : '3-5% allocation',
      timeHorizon: '6-10 weeks',
    },
    events: [
      { id: 1, time: '00:00:00.000', type: 'init', verb: 'DEMO', payload: `replay.start token=${token}` },
      { id: 2, time: '00:00:00.180', type: 'info', verb: 'DATA', payload: `${token} $${price.toLocaleString()} (demo · pyth)` },
      { id: 3, time: '00:00:00.420', type: 'spawn', verb: 'SPAWN', payload: '[bull,bear,macro,narrative] parallel committee' },
      ...(escalated ? [{ id: 4, time: '00:00:02.340', type: 'detect' as const, verb: 'DETECT', payload: `gap=${disagreement?.gap} threshold=30 -> arbitrator` }] : []),
      { id: 5, time: '00:00:03.700', type: 'synth', verb: 'SYNTH', payload: 'challenge notes merged into investment thesis' },
      { id: 6, time: '00:00:04.200', type: 'risk', verb: 'RISK', payload: 'risk officer applied position sizing and veto checks' },
      { id: 7, time: '00:00:04.680', type: 'final', verb: 'FINAL', payload: `verdict.delivered conviction=${convictionScore}/100` },
    ],
  };
}

export const DEMO_RUNS: DemoRun[] = [
  run(
    'SOL',
    'SOL arbitration run',
    'Shows a bull/bear gap, premium arbitration, and a full routing audit.',
    171.42,
    [
      cost('bull', 'google/gemini-2.5-flash-lite', 840, 220, 1430, 'MEDIUM', 'auto', 0.00031),
      cost('bear', 'google/gemini-2.5-flash-lite', 810, 210, 1370, 'MEDIUM', 'auto', 0.00030),
      cost('macro', 'moonshot/kimi-k2.5', 760, 190, 1810, 'COMPLEX', 'auto', 0.00046),
      cost('narrative', 'nvidia/mistral-small-4-119b', 620, 160, 990, 'SIMPLE', 'eco', 0),
      cost('moderator', 'anthropic/claude-sonnet-4-6', 940, 260, 3210, 'REASONING', 'premium', 0.00672),
      cost('synthesis', 'google/gemini-2.5-flash-lite', 1180, 310, 1560, 'MEDIUM', 'auto', 0.00044),
      cost('risk', 'google/gemini-2.5-flash-lite', 700, 230, 1210, 'MEDIUM', 'auto', 0.00033),
    ],
    {
      bull: 'BULL_SCORE: 78\n- SOL remains the highest-beta major L1 with resilient developer activity.\n- Price is reclaiming the prior range while liquidity is improving.',
      bear: 'BEAR_SCORE: 18\n- Valuation already prices in strong execution.\n- A broad market drawdown would hit SOL beta harder than BTC or ETH.',
      macro: '- Liquidity backdrop is constructive for high-beta majors.\n- L1 rotation favors names with visible throughput and consumer adoption.\n- Main risk is crowded positioning after recent momentum.',
      narrative: '- Social narrative is strong around payments, mobile, and consumer crypto.\n- Catalyst watch: ecosystem launches and ETF speculation.',
      moderator: 'The bull case wins because the bear score is low severity and mostly market-beta based. Arbitration keeps position size controlled because the trade is momentum-sensitive.',
      synthesis: 'SOL offers a constructive risk/reward when treated as a momentum allocation rather than a core defensive hold. Upside depends on continuation in L1 rotation and liquidity appetite.\n\nThe main risk is buying after enthusiasm has already repriced. A staged entry with a hard invalidation level is preferable.',
      risk: 'CONVICTION_SCORE: 74\nENTRY_ZONE: $165-$174\nSTOP_LOSS: $151\nPOSITION_SIZE: 2-3% pilot allocation\nTIME_HORIZON: 6-10 weeks\nINVESTMENT_MEMO: Trade is attractive but not clean enough for oversized exposure. Enter in tranches, require continued market strength, and cut quickly if SOL loses the reclaimed range.',
    },
    { bull: 78, bear: 18, risk: 74 },
    74,
    true,
    { bullScore: 78, bearScore: 18, gap: 96 },
  ),
  run(
    'ONDO',
    'ONDO free-mode run',
    'Shows the $0 path with NVIDIA models and a complete judge-friendly replay.',
    0.91,
    [
      cost('bull', 'nvidia/deepseek-v4-flash', 420, 92, 920, 'SIMPLE', 'free', 0),
      cost('bear', 'nvidia/deepseek-v4-flash', 410, 88, 910, 'SIMPLE', 'free', 0),
      cost('macro', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 390, 82, 1180, 'SIMPLE', 'free', 0),
      cost('narrative', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 380, 76, 1090, 'SIMPLE', 'free', 0),
      cost('synthesis', 'nvidia/deepseek-v4-flash', 500, 104, 940, 'SIMPLE', 'free', 0),
      cost('risk', 'nvidia/deepseek-v4-flash', 430, 96, 930, 'SIMPLE', 'free', 0),
    ],
    {
      bull: 'BULL_SCORE: 67\nRWA narrative remains one of the clearer institutional crypto themes, and ONDO still has direct mindshare in that lane.',
      bear: 'BEAR_SCORE: 39\nToken unlock attention and crowded RWA positioning can compress upside if broader market risk weakens.',
      macro: '- RWA is supported by tokenized treasury and institutional adoption themes.\n- Rate volatility can affect the narrative, but demand for yield rails remains durable.',
      narrative: '- Community interest is steady, with catalysts tied to partnerships and product expansion.\n- Sentiment is constructive but less explosive than early RWA rotations.',
      moderator: '',
      synthesis: 'ONDO has a credible theme and enough narrative support for a measured long. The setup is constructive but not urgent; strength should be confirmed rather than chased.',
      risk: 'CONVICTION_SCORE: 63\nENTRY_ZONE: $0.86-$0.94\nSTOP_LOSS: $0.78\nPOSITION_SIZE: 3-5% allocation\nTIME_HORIZON: 6-10 weeks\nINVESTMENT_MEMO: ONDO is a moderate-conviction RWA trade. Use a staged entry and avoid adding if narrative momentum fades or unlock concerns dominate.',
    },
    { bull: 67, bear: 39, risk: 63 },
    63,
    false,
    null,
  ),
];
