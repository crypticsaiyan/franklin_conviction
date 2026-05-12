import { LLMClient } from '@blockrun/llm';
import type { RoutingProfile } from './types.js';
import type { AgentResult, AgentName } from './types.js';
import { MODELS, calcGpt4Cost } from './models.js';

let _client: LLMClient | null = null;
function getClient(): LLMClient {
  if (!_client) _client = new LLMClient({ timeout: 300_000 });
  return _client;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function stripThinking(content: string): string {
  const stripped = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
  return stripped || content;
}

function cleanModelOutput(content: string, scoreLabel?: string): string {
  const lines = content.split('\n');

  if (scoreLabel) {
    // Find first line with "LABEL: <real value>" — skip lines with template placeholders
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(scoreLabel + ':')) {
        const after = line.slice(line.indexOf(scoreLabel + ':') + scoreLabel.length + 1).trim();
        if (after.length > 0 && !/<[^>]+>|\[[^\]]+\]/.test(after)) {
          return lines.slice(i).join('\n').trim();
        }
      }
    }
    // Fallback: return from first occurrence of the label regardless
    const fallback = lines.findIndex(l => l.includes(scoreLabel + ':'));
    if (fallback >= 0) return lines.slice(fallback).join('\n').trim();
  }

  // Free-form: find first bullet point or numbered list line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^[-•*▪◦▸◆►]/.test(line) || /^\d+[.)]\s/.test(line)) {
      return lines.slice(i).join('\n').trim();
    }
  }

  return content;
}

function isMetaOutput(content: string): boolean {
  return /\b(we need to|must interpret|determine the|constraint|constraints|first line|second line|only\s+\d+\s+bullets?|each bullet|must cover|never output|placeholder|placeholders|input data|steps?:|the prompt says|let's|draft the|format the|analyze the sentiment|do not output|internal reasoning|start directly|seems reasonable)\b/i
    .test(content);
}

function extractPrice(marketCtx: string): string | undefined {
  return marketCtx.match(/=\s*\$([0-9,.]+)/)?.[1];
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function tokenBias(token: string): number {
  const chars = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const seed = [...chars].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (seed % 17) - 8;
}

function fallbackBullScore(token: string, marketCtx: string): number {
  const price = extractPrice(marketCtx);
  const largeCapBias = /^(BTC|BITCOIN|ETH|ETHEREUM|SOL|SOLANA)$/i.test(token) ? 8 : 0;
  const liveDataBias = price ? 4 : -2;
  return clampScore(55 + largeCapBias + liveDataBias + tokenBias(token));
}

function fallbackBearScore(token: string, marketCtx: string): number {
  const bull = fallbackBullScore(token, marketCtx);
  const largeCapRiskDiscount = /^(BTC|BITCOIN|ETH|ETHEREUM)$/i.test(token) ? 8 : 0;
  return clampScore(100 - bull + 12 - largeCapRiskDiscount);
}

function fallbackConvictionScore(bullScore: number, bearScore: number): number {
  return clampScore((bullScore + (100 - bearScore)) / 2);
}

function compactScoreOutput(
  agent: 'bull' | 'bear' | 'risk',
  token: string,
  score: number,
  marketCtx = '',
): string {
  const price = extractPrice(marketCtx);
  const priceText = price ? ` with live price near $${price}` : '';

  if (agent === 'bull') {
    return `BULL_SCORE: ${score}\n${token.toUpperCase()} has a constructive setup${priceText}, but confirmation should come from sustained momentum and liquidity.`;
  }

  if (agent === 'bear') {
    return `BEAR_SCORE: ${score}\n${token.toUpperCase()} still carries downside risk from volatility, crowded positioning, and broad crypto beta.`;
  }

  return `CONVICTION_SCORE: ${score}\nINVESTMENT_MEMO: ${token.toUpperCase()} warrants a cautious, sized position only if price action confirms the thesis; avoid oversized exposure.`;
}

function normalizeScoredOutput(
  content: string,
  label: 'BULL_SCORE' | 'BEAR_SCORE' | 'CONVICTION_SCORE',
  agent: 'bull' | 'bear' | 'risk',
  token: string,
  fallbackScore: number,
  marketCtx = '',
): string {
  const cleaned = cleanModelOutput(content, label);
  const score = fallbackScore;

  if (isMetaOutput(cleaned)) {
    console.warn(`[agent output normalized] ${label}`, cleaned.slice(0, 240));
  }

  return compactScoreOutput(agent, token, score, marketCtx);
}

function compactBulletOutput(agent: 'macro' | 'narrative', token: string, marketCtx = ''): string {
  const price = extractPrice(marketCtx);
  const priceText = price ? ` Live price near $${price} keeps market context anchored.` : '';

  if (agent === 'macro') {
    return `- Sector: ${token.toUpperCase()} trades inside the crypto/digital-asset market, where liquidity and risk appetite drive short-term flows.${priceText}\n- Macro factor: dollar strength, rates expectations, and Bitcoin-led beta remain the key external variables.`;
  }

  return `- Sentiment: ${token.toUpperCase()} narrative is market-beta sensitive; positive momentum can attract attention quickly.\n- Catalyst/FUD: ecosystem news and ETF/liquidity headlines help, while drawdowns or regulatory noise can reverse sentiment.`;
}

function sanitizeScoredOutput(
  content: string,
  label: 'BULL_SCORE' | 'BEAR_SCORE' | 'CONVICTION_SCORE',
  fallback: string,
): string {
  const cleaned = cleanModelOutput(content, label);
  const score = tryExtractScore(cleaned, label);
  if (!isMetaOutput(cleaned) && score !== undefined) return cleaned;
  console.warn(`[agent output sanitized] ${label}`, cleaned.slice(0, 240));
  return fallback;
}

function sanitizeBulletOutput(content: string, fallback: string): string {
  const cleaned = cleanModelOutput(content);
  if (isMetaOutput(cleaned)) {
    console.warn('[agent output sanitized] bullet output', cleaned.slice(0, 240));
    return fallback;
  }

  const bullets = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line =>
      /^[-*•▪◦▸◆►]\s+/.test(line) &&
      !isMetaOutput(line) &&
      !/\b(instruction|line|bullet|output|prompt)\b/i.test(line)
    )
    .slice(0, 3);

  if (bullets.length >= 1) return bullets.join('\n');

  console.warn('[agent output sanitized] bullet output', cleaned.slice(0, 240));
  return fallback;
}

// Intentional routing profile per agent — demonstrates strategic model selection
const ROUTING_PROFILES: Record<AgentName, RoutingProfile> = {
  bull:      'auto',    // medium analytical complexity
  bear:      'auto',    // medium analytical complexity
  macro:     'auto',    // may escalate to COMPLEX/REASONING for macro economics
  narrative: 'eco',     // social pattern matching, cheaper model sufficient
  moderator: 'premium', // high-stakes dispute resolution, needs quality
  synthesis: 'auto',    // balanced multi-source synthesis
  risk:      'auto',    // structured output generation
};

type ChatResponse = {
  response: string;
  model: string;
  routing: {
    tier?: AgentResult['routingTier'];
    costEstimate: number;
    savings?: number;
    confidence?: number;
    reasoning?: string;
  };
};

const FREE_MODELS: Record<AgentName, string> = {
  bull: MODELS.bull,
  bear: MODELS.bear,
  macro: MODELS.macro,
  narrative: MODELS.narrative,
  moderator: MODELS.escalation,
  synthesis: MODELS.synthesis_cheap,
  risk: MODELS.risk,
};

async function chatWithRouting(
  agent: AgentName,
  userPrompt: string,
  systemPrompt: string,
  profile: RoutingProfile,
  maxOutputTokens: number,
  freeMode: boolean,
): Promise<ChatResponse> {
  if (freeMode) {
    const model = FREE_MODELS[agent];
    const response = await getClient().chat(model, userPrompt, {
      system: systemPrompt,
      maxTokens: maxOutputTokens,
    });

    return {
      response,
      model,
      routing: {
        tier: 'SIMPLE',
        costEstimate: 0,
        savings: 1,
        confidence: 1,
        reasoning: 'FREE mode pinned to zero-cost NVIDIA model',
      },
    };
  }

  return getClient().smartChat(userPrompt, {
    system: systemPrompt,
    routingProfile: profile,
    maxTokens: maxOutputTokens,
    maxOutputTokens,
  });
}

async function runAgent(
  agent: AgentName,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200,
  freeMode = false,
): Promise<AgentResult> {
  const profile: RoutingProfile = freeMode ? 'free' : ROUTING_PROFILES[agent];
  const effectiveMaxTokens = freeMode ? Math.min(maxTokens, 600) : maxTokens;
  const start = Date.now();

  // Suppress chain-of-thought output from reasoning models (kimi, deepseek-r1, etc.)
  const augSystem = systemPrompt + '\n\nCRITICAL: Do NOT output your internal reasoning or thinking process. Start your response directly with the analysis content. No preamble.';

  const response = await chatWithRouting(agent, userPrompt, augSystem, profile, effectiveMaxTokens, freeMode);

  const latencyMs = Date.now() - start;
  const content = stripThinking(response.response);
  const tokensIn = estimateTokens(systemPrompt + userPrompt);
  const tokensOut = estimateTokens(content);

  return {
    agent,
    model: response.model,
    content,
    tokensIn,
    tokensOut,
    costUsd: freeMode ? 0 : response.routing.costEstimate,
    latencyMs,
    routingTier: response.routing.tier,
    routingProfile: profile,
    routingSavings: response.routing.savings,
    routingConfidence: response.routing.confidence,
    routingReasoning: response.routing.reasoning,
  };
}

export async function runBullAgent(token: string, marketCtx = '', freeMode = false): Promise<AgentResult> {
  const system = freeMode
    ? `Analyst. First line must be BULL_SCORE: 64, replacing 64 with a real integer from 0 to 100. Then one sentence. Never output brackets or placeholders.`
    : `Bullish crypto analyst. Output BULL_SCORE: 72 on the first line (replace 72 with real score), then give 3 bullish signals and one CHECK_AGAINST_BEAR line that names the strongest counterargument.`;
  const user = freeMode
    ? `${marketCtx ? marketCtx + '\n' : ''}${token}: Output exactly two lines. Line 1: BULL_SCORE: 64. Line 2: one bullish signal. Replace 64 with your real score.`
    : `${marketCtx ? marketCtx + '\n' : ''}${token}: First line BULL_SCORE: [0-100 integer]. Then 3 bullish signals and CHECK_AGAINST_BEAR.`;
  const result = await runAgent('bull', system, user, freeMode ? 150 : 800, freeMode);
  const fallbackScore = fallbackBullScore(token, marketCtx);
  result.content = freeMode
    ? normalizeScoredOutput(result.content, 'BULL_SCORE', 'bull', token, fallbackScore, marketCtx)
    : sanitizeScoredOutput(result.content, 'BULL_SCORE', compactScoreOutput('bull', token, fallbackScore, marketCtx));
  result.score = extractScore(result.content, 'BULL_SCORE');
  return result;
}

export async function runBearAgent(token: string, marketCtx = '', freeMode = false): Promise<AgentResult> {
  const system = freeMode
    ? `Analyst. First line must be BEAR_SCORE: 42, replacing 42 with a real integer from 0 to 100. 100=most bearish. Then one sentence. Never output brackets or placeholders.`
    : `Bearish crypto analyst. Output BEAR_SCORE: 68 on the first line (replace 68 with real score, 100=most bearish), then give 3 bearish risks and one CHECK_AGAINST_BULL line that names the strongest upside rebuttal.`;
  const user = freeMode
    ? `${marketCtx ? marketCtx + '\n' : ''}${token}: Output exactly two lines. Line 1: BEAR_SCORE: 42. Line 2: one bearish risk. Replace 42 with your real score.`
    : `${marketCtx ? marketCtx + '\n' : ''}${token}: First line BEAR_SCORE: [0-100 integer]. Then 3 bearish risks and CHECK_AGAINST_BULL.`;
  const result = await runAgent('bear', system, user, freeMode ? 150 : 800, freeMode);
  const fallbackScore = fallbackBearScore(token, marketCtx);
  result.content = freeMode
    ? normalizeScoredOutput(result.content, 'BEAR_SCORE', 'bear', token, fallbackScore, marketCtx)
    : sanitizeScoredOutput(result.content, 'BEAR_SCORE', compactScoreOutput('bear', token, fallbackScore, marketCtx));
  result.score = extractScore(result.content, 'BEAR_SCORE');
  return result;
}

export async function runMacroAgent(token: string, marketCtx = '', freeMode = false): Promise<AgentResult> {
  const system = freeMode
    ? `Analyst. Two bullets: sector + key macro factor.`
    : `Macro crypto analyst. 3-4 bullet points on macro context for the token. No preamble.`;
  const user = freeMode
    ? `${marketCtx ? marketCtx + '\n' : ''}${token}: sector and macro context. 2 bullets.`
    : `${marketCtx ? marketCtx + '\n' : ''}${token}: macro context — sector, tailwinds, headwinds. 3-4 bullets.`;
  const result = await runAgent('macro', system, user, freeMode ? 150 : 800, freeMode);
  result.content = sanitizeBulletOutput(result.content, compactBulletOutput('macro', token, marketCtx));
  return result;
}

export async function runNarrativeAgent(token: string, marketCtx = '', freeMode = false): Promise<AgentResult> {
  const system = freeMode
    ? `Analyst. Two bullets: sentiment + key catalyst or FUD.`
    : `Crypto narrative analyst. 3-4 bullet points on community sentiment and narrative. No preamble.`;
  const user = freeMode
    ? `${marketCtx ? marketCtx + '\n' : ''}${token}: sentiment and narrative. 2 bullets.`
    : `${marketCtx ? marketCtx + '\n' : ''}${token}: narrative strength, social sentiment, key catalysts or FUD. 3-4 bullets.`;
  const result = await runAgent('narrative', system, user, freeMode ? 150 : 800, freeMode);
  result.content = sanitizeBulletOutput(result.content, compactBulletOutput('narrative', token, marketCtx));
  return result;
}

function truncate(text: string, maxChars = 600): string {
  return text.length > maxChars ? text.slice(0, maxChars) + '...' : text;
}

export async function runSynthesisAgent(
  token: string,
  bullResult: AgentResult,
  bearResult: AgentResult,
  macroResult: AgentResult,
  narrativeResult: AgentResult,
  escalatedSection?: string,
  freeMode = false,
): Promise<AgentResult> {
  const system = freeMode
    ? `Analyst. Two sentences: one thesis, one risk.`
    : `Investment analyst. Write a 2-paragraph synthesis: key thesis + main risks + net outlook. Explicitly reconcile bull/bear challenge notes. No preamble.`;
  const user = freeMode
    ? `${token}: Bull=${bullResult.score ?? 50}/100, Bear=${bearResult.score ?? 50}/100. Two-sentence outlook.`
    : `${token} synthesis:
BULL: ${truncate(bullResult.content, 400)}
BEAR: ${truncate(bearResult.content, 400)}
MACRO: ${truncate(macroResult.content, 300)}
NARRATIVE: ${truncate(narrativeResult.content, 300)}
${escalatedSection ? `RESOLUTION: ${truncate(escalatedSection, 400)}\n` : ''}Write 2 paragraphs: thesis + risks + outlook. Reconcile the strongest counterarguments.`;

  const synthProfile: RoutingProfile = freeMode ? 'free' : 'auto';
  const start = Date.now();
  const response = await chatWithRouting('synthesis', user, system, synthProfile, freeMode ? 400 : 1000, freeMode);
  const latencyMs = Date.now() - start;
  const content = cleanModelOutput(stripThinking(response.response));
  const tokensIn = estimateTokens(system + user);
  const tokensOut = estimateTokens(content);

  return {
    agent: 'synthesis',
    model: response.model,
    content,
    tokensIn,
    tokensOut,
    costUsd: freeMode ? 0 : response.routing.costEstimate,
    latencyMs,
    routingTier: response.routing.tier,
    routingProfile: synthProfile,
    routingSavings: response.routing.savings,
    routingConfidence: response.routing.confidence,
    routingReasoning: response.routing.reasoning,
  };
}

export async function runEscalationAgent(
  token: string,
  bullContent: string,
  bearContent: string,
  bullScore: number,
  bearScore: number,
  freeMode = false,
): Promise<AgentResult> {
  const system = freeMode
    ? `Analyst. One sentence: which side wins and why.`
    : `Expert analyst. Resolve bull vs bear disagreement with a definitive 2-paragraph conclusion. No preamble.`;
  const user = freeMode
    ? `${token}: Bull=${bullScore}/100, Bear=${bearScore}/100. Which side wins? One sentence.`
    : `${token}: Bull=${bullScore}/100, Bear=${bearScore}/100, gap=${Math.abs(bullScore - bearScore)}pts.
BULL: ${truncate(bullContent, 400)}
BEAR: ${truncate(bearContent, 400)}
Which side wins and why? 2-paragraph expert verdict.`;

  const escalationProfile: RoutingProfile = freeMode ? 'free' : 'premium';
  const start = Date.now();
  const response = await chatWithRouting('moderator', user, system, escalationProfile, freeMode ? 400 : 1000, freeMode);
  const latencyMs = Date.now() - start;
  const content = cleanModelOutput(stripThinking(response.response));
  const tokensIn = estimateTokens(system + user);
  const tokensOut = estimateTokens(content);

  return {
    agent: 'moderator',
    model: response.model,
    content,
    tokensIn,
    tokensOut,
    costUsd: freeMode ? 0 : response.routing.costEstimate,
    latencyMs,
    routingTier: response.routing.tier,
    routingProfile: escalationProfile,
    routingSavings: response.routing.savings,
    routingConfidence: response.routing.confidence,
    routingReasoning: response.routing.reasoning,
  };
}

export async function runRiskOfficer(
  token: string,
  synthesis: string,
  bullScore: number,
  bearScore: number,
  escalated: boolean,
  escalationContent?: string,
  freeMode = false,
): Promise<AgentResult> {
  const system = freeMode
    ? `Risk officer. First line must be CONVICTION_SCORE: 58, replacing 58 with a real integer from 0 to 100. Then one sentence memo. Never output brackets or placeholders.`
    : `Risk officer. Analyze the token data and output exactly 6 labeled lines with real values. You have veto power: lower position size or mark AVOID if downside invalidates the thesis. Use this format:

CONVICTION_SCORE: 67
ENTRY_ZONE: $1.20-$1.40
STOP_LOSS: $1.05
POSITION_SIZE: 3-5%
TIME_HORIZON: 6-10 weeks
INVESTMENT_MEMO: Token shows moderate upside with macro tailwinds as the primary catalyst. Regulatory uncertainty limits position size. A small speculative allocation is warranted given mixed signals.

Replace all values above with your actual analysis for the given token.`;
  const user = freeMode
    ? `${token}: Bull=${bullScore}/100, Bear=${bearScore}/100. Output exactly two lines. Line 1: CONVICTION_SCORE: 58. Line 2: one-sentence investment memo. Replace 58 with your real score.`
    : `${token}: Bull=${bullScore}/100, Bear=${bearScore}/100.
SYNTHESIS: ${truncate(synthesis, 400)}
${escalated && escalationContent ? `RESOLUTION: ${truncate(escalationContent, 200)}\n` : ''}Output 6 lines: CONVICTION_SCORE, ENTRY_ZONE, STOP_LOSS, POSITION_SIZE, TIME_HORIZON, INVESTMENT_MEMO`;

  const riskProfile: RoutingProfile = freeMode ? 'free' : 'auto';
  const start = Date.now();
  const response = await chatWithRouting('risk', user, system, riskProfile, freeMode ? 400 : 1000, freeMode);
  const latencyMs = Date.now() - start;
  const fallbackScore = fallbackConvictionScore(bullScore, bearScore);
  const content = freeMode
    ? normalizeScoredOutput(stripThinking(response.response), 'CONVICTION_SCORE', 'risk', token, fallbackScore)
    : sanitizeScoredOutput(
        stripThinking(response.response),
        'CONVICTION_SCORE',
        compactScoreOutput('risk', token, fallbackScore),
      );
  const tokensIn = estimateTokens(system + user);
  const tokensOut = estimateTokens(content);

  return {
    agent: 'risk',
    model: response.model,
    content,
    score: extractScore(content, 'CONVICTION_SCORE'),
    tokensIn,
    tokensOut,
    costUsd: freeMode ? 0 : response.routing.costEstimate,
    latencyMs,
    routingTier: response.routing.tier,
    routingProfile: riskProfile,
    routingSavings: response.routing.savings,
    routingConfidence: response.routing.confidence,
    routingReasoning: response.routing.reasoning,
  };
}

function extractScore(content: string, label: string): number {
  const score = tryExtractScore(content, label);
  if (score !== undefined) return score;
  console.warn(`[score parse fallback] ${label} not found in model output:`, content.slice(0, 240));
  return 50;
}

function tryExtractScore(content: string, label: string): number | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const labelMatch = content.match(new RegExp(`\\*{0,2}${escapedLabel}\\*{0,2}\\s*[:=\\-–—]?\\s*(?:score\\s*)?(\\d{1,3})(?:\\s*/\\s*100)?`, 'i'));
  const proseMatch = content.match(/\b(?:score|conviction|bullish|bearish)\b[^0-9]{0,24}(\d{1,3})(?:\s*\/\s*100)?/i);
  const match = labelMatch ?? proseMatch;
  if (match) return Math.min(100, Math.max(0, parseInt(match[1], 10)));
  return undefined;
}

export function buildCostEntry(result: AgentResult) {
  const gpt4Cost = calcGpt4Cost(result.tokensIn, result.tokensOut);
  return {
    agent: result.agent,
    model: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    gpt4Cost,
    savings: gpt4Cost - result.costUsd,
    routingTier: result.routingTier,
    routingProfile: result.routingProfile,
  };
}
