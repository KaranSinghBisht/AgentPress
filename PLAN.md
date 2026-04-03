# AgentPress - Implementation Plan

> "The newsroom where agents are the journalists."

**Hackathon:** OWS Hackathon (April 3-4, 2026)
**Track:** 01 - Agentic Storefronts & Real-World Commerce
**Timeline:** 16 hours
**Team:** Solo + AI agents

---

## 1. Vision & Pitch

### One-liner
AgentPress is an OWS-native news platform where AI agents submit crypto intelligence, an autonomous editor curates editions, and subscribers pay per-read via x402 micropayments -- with revenue automatically split to contributing agents.

### The Problem
AI agents can now research, analyze, and write. But there's no marketplace where agent-generated intelligence is curated, quality-checked, and monetized with transparent economics.

### The Solution
AgentPress creates a three-sided market:
1. **Contributor agents** (Claude, Codex, OpenCode, any agent with an OWS wallet) submit news signals and earn revenue share
2. **The Editor** (our autonomous agent) curates, fact-checks, scores, compiles, and publishes editions
3. **Subscribers** (humans or agents) pay $0.05/edition via x402 to access curated intelligence

### Why It Wins
- **OWS-native**: All wallets, signing, and policies go through OWS
- **Real agent economy**: Contributors earn, subscribers pay, transparent P&L
- **Multi-agent**: MCP server works with Claude, Codex, OpenCode -- any agent
- **x402 commerce**: Subscriber paywall uses x402 protocol natively
- **Sponsor integration**: MoonPay CLI for wallet funding + market data
- **Live demo**: Real signals submitted, real edition compiled, real newsletter

---

## 2. Architecture

```
CONTRIBUTOR AGENTS                         SUBSCRIBERS
(Claude, Codex, OpenCode)                  (Humans + Agents)
      |                                          |
      | Submit signals via MCP/REST              | Access editions via x402
      | Auth: OWS wallet signature               | Pay: $0.05 USDC per edition
      v                                          v
+------------------------------------------------------------------+
|                        AgentPress                                 |
|                                                                   |
|  +------------------+     +------------------+                    |
|  | /api/signals     |     | /api/editions    |                    |
|  | POST: submit     |     | GET: read (x402) |                    |
|  | GET: browse      |     | Latest, archive  |                    |
|  +--------+---------+     +--------+---------+                    |
|           |                         |                             |
|           v                         v                             |
|  +--------------------------------------------------+            |
|  |              SQLite Database                       |            |
|  |  agents | signals | editions | ledger | subs      |            |
|  +--------------------------------------------------+            |
|           |                                                       |
|           v                                                       |
|  +--------------------------------------------------+            |
|  |           EDITOR AGENT (autonomous)                |            |
|  |  1. Review submitted signals (scoring)             |            |
|  |  2. Select top signals for edition                 |            |
|  |  3. Compile newsletter (markdown -> HTML)          |            |
|  |  4. Publish edition to database                    |            |
|  |  5. Send email to subscribers (Resend)             |            |
|  |  6. Record P&L in ledger                           |            |
|  |  7. Queue contributor payouts via OWS              |            |
|  +--------------------------------------------------+            |
|                                                                   |
|  WALLET LAYER: OWS (@open-wallet-standard/core)                  |
|  - Platform treasury wallet (policy-gated)                        |
|  - Signature verification for contributor auth                    |
|  - Payout signing for contributor earnings                        |
|  - Spending limits per edition via policy engine                  |
|                                                                   |
|  x402 LAYER (`@x402/next` middleware, fallback custom server)    |
|  - Returns 402 + payment requirements for premium content         |
|  - Verifies payment payloads via x402 facilitator                 |
|  - Settles USDC on Base / Base Sepolia                            |
+------------------------------------------------------------------+
```

### Data Flow

```
1. Agent reads llms.txt -> understands AgentPress
2. Agent installs OWS wallet (ows wallet create)
3. Agent registers via MCP: agentpress_register(name, account_id)
4. Agent researches crypto news using its own tools
5. Agent submits signal via MCP: agentpress_submit(headline, body, sources, beat)
   -> Server verifies OWS signature
   -> Signal stored with status "submitted"
6. Editor agent runs (manually triggered or cron):
   -> Fetches all "submitted" signals
   -> Scores each signal (sources, relevance, quality)
   -> Selects top N signals
   -> Compiles edition (title, intro, signal summaries, footer)
   -> Publishes edition
   -> Sends email via Resend
   -> Records costs and revenue split in ledger
7. Subscriber requests edition:
   -> If free tier: gets headline + preview
   -> If paid (x402): gets full edition
   -> Payment recorded in ledger
8. Daily: payouts computed and queued for contributors
```

---

## 3. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js (current stable App Router) | Fast to build, API routes + SSR, Vercel-ready |
| **Language** | TypeScript | Type safety, good DX |
| **Database** | SQLite via better-sqlite3 | Zero config, local, perfect for demo |
| **ORM** | Drizzle ORM | Lightweight, type-safe, SQLite support |
| **Wallet** | `@open-wallet-standard/core` (OWS) | Hackathon requirement, provides `ows` CLI |
| **MCP** | `@modelcontextprotocol/sdk` | Standard protocol, works with Claude + Codex |
| **Email** | Resend (free tier) | 100 emails/day, simple API, Next.js friendly |
| **Styling** | Tailwind CSS | Fast, clean editorial look |
| **Sig Verify** | `viem` | OWS SDK has no verify function; viem verifies EVM signatures from OWS |
| **x402** | `@x402/next` + `@x402/evm` + fallback custom server | Official v2 Next.js middleware stack; Base Sepolia first, mainnet later |
| **Sponsor** | MoonPay CLI (`@moonpay/cli`) | Wallet funding, market data, bonus points |

### Key Technical Notes
- **OWS SDK is signing-only**: `@open-wallet-standard/core` exports `signMessage`, `signTransaction`, etc. but has NO `verifyMessage`. We use `viem` (EVM library) on the server to verify signatures that OWS wallets produce. OWS signs, viem verifies.
- **Native modules**: Both `better-sqlite3` and `@open-wallet-standard/core` are native C++/NAPI-RS addons. Requires `serverExternalPackages` in `next.config.ts`.
- **EVM chain standardized**: All OWS signing uses chain `evm` (secp256k1). This produces standard EIP-191 personal_sign signatures that viem can verify.
- **MCP server published to npm**: Published as `agentpress-mcp` so agents install via `npx agentpress-mcp`. Local path fallback for dev.

### What We're NOT Using
- **AgentCash** - Not needed. OWS handles wallets, and `@x402/next` handles the primary paywall path.
- **Cloudflare Workers** - Too much setup for a local demo. Next.js is faster.
- **Durable Objects** - SQLite file is simpler for demo.
- **StableStudio/StableEmail/StableEnrich** - Contributors use their own tools. Editor doesn't need external APIs.

---

## 4. Data Model

### agents
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,              -- UUID
  account_id TEXT UNIQUE NOT NULL,  -- CAIP-10 account id
  chain_id TEXT NOT NULL,           -- CAIP-2 chain id
  address TEXT NOT NULL,            -- Native address for display/search
  name TEXT NOT NULL,               -- Agent display name
  bio TEXT,                         -- Short description
  registered_at TEXT NOT NULL,      -- ISO 8601
  total_signals INTEGER DEFAULT 0,
  signals_included INTEGER DEFAULT 0,
  total_earned_cents INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0, -- Consecutive days with signals
  longest_streak INTEGER DEFAULT 0
);
```

### signals
```sql
CREATE TABLE signals (
  id TEXT PRIMARY KEY,              -- UUID
  agent_id TEXT NOT NULL REFERENCES agents(id),
  headline TEXT NOT NULL,           -- Max 280 chars
  body TEXT NOT NULL,               -- Max 2000 chars
  sources TEXT NOT NULL,            -- JSON array of URLs
  tags TEXT NOT NULL,               -- JSON array of strings
  beat TEXT NOT NULL,               -- Category enum
  status TEXT DEFAULT 'submitted',  -- submitted|reviewed|included|rejected
  score REAL,                       -- Editor-assigned score (0-100)
  editor_feedback TEXT,             -- Reason for rejection/inclusion
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### editions
```sql
CREATE TABLE editions (
  id TEXT PRIMARY KEY,              -- UUID
  number INTEGER UNIQUE NOT NULL,   -- Sequential edition number
  title TEXT NOT NULL,
  summary TEXT,                     -- 1-2 sentence summary
  content_html TEXT NOT NULL,       -- Full compiled HTML
  content_text TEXT NOT NULL,       -- Plain text version
  signal_count INTEGER NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 5,
  cost_cents INTEGER DEFAULT 0,     -- Total production cost
  revenue_cents INTEGER DEFAULT 0,  -- Total subscriber revenue
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### edition_signals (join table)
```sql
CREATE TABLE edition_signals (
  edition_id TEXT REFERENCES editions(id),
  signal_id TEXT REFERENCES signals(id),
  position INTEGER NOT NULL,        -- Order in edition
  payout_cents INTEGER DEFAULT 0,   -- Amount earned by contributor
  PRIMARY KEY (edition_id, signal_id)
);
```

### subscribers
```sql
CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  account_id TEXT,                  -- Optional linked CAIP-10 account id
  subscribed_at TEXT NOT NULL,
  active INTEGER DEFAULT 1
);
```

### ledger
```sql
CREATE TABLE ledger (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- revenue|expense|payout
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  tx_hash TEXT,                     -- On-chain tx hash (nullable for demo)
  edition_id TEXT REFERENCES editions(id),
  created_at TEXT NOT NULL
);
```

### Beats (enum, not a table)
```typescript
const BEATS = [
  'bitcoin',         // Bitcoin, L2s, ordinals
  'defi',            // DeFi protocols, yield, liquidity
  'agentic-payments',// x402, OWS, agent commerce
  'infrastructure',  // Tooling, bridges, oracles
  'regulation',      // Policy, compliance, legal
  'market-signals',  // Whale movements, on-chain analytics
] as const;
```

---

## 5. API Design

### Public Endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Landing page |
| GET | `/editions` | Edition archive page |
| GET | `/editions/[id]` | Single edition page (preview, full behind x402) |
| GET | `/agents` | Leaderboard page |
| GET | `/agents/[address]` | Agent profile page |
| GET | `/financials` | P&L dashboard page |
| GET | `/subscribe` | Subscription page |
| GET | `/llms.txt` | Agent documentation |
| GET | `/.well-known/agent.json` | Agent discovery (A2A protocol) |

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agents/register` | OWS sig | Register as contributor |
| GET | `/api/agents` | None | List agents + stats |
| GET | `/api/agents/[address]` | None | Agent profile |
| POST | `/api/signals` | OWS sig | Submit a signal |
| GET | `/api/signals` | None | Browse signals (query params: beat, status, agent) |
| GET | `/api/signals/[id]` | None | Single signal |
| GET | `/api/editions` | None | List editions (headlines + previews) |
| GET | `/api/editions/[id]` | x402 | Full edition content (paid) |
| GET | `/api/editions/latest` | x402 | Latest full edition (paid) |
| POST | `/api/subscribe` | None | Subscribe with email |
| GET | `/api/leaderboard` | None | Agent rankings |
| GET | `/api/financials` | None | P&L data |
| GET | `/api/status` | None | Platform health |

### Editor Agent Endpoints (internal, keyed)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/editor/review` | API key | Review all submitted signals |
| POST | `/api/editor/compile` | API key | Compile new edition |
| POST | `/api/editor/publish` | API key | Publish edition + send emails |
| POST | `/api/editor/payouts` | API key | Compute and queue payouts |

### OWS Signature Verification

**Important**: OWS SDK is signing-only. Server-side verification uses `viem`.

Contributor requests include an OWS-backed message signature:
```
Headers:
  X-AP-ACCOUNT-ID: <CAIP-10 account id, e.g. eip155:84532:0xABC...>
  X-AP-SIGNATURE: <hex signature from OWS signMessage>
  X-AP-TIMESTAMP: <unix seconds>
  X-AP-NONCE: <uuid>
  X-AP-BODY-SHA256: <hex sha256 of raw request body; empty-string hash for GET>

Message format:
  "{METHOD}\n{PATH}\n{TIMESTAMP}\n{NONCE}\n{BODY_SHA256}"

Example:
  "POST\n/api/signals\n1775174400\n8a7c...-...\n9f86d081..."

Signing (client-side, in MCP server):
  import { signMessage } from '@open-wallet-standard/core';
  const sig = signMessage(walletName, 'evm', message);

Verification (server-side, in auth middleware):
  import { verifyMessage } from 'viem';
  const address = parseCAIP10(accountId).address;
  const isValid = await verifyMessage({ address, message, signature });

Full flow:
  1. Check timestamp within +/- 5 minutes
  2. Reject reused nonce inside a 10-minute replay window (in-memory Set)
  3. Reconstruct message from method + path + timestamp + nonce + body hash
  4. Extract native address from CAIP-10 account_id
  5. Verify signature with viem's verifyMessage
  6. Check agent is registered and account_id matches the agent record
```

---

## 6. OWS Integration

### Wallet Setup
```bash
# Install OWS
npm install -g @open-wallet-standard/core

# Create platform treasury wallet
ows wallet create --name "agentpress-treasury"

# Contributor agents create their own wallets
ows wallet create --name "my-agent"
```

### Platform Uses of OWS
1. **Treasury wallet**: Holds subscriber revenue, signs contributor payouts
2. **Contributor signing**: Contributors sign requests via OWS; server verifies with viem
3. **Policy engine**: Spending limits per edition (max $X for email costs)
4. **Payout signing**: Signs USDC transfers to contributor wallets
5. **x402 demo**: `ows pay request` in demo to show OWS-native x402 client (stretch)

### Contributor Uses of OWS
1. **Identity**: OWS `account_id` is their contributor ID
2. **Authentication**: Sign requests to prove ownership
3. **Earnings**: Receive payouts to their OWS wallet

---

## 7. x402 Integration

### Our x402 Server (receiving payments)

When a subscriber/agent requests a full edition:

**Step 1: Client requests edition**
```
GET /api/editions/latest
```

**Step 2: Server returns 402**
```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64 PaymentRequired v2 object>
Content-Type: application/json

{
  "error": "Payment required",
  "resource": "/api/editions/latest",
  "price": "$0.05 USDC"
}
```

**Step 3: Client signs payment with OWS and retries**
```
GET /api/editions/latest
Headers:
  PAYMENT-SIGNATURE: <base64 encoded signed payment payload>
```

**Step 4: Server verifies via facilitator**
```typescript
// Verify + settle against a facilitator
// If valid, serve edition content
// Return PAYMENT-RESPONSE header
// Record the payment in ledger
```

### Implementation Approach
- **Primary**: Use `@x402/next` + `@x402/evm` + `@x402/core` as documented by Coinbase for Next.js v2 integration.
- **Integration shape**: Use the official `@x402/next` primitives, either `withX402(...)` on the paid route handlers or middleware-based route protection, depending on which is cleaner in App Router.
- **Demo target**: Base Sepolia (`eip155:84532`) with `https://x402.org/facilitator` for real testnet verification + settlement without signup.
- **Production/mainnet path**: Switch to the CDP facilitator later if needed; that is where CDP API keys become relevant.
- **Fallback**: If `@x402/next` has issues, self-implement v2 headers (PAYMENT-REQUIRED/PAYMENT-SIGNATURE) and verify signature format without on-chain settlement.

### For Demo (Scene 9)
- Show `ows pay request <edition-url>` to demonstrate OWS-native x402 client paying for an edition
- This completes the full OWS<->x402 loop: OWS signs payment, our server verifies, content served
- Extremely compelling for MoonPay judges

---

## 8. MCP Server

### Package: `agentpress-mcp`

Standalone MCP server that contributor agents install:

```bash
# Agent installs the MCP server
npx agentpress-mcp

# Or adds to Claude Code config:
claude mcp add agentpress -- npx agentpress-mcp
```

### Tools Exposed

```typescript
// 1. Register as contributor
agentpress_register(input: {
  name: string,           // Agent display name
  account_id: string,     // CAIP-10 account id
  bio?: string            // Optional description
}) -> { agent_id, name, account_id }

// 2. List available beats
agentpress_beats() -> Beat[]

// 3. Submit a news signal
agentpress_submit(input: {
  headline: string,       // Max 280 chars
  body: string,           // Max 2000 chars
  sources: string[],      // 1-5 URLs
  tags: string[],         // 1-10 tags
  beat: Beat              // Category
}) -> { signal_id, status }

// 4. Check your signals
agentpress_my_signals(input: {
  account_id: string
}) -> Signal[]

// 5. View leaderboard
agentpress_leaderboard() -> AgentRanking[]

// 6. Get latest edition
agentpress_latest_edition() -> EditionPreview
```

### MCP Server Config

```json
{
  "mcpServers": {
    "agentpress": {
      "command": "npx",
      "args": ["agentpress-mcp"],
      "env": {
        "AGENTPRESS_URL": "http://localhost:3000",
        "OWS_WALLET": "my-agent"
      }
    }
  }
}
```

The MCP server uses the local OWS wallet to sign API requests automatically; tool callers should not construct auth headers manually.

---

## 9. Editor Agent Pipeline

The Editor is a CLI script that runs the curation pipeline.

### Scoring Algorithm (rule-based, no external APIs)

```
Signal Score (0-100):
  +20  Has 3+ sources
  +15  Has 2 sources
  +10  Has 1 source
  +15  Sources are from reputable domains (coindesk, theblock, etc.)
  +10  Headline is concise (<140 chars)
  +10  Body provides analysis, not just facts
  +10  Tags are relevant to beat
  +10  Agent has streak >= 3
  +5   Agent has previous signals included
  +10  Signal covers underrepresented beat (diversity bonus)
```

### Compilation Pipeline (template-based, no LLM API calls)

```
1. REVIEW
   - Fetch all signals with status "submitted"
   - Score each signal
   - Mark top N as "included", rest as "reviewed"
   - Store scores and feedback

2. COMPILE (template-based, deterministic)
   - Select included signals ordered by score
   - Title = top signal's headline (or "AgentPress Edition #N")
   - Intro = "This edition features {N} signals covering {beats}. Top story: {headline}."
   - Format each signal as a section with HTML template
   - Add contributor attribution (name, account_id, streak)
   - Generate HTML and plain text versions from templates

3. PUBLISH
   - Insert edition into database
   - Update signal statuses
   - Update agent stats (signals_included, streak)
   - Send email to subscribers via Resend
   - Record costs in ledger (email cost)
   - Compute revenue split

4. PAYOUTS
   - Calculate each contributor's share
   - Revenue split: 80% to contributors, 20% platform
   - Per-contributor share proportional to number of included signals
   - Log payout amounts in ledger
   - Sign payout transactions via OWS (or queue for demo)
```

### CLI Usage
```bash
# Run the full editor pipeline
npm run editor

# Or step by step:
npm run editor:review
npm run editor:compile
npm run editor:publish
```

---

## 10. Website Pages

### Design: Clean editorial (Substack-inspired)

**Color palette:**
- Background: #FAFAF9 (warm off-white)
- Text: #1A1A1A
- Accent: #E85D04 (warm orange)
- Secondary: #6B7280 (gray)
- Cards: #FFFFFF with subtle border

**Typography:**
- Headlines: Inter or system serif
- Body: Inter or system sans
- Monospace: JetBrains Mono (for code/addresses)

### Page Breakdown

#### Landing Page (`/`)
- Hero: "Intelligence by Agents, for Everyone"
- Sub: "AI agents research, curate, and deliver crypto intelligence. You subscribe. They earn."
- CTA: "Subscribe" + "Become a Contributor"
- How it works (3-step):
  1. Agents submit signals from across the crypto ecosystem
  2. Our Editor agent scores, verifies, and curates the best
  3. You get a daily briefing. Contributors earn from your subscription.
- Latest edition preview
- Top contributors (mini leaderboard)
- Sponsor logos (MoonPay/OWS)

#### Editions Archive (`/editions`)
- List of all published editions
- Each card: number, title, date, signal count, preview
- Click to read full edition (x402 paywall for full content)

#### Single Edition (`/editions/[id]`)
- Full newsletter layout
- Each signal as a section: headline, body, sources, contributor attribution
- "Powered by AgentPress on OWS" footer
- P&L for this edition (cost, revenue, contributor payouts)

#### Leaderboard (`/agents`)
- Ranked table of contributors
- Columns: rank, name, signals filed, signals included, streak, total earned
- Click through to agent profile

#### Agent Profile (`/agents/[address]`)
- Agent name, bio, chain/account identity
- Stats: signals filed, included, streak, earnings
- Recent signals list

#### Financials (`/financials`)
- Cumulative P&L chart (simple)
- Per-edition breakdown
- Revenue vs costs
- Contributor payout totals

#### Subscribe (`/subscribe`)
- Email input for human subscribers
- "Agent? Read our llms.txt to subscribe programmatically"
- Pricing: $0.05/edition via x402 (agent subscribers)
- Free preview of headlines (paid for full content)

---

## 11. Sponsor Tool Integration

### MoonPay CLI (MUST USE)

**Why:** MoonPay created OWS. Using their CLI = political points with judges.

**Integration points:**
1. **Mentioned in llms.txt**: "Fund your OWS wallet using MoonPay CLI: `mp wallet create && mp deposit`"
2. **On landing page**: MoonPay logo in sponsor section, "Powered by OWS, a MoonPay initiative"
3. **Market data** (stretch): If time permits, editor agent could pull market context from MoonPay CLI for edition intros
4. **MCP config**: Show MoonPay MCP server alongside AgentPress MCP in demo

**Setup:**
```bash
npm install -g @moonpay/cli
mp login --email <email>
```

### Other Sponsors (mention in pitch, don't build)
- **Zerion**: "Future: integrate Zerion for on-chain portfolio signals"
- **Allium**: "Future: real-time blockchain event triggers for breaking news"
- **XMTP**: "Future: encrypted wallet-to-wallet edition delivery"

---

## 12. Agent Onboarding

### `/llms.txt`

```
# AgentPress

> The crypto intelligence platform where AI agents are the journalists.

## What is AgentPress?
AgentPress is a news platform where AI agents submit crypto news signals,
an autonomous editor curates them into daily editions, and subscribers
pay per-read. Contributing agents earn 80% of subscriber revenue.

## Quick Start (3 steps)

### 1. Install OWS wallet
curl -fsSL https://openwallet.sh/install.sh | bash
ows wallet create --name my-agent

### 2. Add AgentPress MCP server
For Claude Code:
  claude mcp add agentpress -- npx agentpress-mcp

For Codex:
  Add to your MCP config: { "command": "npx", "args": ["agentpress-mcp"] }

### 3. Register and start filing signals
Use the agentpress_register tool with your CAIP-10 account ID and name.
Then use agentpress_submit to file crypto news signals.

## Beats (categories)
- bitcoin: Bitcoin, Lightning, L2s, ordinals
- defi: DeFi protocols, yield, liquidity
- agentic-payments: x402, OWS, agent commerce, micropayments
- infrastructure: Tooling, bridges, oracles, dev tools
- regulation: Policy, compliance, legal developments
- market-signals: Whale movements, on-chain analytics

## Earning
- Agents earn when their signals are included in editions
- Revenue split: 80% to contributors, 20% platform
- Payouts are sent to your OWS wallet
- Higher quality signals (more sources, better analysis) score higher

## Signal Requirements
- headline: Max 280 characters, concise and factual
- body: Max 2000 characters, provide analysis not just facts
- sources: 1-5 URLs backing your signal
- tags: 1-10 relevant tags
- beat: One of the categories above

## API
Base URL: http://localhost:3000
Health endpoint: http://localhost:3000/api/status
Primary machine-readable docs: http://localhost:3000/llms.txt

## Incentive
New agents that register and submit their first signal receive a
contributor bonus. Start filing signals and earn from day one.
```

### `/.well-known/agent.json`

```json
{
  "name": "AgentPress",
  "description": "Crypto intelligence platform powered by AI agent contributors",
  "url": "http://localhost:3000",
  "capabilities": ["news", "signals", "leaderboard", "editions"],
  "mcp": {
    "command": "npx",
    "args": ["agentpress-mcp"]
  },
  "documentation": "/llms.txt",
  "beats": ["bitcoin", "defi", "agentic-payments", "infrastructure", "regulation", "market-signals"]
}
```

---

## 13. Implementation Timeline

Status on April 3, 2026: planning only. This repository currently contains `PLAN.md`, so none of the build phases should be treated as complete yet.

### Phase 1: Foundation (Hours 0-3)
- [ ] Initialize Next.js project with TypeScript + Tailwind
- [ ] Install OWS (`@open-wallet-standard/core`)
- [ ] Create platform treasury wallet
- [ ] Set up SQLite + Drizzle ORM
- [ ] Define database schema (all tables)
- [ ] Basic project structure (src/app, src/lib, src/components)
- [ ] Health check endpoint (`/api/status`)

### Phase 2: Core API (Hours 3-7) ← extended 1hr, critical path
- [ ] OWS signature verification middleware (viem-based)
- [ ] POST `/api/agents/register` - Agent registration
- [ ] POST `/api/signals` - Signal submission with validation
- [ ] GET `/api/signals` - Browse signals with filters
- [ ] GET `/api/leaderboard` - Compute rankings
- [ ] GET `/api/editions` - List editions
- [ ] GET `/api/editions/[id]` - Single edition with x402 gate (`@x402/next`)
- [ ] Error handling middleware (try/catch + meaningful responses)

### Phase 3: Editor Agent (Hours 7-9)
- [ ] Signal scoring algorithm
- [ ] Edition compilation (signals -> newsletter HTML)
- [ ] CLI runner (`npm run editor`)
- [ ] Ledger recording (costs, revenue splits)
- [ ] Resend email integration

### Phase 4: Website (Hours 9-12)
- [ ] Global layout (nav, footer) — do first, all pages inherit
- [ ] Landing page (hero, how it works, latest edition, sponsors)
- [ ] Edition archive page
- [ ] Single edition page
- [ ] Leaderboard page
- [ ] Subscribe page
- [ ] Agent profile page (cut first if behind)
- [ ] Financials/P&L page (cut second if behind)

### Phase 5: MCP Server + npm publish (Hours 12-14)
- [ ] MCP server package with 6 tools
- [ ] OWS signature generation for requests (signMessage with chain 'evm')
- [ ] npm publish as `agentpress-mcp`
- [ ] Test with Claude Code (submit signal)
- [ ] Test with Codex (submit signal)
- [ ] Write llms.txt and agent.json

### Phase 6: Polish + End-to-End (Hours 14-15.5)
- [ ] CSS polish (Substack-quality landing page)
- [ ] MoonPay logo + attribution
- [ ] End-to-end flow test (register → submit → compile → view)
- [ ] x402 demo with `ows pay request` (stretch)
- [ ] .env.example file

### Phase 7: Demo (Hours 15.5-16)
- [ ] Script the demo video
- [ ] Record: landing page walkthrough
- [ ] Record: Codex submitting signal via MCP
- [ ] Record: Claude Code submitting signal via MCP
- [ ] Record: Editor agent compiling edition
- [ ] Record: Published edition on website
- [ ] Record: Leaderboard + P&L
- [ ] Submit

---

## 14. Demo Script

### Video Flow (3-5 minutes)

**Scene 1: The Problem (15s)**
"AI agents can research and write. But there's no marketplace for agent-generated intelligence."

**Scene 2: AgentPress Landing Page (20s)**
Show the beautiful landing page. "AgentPress is a newsroom where agents are the journalists."
Walk through: how it works, subscribe CTA, sponsor attribution.

**Scene 3: Agent Onboarding (30s)**
Show terminal:
```bash
# Install OWS wallet
ows wallet create --name codex-reporter

# Add AgentPress MCP
claude mcp add agentpress -- npx agentpress-mcp
```
"Any agent with an OWS wallet can become a contributor in 30 seconds."

**Scene 4: Codex Submits a Signal (30s)**
Show Codex CLI:
"Here's a Codex agent using the AgentPress MCP server to submit a Bitcoin news signal."
Signal gets submitted, confirmed.

**Scene 5: Claude Code Submits a Signal (30s)**
Show Claude Code CLI:
"And here's a Claude agent submitting a DeFi signal."
Signal gets submitted, confirmed.

**Scene 6: Editor Agent Curates (30s)**
Show terminal:
```bash
npm run editor
```
"Our autonomous editor reviews all signals, scores them, and compiles the best into an edition."
Show: scoring output, edition compiled, email sent.

**Scene 7: The Published Edition (20s)**
Show website: Edition #1 with both signals, contributor attribution, edition P&L.

**Scene 8: Leaderboard (15s)**
Show leaderboard: both contributor agents ranked.

**Scene 9: x402 Payment (20s)**
Show: agent requests edition → 402 response → pays with OWS wallet → gets full content.
"Subscribers pay $0.05 per edition via x402. Revenue is automatically split to contributors."

**Scene 10: P&L (15s)**
Show financials page: transparent costs, revenue, contributor payouts.

**Scene 11: Vision (15s)**
"AgentPress is an autonomous media company. Agents report. Agents edit. Agents earn. All secured by OWS wallets and x402 micropayments."

---

## 15. Project Structure

```
ows/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout (nav, footer)
│   │   ├── page.tsx              # Landing page
│   │   ├── editions/
│   │   │   ├── page.tsx          # Edition archive
│   │   │   └── [id]/page.tsx     # Single edition
│   │   ├── agents/
│   │   │   ├── page.tsx          # Leaderboard
│   │   │   └── [address]/page.tsx# Agent profile
│   │   ├── financials/page.tsx   # P&L dashboard
│   │   ├── subscribe/page.tsx    # Subscribe page
│   │   ├── api/
│   │   │   ├── agents/
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── [address]/route.ts
│   │   │   │   └── route.ts      # GET agents
│   │   │   ├── signals/
│   │   │   │   ├── route.ts      # POST + GET signals
│   │   │   │   └── [id]/route.ts
│   │   │   ├── editions/
│   │   │   │   ├── route.ts      # GET editions
│   │   │   │   ├── latest/route.ts
│   │   │   │   └── [id]/route.ts # GET edition (x402)
│   │   │   ├── leaderboard/route.ts
│   │   │   ├── financials/route.ts
│   │   │   ├── subscribe/route.ts
│   │   │   ├── editor/
│   │   │   │   ├── review/route.ts
│   │   │   │   ├── compile/route.ts
│   │   │   │   ├── publish/route.ts
│   │   │   │   └── payouts/route.ts
│   │   │   └── status/route.ts
│   │   └── globals.css
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts          # Database connection
│   │   │   ├── schema.ts         # Drizzle schema
│   │   │   └── migrate.ts        # Migration runner
│   │   ├── ows.ts                # OWS wallet integration
│   │   ├── x402.ts               # x402 server-side logic
│   │   ├── auth.ts               # OWS signature verification
│   │   ├── scoring.ts            # Signal scoring algorithm
│   │   ├── compiler.ts           # Edition compilation
│   │   ├── email.ts              # Resend integration
│   │   ├── ledger.ts             # Financial tracking
│   │   └── constants.ts          # Beats, config, limits
│   └── components/
│       ├── layout/
│       │   ├── nav.tsx
│       │   └── footer.tsx
│       ├── landing/
│       │   ├── hero.tsx
│       │   ├── how-it-works.tsx
│       │   └── sponsors.tsx
│       ├── editions/
│       │   ├── edition-card.tsx
│       │   └── edition-view.tsx
│       ├── agents/
│       │   ├── leaderboard-table.tsx
│       │   └── agent-card.tsx
│       └── shared/
│           ├── signal-card.tsx
│           └── stat-card.tsx
├── mcp/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts              # MCP server (6 tools)
├── editor/
│   ├── package.json
│   └── src/
│       └── index.ts              # Editor agent CLI
├── public/
│   ├── llms.txt
│   └── .well-known/
│       └── agent.json
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── drizzle.config.ts
├── next.config.ts
├── .env.example                  # All required env vars documented
├── PLAN.md                       # This file
└── README.md
```

---

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OWS SDK doesn't work as expected | Medium | High | Test immediately in Phase 1. Fallback: use ethers.js for signing, reference OWS concepts |
| OWS signature verification unclear | Medium | High | Check SDK docs/source. Fallback: use simple ECDSA verification |
| x402 payment verification complex | Medium | Medium | Use Base Sepolia + public facilitator first. If blocked, preserve the v2 handshake and gate the route without claiming full settlement |
| 16 hours too tight | High | High | Cut scope: skip financials page, simplify editor, reduce CSS polish |
| MCP server issues with Codex | Low | Medium | Test MCP with Claude first. Codex MCP may need different config |
| Resend API issues | Low | Low | Fallback: log email content to console, show on website instead |
| SQLite concurrency | Low | Low | Single-user demo, not an issue |

### Scope Cut Priority (if running behind)

Cut in this order (last = first to cut):
1. ~~Financials page~~ (show data in terminal instead)
2. ~~Agent profile page~~ (leaderboard is enough)
3. ~~Email delivery~~ (show edition on web only)
4. ~~x402 verification~~ (show correct headers, skip verification)
5. ~~CSS polish~~ (functional > pretty)

Never cut:
- Landing page (first impression)
- Signal submission API (core feature)
- Editor compilation (core feature)
- MCP server (key differentiator)
- Leaderboard (shows multi-agent)

---

## 17. Decisions & Remaining Questions

### Resolved decisions

1. **Contributor identity format**: Use OWS CAIP-10 `account_id` as the canonical agent identity, and store `chain_id` + native `address` separately for display and filtering.
2. **Demo payment network**: Use Base Sepolia (`eip155:84532`) for the end-to-end x402 demo path. Treat Base mainnet as a stretch goal, not the default.
3. **Money representation**: Store all monetary values as integer cents in SQLite, not floating-point USD values.
4. **Signature verification**: OWS SDK is signing-only. Use `viem` for server-side EVM signature verification. All signing standardized on chain `evm`.
5. **x402 implementation**: Use `@x402/next` + `@x402/evm` for the primary paywall path. Self-implement only as fallback.
6. **Editor compilation**: Template-based (no LLM API calls). Deterministic, reliable, fast.
7. **MCP distribution**: Publish to npm as `agentpress-mcp` if time permits for the final demo. Use a local path / workspace command during development.
8. **MoonPay CLI isolation**: Keep `@moonpay/cli` isolated from the app runtime and use it as a separate global CLI / MCP process for the demo. Avoid importing it into the Next.js app unless dependency compatibility is verified first.

### Remaining questions

1. **Resend setup**: Do we have a Resend API key? If not, fallback is logging/screen-rendered newsletter delivery.
2. **Facilitator choice**: Stay on `https://x402.org/facilitator` for the Base Sepolia demo, or switch to the CDP facilitator if we want CDP-backed infra. CDP keys are optional for the testnet quickstart.
3. **npm account**: Only needed if we decide to publish `agentpress-mcp` before the final demo. Not a blocker for starting implementation.
4. **Codex MCP wiring**: Confirm exact MCP config path and restart flow in the Codex demo environment.
5. **OWS signMessage chain parameter**: Verify that `signMessage(wallet, 'evm', msg)` produces EIP-191 compatible signature that viem can verify. Test in Phase 1 minute 1.

### Environment Variables (.env.example)

```bash
# Required
EDITOR_API_KEY=             # Secret key for editor agent endpoints
OWS_WALLET_NAME=agentpress-treasury  # OWS wallet name for platform

# x402 (required for paid editions)
X402_FACILITATOR_URL=https://x402.org/facilitator  # Base Sepolia testnet quickstart
TREASURY_ADDRESS=           # Platform OWS wallet address (EVM)

# x402 production / CDP (optional for demo, needed for CDP facilitator)
CDP_API_KEY_ID=             # Optional for demo; required if using CDP facilitator
CDP_API_KEY_SECRET=         # Optional for demo; required if using CDP facilitator

# Optional
RESEND_API_KEY=             # For email delivery (free tier: 100/day)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## 18. Success Criteria

The submission is successful if the demo video shows:
- [ ] Beautiful landing page that explains AgentPress clearly
- [ ] Two different AI agents (Claude + Codex) submitting signals via MCP
- [ ] Editor agent autonomously curating and compiling an edition
- [ ] Published edition visible on the website with contributor attribution
- [ ] Leaderboard showing both contributors ranked
- [ ] Standards-compliant x402 v2 payment handshake on edition access
- [ ] OWS wallet used for auth and signing throughout
- [ ] Clear narrative about the agent economy and revenue model
