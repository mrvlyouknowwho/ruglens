# RugLens — Telegram rug pull & honeypot checker

**[@RugLens_bot](https://t.me/RugLens_bot)** — paste a token contract address into Telegram, get an instant scam-risk report. No sign-up, no wallet connection, 5 free checks a day.

Works with **Ethereum, BSC, Base, Arbitrum, Polygon, Optimism, Avalanche and TON jettons**.

**No Telegram? Use the web checker → [mrvlyouknowwho.github.io/ruglens](https://mrvlyouknowwho.github.io/ruglens/)** — same EVM checks, runs entirely in your browser, nothing stored.

## What it checks

- **Honeypot**: static contract analysis plus a live buy/sell simulation (ETH/BSC/Base) — can you actually sell after you buy?
- **Taxes**: buy / sell / transfer tax, flags anything over 10%
- **Owner powers**: hidden owner, balance editing, ownership take-back, pausable transfers, blacklist functions
- **Supply**: mintable tokens, revoked mint authority (TON), proxy/upgradeable contracts
- **Holders**: concentration in the top-10 wallets, suspiciously small holder counts
- **Liquidity**: DEX pools and their size, STON.fi listing status for TON
- **History**: whether the deployer shipped honeypots before

Each report is a 0–100 risk score with human-readable flags, in English or Russian (auto-detected).

## Usage

1. Open [@RugLens_bot](https://t.me/RugLens_bot)
2. Paste a contract address (`0x…` for EVM, `EQ…`/`UQ…` for TON)
3. Read the report before you ape

Also works **inline in any chat**: type `@RugLens_bot <address>` and share the report without leaving the conversation, and **in groups** — add the bot and members can check tokens right where the shilling happens.

The chain is detected automatically from DEX listings; unlisted tokens fall back to a chain picker.

## Data sources

All keyless and independent: [GoPlus](https://gopluslabs.io) token security, [honeypot.is](https://honeypot.is) simulation, [DexScreener](https://dexscreener.com), [tonapi.io](https://tonapi.io), [STON.fi](https://ston.fi). RugLens aggregates and scores — it never asks for keys, wallets or signatures.

## Self-hosting

```
BOT_TOKEN=<from @BotFather> node bot.mjs
```

Env: `FREE_PER_DAY` (default 5), `ADMIN_ID` (enables /stats), `TONAPI_KEY` (optional, raises TON rate limits), `DATA_DIR` (default ./data).

Docker:

```
docker build -t ruglens .
docker run -d --name ruglens --memory 192m --restart unless-stopped \
  -e BOT_TOKEN=... -v ruglens-data:/data ruglens
```

Owner setup via @BotFather: `/setprivacy` → Disable (group scanning), `/setinline` (inline mode).

## Disclaimer

Automated heuristics over public data. A green report is not an endorsement and a red one is not an accusation — always do your own research. Not financial advice.

## License

MIT
