# OpenPit — crowd pits on dreamDEX perps

> Call it. Open the pit. Let the crowd fade you.

OpenPit is a dreamDEX Perps Builder Bounty MVP on the **Somnia Hideki testnet (chain 50383)**.
A creator opens a 5/15/30-minute **pit** on one dreamDEX perp market with a signed thesis and a real opening order.
Anyone joins **LONG** (with the creator) or **FADE** (against them) from their own wallet with a real on-chain IOC order.
A live card scores the crowd block-by-block via Somnia Reactivity; at the bell the mark is frozen and every trader is
ranked by **return-on-cap** (session PnL ÷ the pit's per-trader cap), so conviction wins, not size.
The result renders as a shareable OG card with a one-tap Rematch.

- Live demo: _(Vercel URL goes here)_
- Screenshots: [`docs/settled-pit.png`](./docs/settled-pit.png) · [`docs/og-settled.png`](./docs/og-settled.png) · [`docs/home.png`](./docs/home.png)
- Evidence of real orders: [EVIDENCE.md](./EVIDENCE.md)
- License: [MIT](./LICENSE)

## Who it's for

- **Traders on dreamDEX testnet** who want a social, time-boxed reason to put a position on and dunk on each other.
- **Communities/KOLs** who post a call and want followers to join or fade it with skin in the game, with a verifiable result card.
- **dreamDEX** — every pit is organic perps volume plus a public, shareable artefact tagging @DreamDEXSomnia.

## What is real

- Every opening order, join and close is a `placePerpOrder` transaction signed by the user's wallet and sent to the
  dreamDEX **PerpPool** through `@somnia-chain/markets-sdk@0.32.1`. The server never holds or sees a key.
- The server **re-verifies every hash over RPC** before recording it: `status == success`, `from == connected wallet`,
  `to == this pit's pool`, then decodes `OrderFilled` (pool) and `PositionUpdated` (MarginBank) logs to derive the
  filled quantity, VWAP entry and resulting position direction. Nothing in the body is trusted.
- The pit intent is **EIP-191 signed** by the creator (`verifyMessage` on the server) and stored verbatim with the pit.
- Mark prices, positions, margin, voucher eligibility all come from chain reads (`tryGetMarkPrice`, `getPosition`,
  `getMarginAccount`, `getPerpVoucherEligibility`). Market rows come from the dreamDEX indexer. No mock data anywhere.

## Run it

```bash
git clone https://github.com/ahmardchain/openpit && cd openpit
npm install
cp .env.example .env            # fill only what you need (see below)
npm run dev                      # http://localhost:3000
```

Env vars (`.env.example`):

| var | purpose |
| --- | --- |
| `NEXT_PUBLIC_RPC_HTTP` / `NEXT_PUBLIC_RPC_WS` | Hideki RPC. The SDK **requires the WebSocket** endpoint or it fails its genesis check. |
| `NEXT_PUBLIC_INDEXER` | dreamDEX Hideki GraphQL indexer (market rows). |
| `NEXT_PUBLIC_APP_URL` | Public URL used in share links / OG images. |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project id for RainbowKit (optional for injected wallets). |
| `OPENPIT_DB` | SQLite file for pit metadata (default `./data/openpit.db`). |
| `SMOKE_PRIVATE_KEY`, `SMOKE_PRIVATE_KEY_2` | **Scripts only.** Test keys for `npm run smoke` / `npm run e2e`. Never used by the app, never committed. |

Scripts:

| command | what it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js app |
| `npm run smoke` | Step 0: connects, lists markets, claims paper USDso if eligible, places a tiny IOC on BTC (fallback ETH), closes it, appends tx hashes to `EVIDENCE.md` |
| `npm run e2e` | Full run against a running server: create pit → second wallet fades → bell → settle → both close. Appends everything to `EVIDENCE.md` |
| `npm run balances` | STT balance of the two script wallets |
| `npm run fund:second` | Testnet helper: moves 50 USDso + 10 STT from wallet 1 to wallet 2 |
| `npm run typecheck` | `tsc --noEmit` |

Getting test funds: STT for gas via **Link a Bot → “Send it for gas”** on [app.testnet.dreamdex.io](https://app.testnet.dreamdex.io) or the
[Somnia faucet](https://testnet.somnia.network); the 1,000 **paper USDso** credit is claimable in-app (the “Claim 1,000 paper USDso” button
calls `trader.claimPerpVoucher`). Paper USDso only opens positions on its allowlist — the app surfaces `limitedBy: voucherBlocked` in plain words.
If the claim reverts (it did for our fresh wallets, see EVIDENCE.md) or you got USDso from the **Somnia Tokyo Telegram faucet** (`/faucet <address>` in the dreamDEX builders group: 50 STT + 100 USDso), the same panel offers **“Deposit wallet USDso into Perps”**, which runs `trader.depositMargin` with auto-approve.

> Sandbox note: the `NODE_USE_ENV_PROXY=1 … --import ./scripts/proxy-preload.mjs` prefix in the script commands only matters behind an
> egress proxy; it is a no-op otherwise.

### Deploy on Vercel

`vercel` with the same env vars. SQLite lives on the function filesystem, which is ephemeral on Vercel — point `OPENPIT_DB` at
`/tmp/openpit.db` for a demo, or swap `src/lib/db.ts` for a hosted store (Turso/libSQL is a drop-in). Everything else is stateless.

## Architecture

```
 browser (wagmi + RainbowKit, chain 50383)                     Somnia Hideki
 ┌──────────────────────────────────────────┐                 ┌──────────────────────────┐
 │ /new   sign EIP-191 intent ──────────────┼─ wallet ───────►│ PerpPool.placeOrder (IOC)│
 │        placePerpOrder (SDK, 10M gas)     │                 │ MarginBank (positions)   │
 │ /pit   LONG / FADE  ─► placePerpOrder ───┼─ wallet ───────►│ Oracle (mark)            │
 │        close  ─► opposite IOC (reduce)   │                 └───────▲──────────▲───────┘
 │        useLivePit: somnia_watch ◄────────┼── log + same-block eth_calls │          │
 │          [pool, oracle, bank] +          │   (tryGetMarkPrice,         │          │
 │          2s poll fallback                │    getPosition × traders)   │          │
 └───────────────┬──────────────────────────┘                             │          │
                 │ tx hash only                                           │ HTTP RPC │
 ┌───────────────▼──────────────────────────┐                             │          │
 │ Next.js route handlers (no keys)         │                             │          │
 │ POST /api/pits        verify intent sig, │── getTransactionReceipt ────┘          │
 │                       verify opening tx, │   decode OrderFilled/PositionUpdated   │
 │                       store start block  │                                        │
 │ POST /api/pits/:id/join   verify tx      │                                        │
 │ POST /api/pits/:id/settle freeze mark ───┼── tryGetMarkPrice @ end block ─────────┘
 │ GET  /api/og/:id      result card (ImageResponse)                                  │
 │ SQLite (better-sqlite3): pits, joins     │
 └──────────────────────────────────────────┘
```

**Scoring.** For each join: `pnl = side × qty × (mark_end − entry) / 10^baseDecimals` (USDso, 18 dec), and
`returnOnCap = pnl / cap`. The cap is the same denominator for everyone, and a join above the cap is clamped to
cap-worth of notional before scoring, so a whale cannot buy the podium. The settle route finds the first block whose
timestamp ≥ `end_ts`, reads `tryGetMarkPrice` **at that block**, and freezes it; results are stored per join.

**Sizing.** `getMaxPerpOrderSize` is called before every order with a 2 % crossing price; the quantity is
`min(cap-worth, maxQuantity)` aligned down to `lotSize`, and anything below `minQuantity` is refused before the wallet
prompt. Orders are IOC (`ORDER_TYPE.MARKET`) with a 10 000 000 gas limit, as the bot kit does, because `eth_estimateGas`
under-estimates on the pools. `ImmediateOrCancelNoFill` is caught and explained.

## Reactivity usage

The live card is driven by **Somnia Reactivity's WebSocket flavour** (`somnia_watch`) straight from the browser —
see [`src/lib/use-live-pit.ts`](./src/lib/use-live-pit.ts).

```ts
const reactivity = createReactivity(exchange.client);              // @somnia-chain/markets-sdk/reactivity
const watch = unwrap(await reactivity.watch({
  eventContractSources: [pool, oracle, marginBank],                // any log from the pit's pool, its mark oracle, or the bank
  ethCalls: [
    { to: pool,       data: encode(tryGetMarkPrice) },             // mark at the very same block
    ...traders.map(w => ({ to: marginBank, data: encode(getPosition(w, pool)) })),
  ],
  onData: n => apply(n.result.simulationResults),                  // re-score on the block that moved it
  onError: () => startPoll(),
}));
```

Every matching log arrives **with the results of those `eth_call`s executed at that same block**, so the card re-scores
(crowd bar, per-trader PnL, return-on-cap) without a follow-up round trip and without racing the next block. If the
watch cannot open (no WS, unsupported node) the hook falls back to a **2-second poll** of the same calls pinned to one
block number, and the card says which source it is on. The Solidity flavour (`subscribe` + a `SomniaEventHandler`) is
not used yet — see future work.

## X posts

- _(post 1 — pit opened)_
- _(post 2 — settled result card)_
- _(post 3 — rematch / recap)_

## Future work

- **Somnia Agents: the “pit brief”.** An agent that watches `PitCreated` and, at the bell, posts a one-paragraph brief
  (thesis vs. what the mark did, who faded, funding during the window) to X and the pit page, and opens the rematch with
  a counter-thesis. The settle step itself can move on-chain with a scheduled Reactivity subscription
  (`scheduleSubscriptionAtTimestamp` → handler freezes the mark), removing the need for anyone to call `/settle`.
- Score on realised + unrealised PnL from `getPerpPositionAnalytics` (funding included) instead of price-only session PnL.
- Builder-fee attribution via `approveBuilder` / `builderFeeBpsTimes1k` so pits can fund a prize pool.
- Hosted DB for multi-region deploys; ENS/avatar resolution on the scoreboard.

## Honest limits (MVP)

- Session PnL is price-only on the recorded join size; funding over the window and positions changed outside the app
  are not included in the score (the position reads shown live are real, the score uses the recorded join).
- Settlement is triggered by the first page viewer or the `e2e` script after the bell; it is idempotent.
- SQLite is file-local; see the Vercel note.
