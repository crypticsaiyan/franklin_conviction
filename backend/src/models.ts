// FREE_MODE=false → paid deepseek + claude escalation (fund wallet at blockrun.ai)
// FREE_MODE=true (default) → free nvidia models, $0 cost
const FREE_MODE = process.env.FREE_MODE !== 'false';

const DEEPSEEK_PAID = 'deepseek/deepseek-chat';
const DEEPSEEK_FREE = 'nvidia/deepseek-v4-flash'; // same upstream, $0

export const MODELS = {
  bull: FREE_MODE ? DEEPSEEK_FREE : DEEPSEEK_PAID,
  bear: FREE_MODE ? DEEPSEEK_FREE : DEEPSEEK_PAID,
  macro: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  narrative: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  synthesis_cheap: FREE_MODE ? DEEPSEEK_FREE : DEEPSEEK_PAID,
  escalation: FREE_MODE ? 'nvidia/qwen3-next-80b-a3b-thinking' : 'anthropic/claude-sonnet-4-6',
  risk: FREE_MODE ? DEEPSEEK_FREE : DEEPSEEK_PAID,
};

export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'deepseek/deepseek-chat': { input: 0.20, output: 0.40 },
  'nvidia/deepseek-v4-flash': { input: 0, output: 0 },
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning': { input: 0, output: 0 },
  'nvidia/qwen3-next-80b-a3b-thinking': { input: 0, output: 0 },
  'anthropic/claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'openai/gpt-4o': { input: 5.0, output: 15.0 },
};

export const GPT4_PRICE = { input: 5.0, output: 15.0 };

export function calcCost(model: string, tokensIn: number, tokensOut: number): number {
  const price = MODEL_PRICES[model] ?? { input: 1.0, output: 3.0 };
  return (tokensIn / 1_000_000) * price.input + (tokensOut / 1_000_000) * price.output;
}

export function calcGpt4Cost(tokensIn: number, tokensOut: number): number {
  return (tokensIn / 1_000_000) * GPT4_PRICE.input + (tokensOut / 1_000_000) * GPT4_PRICE.output;
}
