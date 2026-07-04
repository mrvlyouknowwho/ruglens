const GOPLUS = 'https://api.gopluslabs.io/api/v1/token_security';
const HONEYPOT_IS = 'https://api.honeypot.is/v2/IsHoneypot';

const CHAIN_IDS = {
  ethereum: '1', eth: '1', mainnet: '1', '1': '1',
  bsc: '56', bnb: '56', binance: '56', '56': '56',
  base: '8453', '8453': '8453',
  arbitrum: '42161', arb: '42161', '42161': '42161',
  polygon: '137', matic: '137', '137': '137',
  optimism: '10', op: '10', '10': '10',
  avalanche: '43114', avax: '43114', '43114': '43114',
};
const CHAIN_NAMES = {
  '1': 'ethereum', '56': 'bsc', '8453': 'base', '42161': 'arbitrum',
  '137': 'polygon', '10': 'optimism', '43114': 'avalanche',
};
// honeypot.is buy/sell simulation covers these; elsewhere we degrade to static-only.
const SIMULATION_CHAINS = new Set(['1', '56', '8453']);

export function resolveChain(chain) {
  return CHAIN_IDS[String(chain || 'base').toLowerCase()] || null;
}

async function goplus(chainId, address) {
  const r = await fetch(`${GOPLUS}/${chainId}?contract_addresses=${address}`);
  if (!r.ok) throw new Error(`goplus -> ${r.status}`);
  const body = await r.json();
  const t = body.result?.[address.toLowerCase()];
  if (!t) throw new Error(body.message && body.code !== 1 ? `goplus: ${body.message}` : 'token not found on this chain');
  return t;
}

async function honeypotIs(chainId, address) {
  const r = await fetch(`${HONEYPOT_IS}?address=${address}&chainID=${chainId}`);
  if (!r.ok) throw new Error(`honeypot.is -> ${r.status}`);
  return r.json();
}

const yes = (v) => v === '1' || v === 1 || v === true;
const pct = (v) => (v == null || v === '' ? null : +(Number(v) * 100).toFixed(2));

const WEIGHTS = {
  static_honeypot: 60, simulated_honeypot: 60, cannot_sell_all: 30, cannot_buy: 25,
  owner_can_change_balance: 30, no_dex_liquidity: 30, hidden_owner: 25, selfdestruct: 25,
  can_take_back_ownership: 20, not_open_source: 20, high_tax: 20, creator_prior_honeypots: 20,
  transfer_pausable: 15, blacklist_function: 15, mintable: 15, holder_concentration_high: 15,
  trading_cooldown: 10, proxy_contract: 10,
};

function score(g, sim) {
  const flags = [];
  if (yes(g.is_honeypot)) flags.push('static_honeypot');
  if (sim && sim.honeypotResult?.isHoneypot === true) flags.push('simulated_honeypot');
  if (yes(g.cannot_sell_all)) flags.push('cannot_sell_all');
  if (yes(g.cannot_buy)) flags.push('cannot_buy');
  if (yes(g.owner_change_balance)) flags.push('owner_can_change_balance');
  if (g.is_in_dex != null && !yes(g.is_in_dex)) flags.push('no_dex_liquidity');
  if (yes(g.hidden_owner)) flags.push('hidden_owner');
  if (yes(g.selfdestruct)) flags.push('selfdestruct');
  if (yes(g.can_take_back_ownership)) flags.push('can_take_back_ownership');
  if (g.is_open_source != null && !yes(g.is_open_source)) flags.push('not_open_source');
  const buyTax = pct(g.buy_tax) ?? sim?.simulationResult?.buyTax ?? null;
  const sellTax = pct(g.sell_tax) ?? sim?.simulationResult?.sellTax ?? null;
  if ((buyTax ?? 0) > 10 || (sellTax ?? 0) > 10) flags.push('high_tax');
  if (Number(g.honeypot_with_same_creator) > 0) flags.push('creator_prior_honeypots');
  if (yes(g.transfer_pausable)) flags.push('transfer_pausable');
  if (yes(g.is_blacklisted)) flags.push('blacklist_function');
  if (yes(g.is_mintable)) flags.push('mintable');
  const top10 = Array.isArray(g.holders)
    ? +(g.holders.slice(0, 10).reduce((a, h) => a + (Number(h.percent) || 0), 0) * 100).toFixed(2)
    : null;
  if (top10 != null && top10 > 80 && Number(g.holder_count) > 0) flags.push('holder_concentration_high');
  if (yes(g.trading_cooldown)) flags.push('trading_cooldown');
  if (yes(g.is_proxy)) flags.push('proxy_contract');
  const s = Math.min(100, flags.reduce((a, f) => a + (WEIGHTS[f] || 10), 0));
  return { score: s, flags, buyTax, sellTax, top10 };
}

async function safe(fn) {
  try { return await fn(); } catch { return null; }
}

export async function assessEvm(chain, address) {
  const chainId = resolveChain(chain);
  if (!chainId) throw new Error(`unsupported chain "${chain}"; use one of: ${Object.keys(CHAIN_NAMES).map((k) => CHAIN_NAMES[k]).join(', ')}`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('address must be a 0x-prefixed 20-byte hex contract address');

  const [g, sim] = await Promise.all([
    goplus(chainId, address), // must-have; static analysis
    SIMULATION_CHAINS.has(chainId) ? safe(() => honeypotIs(chainId, address)) : Promise.resolve(null),
  ]);

  const { score: s, flags, buyTax, sellTax, top10 } = score(g, sim);
  const simulated = sim?.simulationSuccess === true;
  const dexPools = Array.isArray(g.dex)
    ? g.dex.slice(0, 3).map((d) => ({ name: d.name, liquidityUsd: +Number(d.liquidity).toFixed(2) }))
    : [];

  // GoPlus lags minutes-old launches: contract-scan fields absent, holders not counted yet.
  // Such a stub must not render as a confident green report.
  const dataSparse = g.is_open_source == null && !(Number(g.holder_count) > 0);

  return {
    chain: { id: Number(chainId), name: CHAIN_NAMES[chainId] },
    address,
    symbol: g.token_symbol ?? null,
    name: g.token_name ?? null,
    honeypot: {
      isHoneypot: yes(g.is_honeypot) || sim?.honeypotResult?.isHoneypot === true,
      basis: simulated ? 'static analysis + live buy/sell simulation' : 'static analysis',
      simulated,
      simSupported: SIMULATION_CHAINS.has(chainId),
      buyTaxPct: buyTax,
      sellTaxPct: sellTax,
      transferTaxPct: pct(g.transfer_tax) ?? sim?.simulationResult?.transferTax ?? null,
    },
    contract: {
      openSource: g.is_open_source != null ? yes(g.is_open_source) : null,
      proxy: g.is_proxy != null ? yes(g.is_proxy) : null,
      mintable: g.is_mintable != null ? yes(g.is_mintable) : null,
      selfdestruct: g.selfdestruct != null ? yes(g.selfdestruct) : null,
      hiddenOwner: g.hidden_owner != null ? yes(g.hidden_owner) : null,
      transferPausable: g.transfer_pausable != null ? yes(g.transfer_pausable) : null,
      blacklistFunction: g.is_blacklisted != null ? yes(g.is_blacklisted) : null,
    },
    owner: {
      address: g.owner_address || null,
      percent: g.owner_percent != null ? pct(g.owner_percent) : null,
      canTakeBackOwnership: g.can_take_back_ownership != null ? yes(g.can_take_back_ownership) : null,
      canChangeBalance: g.owner_change_balance != null ? yes(g.owner_change_balance) : null,
    },
    liquidity: {
      inDex: g.is_in_dex != null ? yes(g.is_in_dex) : null,
      topPools: dexPools,
      lpHolderCount: g.lp_holder_count != null ? Number(g.lp_holder_count) : null,
    },
    holders: {
      count: g.holder_count != null ? Number(g.holder_count) : null,
      top10Pct: top10,
    },
    score: s,
    flags,
    dataSparse,
  };
}
