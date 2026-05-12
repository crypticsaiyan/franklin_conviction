export type AgentName = 'bull' | 'bear' | 'macro' | 'narrative' | 'moderator' | 'synthesis' | 'risk';

export type RoutingTier = 'SIMPLE' | 'MEDIUM' | 'COMPLEX' | 'REASONING';
export type RoutingProfile = 'free' | 'eco' | 'auto' | 'premium';

export interface AgentResult {
  agent: AgentName;
  model: string;
  content: string;
  score?: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  routingTier?: RoutingTier;
  routingProfile?: RoutingProfile;
  routingSavings?: number;
  routingConfidence?: number;
  routingReasoning?: string;
}

export interface CostEntry {
  agent: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  gpt4Cost: number;
  savings: number;
  routingTier?: string;
  routingProfile?: string;
}

export interface FinalVerdict {
  freeMode?: boolean;
  token: string;
  convictionScore: number;
  bullSummary: string;
  bearSummary: string;
  macroContext: string;
  narrativeSentiment: string;
  investmentMemo: string;
  escalated: boolean;
  escalationReason?: string;
  costBreakdown: CostEntry[];
  totalCost: number;
  totalGpt4Cost: number;
  totalSavings: number;
  entryZone?: string;
  stopLoss?: string;
  positionSize?: string;
  timeHorizon?: string;
  totalRoutingSavings?: number;
}

export type SSEEventType =
  | 'agent_start'
  | 'agent_complete'
  | 'disagreement_detected'
  | 'escalation_start'
  | 'escalation_complete'
  | 'synthesis_start'
  | 'synthesis_complete'
  | 'risk_start'
  | 'risk_complete'
  | 'final'
  | 'error'
  | 'data_fetched';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}
