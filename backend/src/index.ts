import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  runBullAgent,
  runBearAgent,
  runMacroAgent,
  runNarrativeAgent,
  runSynthesisAgent,
  runEscalationAgent,
  runRiskOfficer,
  buildCostEntry,
} from './agents.js';
import { calcGpt4Cost } from './models.js';
import { fetchMarketData, formatForPrompt } from './data.js';
import type { SSEEvent, FinalVerdict, AgentResult } from './types.js';

function loadWalletKey(): void {
  if (process.env.BASE_CHAIN_WALLET_KEY) return;
  const paths = [
    join(homedir(), '.blockrun', 'wallet-key'),
    join(homedir(), '.blockrun', 'key'),
    join(homedir(), '.blockrun', 'base-wallet-key'),
    join(homedir(), '.blockrun', '.session'),
  ];
  for (const p of paths) {
    try {
      const key = readFileSync(p, 'utf8').trim();
      if (key) {
        process.env.BASE_CHAIN_WALLET_KEY = key;
        console.log(`Loaded wallet key from ${p}`);
        return;
      }
    } catch {}
  }
}

loadWalletKey();

const app = express();
app.use(cors());
app.use(express.json());

const DISAGREEMENT_THRESHOLD = 30;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', walletLoaded: !!process.env.BASE_CHAIN_WALLET_KEY });
});

function parseRiskOutput(content: string) {
  const f = (label: string) => {
    const m = content.match(new RegExp(`${label}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 's'));
    return m?.[1]?.trim();
  };
  return {
    investmentMemo: f('INVESTMENT_MEMO') ?? content,
    entryZone:      f('ENTRY_ZONE'),
    stopLoss:       f('STOP_LOSS'),
    positionSize:   f('POSITION_SIZE'),
    timeHorizon:    f('TIME_HORIZON'),
  };
}

app.get('/api/analyze', async (req, res) => {
  const token = (req.query.token as string)?.trim();
  if (!token) {
    res.status(400).json({ error: 'token query param required' });
    return;
  }
  const freeMode = req.query.freeMode !== 'false' && process.env.FREE_MODE !== 'false';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  function send(event: SSEEvent) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  try {
    // Phase 0: fetch live market data
    const marketData = await fetchMarketData(token).catch(() => null);
    if (marketData) {
      send({ type: 'data_fetched', data: marketData });
    }
    const marketCtx = marketData ? formatForPrompt(marketData) : '';

    // Phase 1: spawn 4 agents in parallel
    const p = (base: string) => freeMode ? 'free' : base;
    send({ type: 'agent_start', data: { agent: 'bull',      routingProfile: p('auto'), freeMode } });
    send({ type: 'agent_start', data: { agent: 'bear',      routingProfile: p('auto'), freeMode } });
    send({ type: 'agent_start', data: { agent: 'macro',     routingProfile: p('auto'), freeMode } });
    send({ type: 'agent_start', data: { agent: 'narrative', routingProfile: p('eco'),  freeMode } });

    const [bullResult, bearResult, macroResult, narrativeResult] = await Promise.all([
      runBullAgent(token, marketCtx, freeMode),
      runBearAgent(token, marketCtx, freeMode),
      runMacroAgent(token, marketCtx, freeMode),
      runNarrativeAgent(token, marketCtx, freeMode),
    ]);

    send({ type: 'agent_complete', data: { agent: 'bull',      result: bullResult } });
    send({ type: 'agent_complete', data: { agent: 'bear',      result: bearResult } });
    send({ type: 'agent_complete', data: { agent: 'macro',     result: macroResult } });
    send({ type: 'agent_complete', data: { agent: 'narrative', result: narrativeResult } });

    // Phase 2: disagreement check
    const bullScore = bullResult.score ?? 50;
    const bearScore = bearResult.score ?? 50;
    const bearAsInverse = 100 - bearScore;
    const gap = Math.abs(bullScore - bearAsInverse);
    const escalated = gap > DISAGREEMENT_THRESHOLD;

    let escalationResult: AgentResult | undefined;

    if (escalated) {
      send({
        type: 'disagreement_detected',
        data: { bullScore, bearScore, gap, threshold: DISAGREEMENT_THRESHOLD },
      });
      send({ type: 'escalation_start', data: { routingProfile: freeMode ? 'free' : 'premium', freeMode } });

      escalationResult = await runEscalationAgent(
        token,
        bullResult.content,
        bearResult.content,
        bullScore,
        bearScore,
        freeMode,
      );

      send({ type: 'escalation_complete', data: { result: escalationResult } });
    }

    // Phase 3: synthesis
    send({ type: 'synthesis_start', data: { routingProfile: freeMode ? 'free' : 'auto', escalated, freeMode } });

    const synthesisResult = await runSynthesisAgent(
      token,
      bullResult,
      bearResult,
      macroResult,
      narrativeResult,
      escalationResult?.content,
      freeMode,
    );

    send({ type: 'synthesis_complete', data: { result: synthesisResult } });

    // Phase 4: risk officer
    send({ type: 'risk_start', data: { routingProfile: freeMode ? 'free' : 'auto', freeMode } });

    const riskResult = await runRiskOfficer(
      token,
      synthesisResult.content,
      bullScore,
      bearScore,
      escalated,
      escalationResult?.content,
      freeMode,
    );

    send({ type: 'risk_complete', data: { result: riskResult } });

    // Build cost breakdown
    const allResults: AgentResult[] = [bullResult, bearResult, macroResult, narrativeResult];
    if (escalationResult) allResults.push(escalationResult);
    allResults.push(synthesisResult, riskResult);

    const costBreakdown = allResults.map(buildCostEntry);
    const totalCost = costBreakdown.reduce((s, e) => s + e.costUsd, 0);
    const totalGpt4Cost = allResults.reduce((s, r) => s + calcGpt4Cost(r.tokensIn, r.tokensOut), 0);
    const totalSavings = totalGpt4Cost - totalCost;

    // Average smart routing savings across all agents
    const savingsValues = allResults.filter(r => r.routingSavings !== undefined).map(r => r.routingSavings!);
    const totalRoutingSavings = savingsValues.length
      ? savingsValues.reduce((a, b) => a + b, 0) / savingsValues.length
      : undefined;

    const { investmentMemo, entryZone, stopLoss, positionSize, timeHorizon } = parseRiskOutput(riskResult.content);

    const verdict: FinalVerdict = {
      freeMode,
      token,
      convictionScore: riskResult.score ?? 50,
      bullSummary: bullResult.content,
      bearSummary: bearResult.content,
      macroContext: macroResult.content,
      narrativeSentiment: narrativeResult.content,
      investmentMemo,
      escalated,
      escalationReason: escalated
        ? `Bull: ${bullScore}/100 bullish · Bear: ${bearScore}/100 bearish (inverted: ${100 - bearScore}) · net gap ${gap}pts > ${DISAGREEMENT_THRESHOLD}pt threshold`
        : undefined,
      costBreakdown,
      totalCost,
      totalGpt4Cost,
      totalSavings,
      entryZone,
      stopLoss,
      positionSize,
      timeHorizon,
      totalRoutingSavings,
    };

    send({ type: 'final', data: verdict });
  } catch (err) {
    let message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[analyze error]', message, stack);
    if (!freeMode && (message.includes('Payment') || message.includes('wallet') || message.includes('402'))) {
      message += ' Switch to FREE mode (top-right toggle) to use eco routing at no cost.';
    }
    send({ type: 'error', data: { message } });
  }

  res.end();
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Franklin Conviction Engine backend listening on port ${PORT}`);
  console.log(`Wallet key loaded: ${!!process.env.BASE_CHAIN_WALLET_KEY}`);
});
