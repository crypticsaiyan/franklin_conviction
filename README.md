# Franklin Conviction Engine

Autonomous crypto investment committee built on the Franklin/BlockRun harness. Seven specialized agents debate a token, a conditional arbitration gate fires on disagreement, and a Risk Officer issues a final conviction score with position sizing.

![Desktop demo](franklin-demo-desktop.png)

---

## Quick Start

```bash
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:3001`

**No wallet required for FREE mode or replay demos.**

---

## How It Works

Enter a crypto token. The pipeline runs:

```
TOKEN
  |
  +-- PriceClient (live Pyth price)
  |
  +-- parallel scouts
  |     +-- Bull analyst
  |     +-- Bear analyst
  |     +-- Macro analyst
  |     +-- Narrative analyst
  |
  +-- disagreement gate
  |     +-- gap > 30pts → Arbitrator (premium model)
  |
  +-- Synthesis agent
  |
  +-- Risk Officer
        +-- conviction score, entry zone, stop loss, position size, time horizon
```

---

## Wallet Key

Each user supplies their own Franklin wallet key in the UI. It is sent per-request and used only for that analysis — never stored server-side. FREE mode requires no key (all calls route to zero-cost NVIDIA models).

To get a key: [blockrun.ai](https://blockrun.ai)

---

## Routing Strategy

| Agent | Profile | Free-mode model | Why |
|---|---|---|---|
| Bull | `auto` | `nvidia/deepseek-v4-flash` | Medium analysis |
| Bear | `auto` | `nvidia/deepseek-v4-flash` | Downside framing |
| Macro | `auto` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Broader reasoning |
| Narrative | `eco` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Sentiment, stays cheap |
| Arbitrator | `premium` | `nvidia/qwen3-next-80b-a3b-thinking` | High-stakes dispute only |
| Synthesis | `auto` | `nvidia/deepseek-v4-flash` | Multi-source merge |
| Risk Officer | `auto` | `nvidia/deepseek-v4-flash` | Structured output |

Arbitrator fires only when bull/bear gap exceeds 30 points — premium cost is zero on consensus runs.

---

## Key Features

- Bring-your-own Franklin key — no shared API credentials
- One-click replay demos (no wallet, no latency)
- Live market context via BlockRun PriceClient (Pyth-backed)
- Streaming SSE — each agent updates in real time
- Per-agent cost ledger with GPT-4 baseline and savings %
- FREE mode: zero-cost NVIDIA models, no key needed
- SMART mode: Franklin routing profiles, conditional premium escalation
- Routing Audit, Conviction Gauge, Autonomy Map, Thermal Receipt

---

## Architecture

```
franklin-conviction/
  backend/
    src/
      index.ts    Express SSE API, pipeline orchestration, per-request key handling
      agents.ts   Agent prompts, routing profiles, free-mode model pins
      data.ts     BlockRun PriceClient market data
      models.ts   Model registry and GPT-4 baseline pricing
      types.ts    Shared backend types

  frontend/
    src/
      App.tsx                 State machine, SSE consumer, key input
      demoRuns.ts             Deterministic replay data
      components/
        AgentBento.tsx        Live agent grid
        ActivityLog.tsx       Streaming event log
        MarketDataBar.tsx     Live price banner
        ConvictionGauge.tsx   Final conviction score
        InvestmentMemo.tsx    Risk officer output
        CostTicker.tsx        Live cost/savings ticker
        Receipt.tsx           Thermal cost receipt
        DisagreementAlert.tsx Bull/bear gap alert
```

---

## Prerequisites

- Node.js 20+
- Franklin wallet key for SMART mode (get one at blockrun.ai)
- No key needed for FREE mode or replay demos

---

## Built With

- `@blockrun/llm` — `LLMClient`, `PriceClient`
- Express + TypeScript ESM
- Server-Sent Events
- React + Vite + Framer Motion

---

## License

MIT — see [LICENSE](LICENSE)

---

## Disclaimer

Not financial advice. LLM outputs are research scaffolding, not trading instructions.
