# Grok Armada

Grok Armada is a kit of Grok Bot trading bots for [Imperial](https://imperial.trade) perpetuals (Solana perps), in Easy, Medium, and High risk tiers.

> **Not financial advice, perps can lose money, use a fresh dedicated wallet with only what you can afford to lose.**

Perpetual futures can liquidate a position and can take the whole balance of the wallet that funds them. Create a fresh wallet used only for this bot, and deposit only what you can afford to lose.

## Sign up

Sign up via [https://imperial.trade/i/chesus](https://imperial.trade/i/chesus) (referral code `chesus`).

## Quick start

Node.js 18 or newer.

Each tier installs into its own folder and reads its own key, so Easy, Medium and High can run side by side on one computer without clashing:

| Tier | Folder | Key env var (`keyEnv` in the tier file) |
|---|---|---|
| Easy | `~/armada-easy` | `ARMADA_EASY_SOL_PRIVATE_KEY` |
| Medium | `~/armada-medium` | `ARMADA_MEDIUM_SOL_PRIVATE_KEY` |
| High | `~/armada-high` | `ARMADA_HIGH_SOL_PRIVATE_KEY` |

```bash
T=easy   # or medium / high
mkdir -p ~/armada-$T && curl -L https://github.com/Chesus01/grok-armada/archive/refs/heads/main.tar.gz | tar xz --strip-components=1 -C ~/armada-$T
[ -f ~/armada-$T/scripts/config.json ] || cp ~/armada-$T/tiers/$T.json ~/armada-$T/scripts/config.json
export ARMADA_EASY_SOL_PRIVATE_KEY="your Solana private key"   # name must match the tier
cd ~/armada-$T/scripts && node setup.js && node monitor.js --dry
```

> **Use a different wallet / trading account for each tier.** Two tiers on the same wallet would trade the same balance and fight over each other's positions and loss limits. `setup.js` warns (`shared_wallet`) if it sees another tier folder pinned to the same wallet.

**Wallet pinning:** the first time `setup.js` sees a key it records that wallet's address in `config.json` (`wallet`). After that every script aborts (exit 4) if the key's address differs, so a swapped or overwritten key can never silently trade a different account. To deliberately change wallets, clear `wallet` in `config.json` and run setup again.

`node scripts/setup.js` installs the dependencies in `scripts/`, checks the tier file, signs in with a wallet signature, and reports Imperial USDC plus wallet SOL. `node scripts/monitor.js --dry` scores markets and prints one JSON line with the orders it would send. `--dry` keeps that run read-only.

A file named `STOP` in a tier's `scripts/` folder pauses new trades for that tier only. State, the login token, logs, snapshots and the trade log all stay inside that tier's `scripts/` folder.

## Private key

The key is only read from the environment variable named by `keyEnv` in `config.json` (e.g. `ARMADA_EASY_SOL_PRIVATE_KEY`); there is no fallback to any other name, and it is never logged. Pass it in the environment of the process. A login token is cached in `scripts/.token` with mode `0600`. That file, `config.json`, `.env`, and local state are listed in `.gitignore`.

## Tier comparison

Numbers are the fields in `tiers/easy.json`, `tiers/medium.json`, and `tiers/high.json`.

Take-profit, stop-loss, and the breakeven move are percent of margin (return on equity). The price move that reaches a stop is about that percent divided by leverage, so Easy’s 2.5% stop at 2× is about a 1.25% price move.

| | Easy | Medium | High |
| --- | --- | --- | --- |
| Leverage | 2× | 3–5× | 5–8× |
| Open positions (`maxSlots`) | 2 | 4 | 5 |
| Margin / strong margin | $15 / $20 | $30 / $30 | $25 / $30 |
| Take-profit (`tpPct`) | 5% | 7% | 12% |
| Stop-loss (`slPct`) | 2.5% | 3.5% | 6% |
| Breakeven (`breakevenPct`) | 3% | 4% | 5% |
| Daily halt (`dailyHaltPct`) | −5% | −10% | −15% |
| Kill switch (`killPct`, `maxLossStreak`) | −15% from the start, or 5 losses in a row | −15% from the start, or 8 losses in a row | −25% from the start, or 10 losses in a row |
| Max trades / day | 8 | 20 | 30 |
| Max margin in use | 60% | 85% | 90% |
| Min score / strong score | 0.30 / 0.55 | 0.20 / 0.50 | 0.18 / 0.45 |
| Same-direction crypto cap | 1 | 2 | 3 |
| RSI cap (`rsiMax`) | 65 | 70 | 75 |
| Cooldown after a stop | 2 hours | none (`cooldownH` 0) | none (`cooldownH` 0) |
| Volume goal | none (`volGoal` 0) | $1,000 | $2,000 |
| Top-up margin | $15 | $25 | $20 |
| Stale rotation | 3h within 1.5%, or 6h within 2.5% | 1.5h within 1.5%, or 4h within 2.5% | 1h within 2%, or 3h within 3% |
| Markets | 7 | 16 | 35 |

Top-up margin applies after 16:00 America/New_York when `volGoal` is above zero and today’s volume is still under that goal. Easy leaves `volGoal` at 0, so it stays on the base margin.

**Easy:** BTC, ETH, SOL, XRP, BNB, LINK, XAU.

**Medium:** the Easy markets, plus DOGE, SUI, AVAX, HYPE, ZEC, LTC, ADA, QQQ, SPY.

**High:** the Medium markets, plus AAVE, NEAR, TAO, ENA, XAG, NVDA, TSLA, AAPL, MSFT, AMZN, GOOGL, META, AMD, PLTR, COIN, MSTR, HOOD, OPENAI, ANTHROPIC.

The market counts above are the starter lists. Each tier file also has a `suggested` list of extra markets.

## Dashboard

`dashboard/template.tsx` is the canvas for equity, P&L, volume, open positions, trade history, and the activity log. From the `scripts/` folder, `node dashboard.js` prints one JSON object built from the local snapshot, state, and trade log. Paste its `data` value over the placeholder after `const DATA = /*__DATA__*/` (keep `as any;`). `node dashboard.js --live` also includes season points when the tier's key is set. The key is never printed.

## Suggested markets

From the `scripts/` folder, list the active markets and the names still available on this tier, then add one:

```bash
node markets.js
node markets.js add SYM
```

`node markets.js add SYM` adds a symbol from that tier's `suggested` list, or puts a removed starter market back. Added markets use the same leverage, size, stops, and daily halt as the rest of the tier. Pre-IPO markets stay capped at 4×.

## Layout

- `scripts/` — auth, setup, account, deposit, scoring, orders, the hourly monitor, dashboard data, and suggested markets
- `tiers/` — Easy, Medium, and High configs
- `skills/` — onboarding drafts, one `SKILL.md` per tier
- `dashboard/` — canvas template (`template.tsx`)

Onboarding notes for a Grok Bot live in `skills/easy/SKILL.md`, `skills/medium/SKILL.md`, and `skills/high/SKILL.md`.
