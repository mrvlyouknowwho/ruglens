const TONAPI = 'https://tonapi.io';

async function tonapi(path) {
  const headers = process.env.TONAPI_KEY ? { Authorization: `Bearer ${process.env.TONAPI_KEY}` } : {};
  const r = await fetch(`${TONAPI}${path}`, { headers });
  if (!r.ok) throw new Error(`tonapi ${path} -> ${r.status}`);
  return r.json();
}

async function jettonInfo(addr) {
  const j = await tonapi(`/v2/jettons/${addr}`);
  return {
    mintRevoked: j.mintable === false,
    supply: j.total_supply ?? null,
    holdersCount: j.holders_count ?? null,
    admin: j.admin?.address ?? null,
    symbol: j.metadata?.symbol ?? null,
    name: j.metadata?.name ?? null,
  };
}

async function holderConcentration(addr, supply) {
  const h = await tonapi(`/v2/jettons/${addr}/holders?limit=10`);
  const list = h.addresses ?? [];
  const sup = Number(supply) || 0;
  const bal = list.map((x) => Number(x.balance) || 0);
  const pct = (n) => (sup ? +((n / sup) * 100).toFixed(2) : null);
  return {
    top1Pct: bal.length ? pct(bal[0]) : null,
    top10Pct: bal.length ? pct(bal.slice(0, 10).reduce((a, b) => a + b, 0)) : null,
  };
}

async function liquidity(addr) {
  const r = await fetch('https://api.ston.fi/v1/assets/' + encodeURIComponent(addr));
  if (r.status === 404) return { dex: 'ston.fi', listed: false, status: 'not_listed' };
  if (!r.ok) throw new Error('ston.fi -> ' + r.status);
  const a = (await r.json()).asset || {};
  const priceUsd = a.dex_price_usd ? Number(a.dex_price_usd) : null;
  const liqTag = (a.tags || []).find((t) => t.startsWith('asset:liquidity:'));
  return {
    dex: 'ston.fi',
    listed: !!priceUsd,
    priceUsd,
    liquidityTier: liqTag ? liqTag.replace('asset:liquidity:', '') : null,
    popularity: a.popularity_index ?? null,
    blacklisted: !!a.blacklisted,
    taxable: !!a.taxable,
    deprecated: !!a.deprecated,
  };
}

const WEIGHTS = {
  dex_blacklisted: 40, no_dex_liquidity: 30, taxable_transfer: 20,
  mint_not_revoked: 15, holder_concentration_high: 15, few_holders: 10, admin_present: 10,
};

function score(info, holders, liq) {
  const flags = [];
  if (!info.mintRevoked) flags.push('mint_not_revoked');
  if (info.admin) flags.push('admin_present');
  if (holders.top1Pct != null && holders.top1Pct > 30) flags.push('holder_concentration_high');
  if (info.holdersCount != null && info.holdersCount < 25) flags.push('few_holders');
  if (liq && liq.listed === false) flags.push('no_dex_liquidity');
  if (liq && liq.blacklisted) flags.push('dex_blacklisted');
  if (liq && liq.taxable) flags.push('taxable_transfer');
  const s = Math.min(100, flags.reduce((a, f) => a + (WEIGHTS[f] || 10), 0));
  return { score: s, flags };
}

async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

export async function assessTon(address) {
  const info = await jettonInfo(address);
  const holders = await safe(() => holderConcentration(address, info.supply), { top1Pct: null, top10Pct: null });
  const liq = await safe(() => liquidity(address), { dex: 'ston.fi', listed: null, status: 'error' });
  const honeypot = {
    risk: liq.taxable ? 'high' : liq.listed === false ? 'high' : liq.listed ? 'low' : 'unknown',
    basis: 'heuristic: taxable-transfer + dex-liquidity presence',
  };
  return {
    address,
    symbol: info.symbol,
    name: info.name,
    mintRevoked: info.mintRevoked,
    supply: info.supply,
    holdersCount: info.holdersCount,
    holders,
    honeypot,
    liquidity: liq,
    ...score(info, holders, liq),
  };
}
