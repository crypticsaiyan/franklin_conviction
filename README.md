# Franklin Conviction Engine

**Franklin Agent Hackathon submission.** Autonomous crypto investment committee built natively on the Franklin harness: multi-agent debate, conditional premium escalation, live Pyth market data, and per-agent routing profiles that show smart routing in action.

![Desktop demo](franklin-demo-desktop.png)

---

## Quick Start

```bash
npm run install:all
npm run dev
```

Open `http://localhost:5173`. Backend on `http://localhost:3001`.

**No wallet required for replay mode or free-mode runs.**

---

## Judge Flow

1. Click **SOL arbitration run** or **ONDO free-mode run** for instant replay.
2. Or enter a token (`SOL`, `ARB`, `DOGE`, `ONDO`) and press EXECUTE.
3. Open the **Routing Audit** table to see per-agent profile, tier, model, and savings.
4. Toggle the mode switch (top-right) between FREE and SMART routing.

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a 90-second judging walk-through.

---

## Why It Fits Franklin

| Criterion | How the app demonstrates it |
|---|---|
| Technical execution | SSE orchestration, parallel agent execution, live PriceClient market data, deterministic replay mode |
| Innovation | Adversarial bull/bear committee with a conditional arbitration gate and risk veto on position sizing |
| Efficient Franklin routing | Each agent uses an explicit routing profile; arbitration fires premium only when disagreement exceeds 30 points |

---

## What It Does

Enter a crypto asset. Seven agents run in pipeline order:

```
TARGET TOKEN
  |
  +-- live PriceClient (Pyth price, pre-prompt context)
  |
  +-- parallel scouts [4 agents]
  |     +-- Bull analyst
  |     +-- Bear analyst
  |     +-- Macro analyst
  |     +-- Narrative analyst
  |
  +-- challenge gate
  |     +-- if bull/bear disagreement > 30 points: escalate to Arbitrator
  |
  +-- Synthesis agent
  |
  +-- Risk Officer
        +-- conviction score
        +-- entry zone
        +-- stop loss
        +-- position size
        +-- time horizon
        +-- investment memo
```

---

## Franklin Routing Strategy

Each agent uses an explicit routing policy chosen by task type:

| Agent | Live profile | Free-mode model | Why |
|---|---|---|---|
| Bull | `auto` | `nvidia/deepseek-v4-flash` | Medium analysis, capable cheap model |
| Bear | `auto` | `nvidia/deepseek-v4-flash` | Same as bull, downside framing |
| Macro | `auto` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Broader reasoning may be needed |
| Narrative | `eco` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Social pattern matching stays cheap |
| Arbitrator | `premium` | `nvidia/qwen3-next-80b-a3b-thinking` | Only used for high-stakes dispute resolution |
| Synthesis | `auto` | `nvidia/deepseek-v4-flash` | Multi-source merge, balanced |
| Risk Officer | `auto` | `nvidia/deepseek-v4-flash` | Structured output generation |

The Arbitrator fires only when the bull/bear gap exceeds 30 points. On consensus runs it never calls. Premium cost on those runs is zero.

The Routing Audit table in the UI shows each agent with: profile, tier, selected model, why Franklin routed it there, actual cost, GPT-4 baseline, and savings percentage.

---

## Autonomous Behavior

- **Parallel scouting:** bull, bear, macro, and narrative agents run concurrently.
- **Counterargument discipline:** each side is prompted to name the strongest opposing argument.
- **Disagreement threshold:** bull/bear gap above 30 points routes to the Arbitrator.
- **Risk veto:** the Risk Officer can reduce position size or mark the trade as avoid-worthy.
- **Cost-aware routing:** cheap/free models handle routine work; premium is reserved for dispute resolution.

---

## Key Features

- One-click judge demos via replay mode (no wallet, no API latency)
- Live market context from BlockRun PriceClient (Pyth-backed)
- Streaming SSE so each agent state updates in real time
- Per-agent cost ledger with GPT-4 baseline and savings percentage
- FREE mode toggle pins all calls to zero-cost NVIDIA models
- SMART mode uses Franklin routing profiles with conditional premium escalation
- Routing Audit, Autonomy Map, Conviction Gauge, Thermal Receipt in the UI

---

## Architecture

```
franklin-conviction/
  backend/
    src/
      index.ts      Express SSE API and pipeline orchestration
      agents.ts     Agent prompts, routing profile policy, free-mode model pins
      data.ts       BlockRun PriceClient market data
      models.ts     Model choices and GPT-4 baseline pricing
      types.ts      Backend contracts

  frontend/
    src/
      App.tsx                 Judge flow, state machine, SSE consumer
      demoRuns.ts             Deterministic hackathon replay data
      components/
        AgentBento.tsx        Live agent grid
        ActivityLog.tsx       Streaming event log
        MarketDataBar.tsx     Live price context banner
        ConvictionGauge.tsx   Final conviction score
        InvestmentMemo.tsx    Risk officer output
        CostTicker.tsx        Live cost/savings summary
        Receipt.tsx           Thermal cost receipt
        DisagreementAlert.tsx Bull/bear gap alert
```

---

## Prerequisites

- Node.js 20+
- `BASE_CHAIN_WALLET_KEY` for live smart routing (load from `~/.blockrun/.session`)
- No wallet required for replay mode or free-mode runs

---

## Live vs Free Mode

**Free mode** (default): all LLM calls route to zero-cost NVIDIA model IDs. No wallet needed. Good for judge demos and offline evaluation.

**Smart mode**: uses Franklin routing profiles. Cheap models handle routine agents. Premium routing fires for the Arbitrator only when the disagreement gap exceeds the threshold. A full smart-mode run with no arbitration costs under $0.01.

---

## Built With

- `@blockrun/llm` (`LLMClient.smartChat`, `PriceClient`)
- Express + TypeScript ESM
- Server-Sent Events
- React + Vite
- Framer Motion

---

## Disclaimer

Hackathon project. Not financial advice. LLM agent outputs are research scaffolding, not trading instructions.
