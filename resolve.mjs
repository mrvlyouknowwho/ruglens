const DEXSCREENER = 'https://api.dexscreener.com/latest/dex/tokens/';

// dexscreener chainId -> our chain key (must match evm-analyzer CHAIN_IDS keys)
const DS_CHAINS = {
  ethereum: 'ethereum', bsc: 'bsc', base: 'base', arbitrum: 'arbitrum',
  polygon: 'polygon', optimism: 'optimism', avalanche: 'avalanche',
};

export const EVM_RE = /\b0x[0-9a-fA-F]{40}\b/;
export const TON_RE = /\b(?:EQ|UQ)[A-Za-z0-9_-]{46}\b/;
export const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function detectAddress(text) {
  const t = (text || '').trim();
  const evm = t.match(EVM_RE);
  if (evm) return { kind: 'evm', address: evm[0] };
  const ton = t.match(TON_RE);
  if (ton) return { kind: 'ton', address: ton[0] };
  if (SOL_RE.test(t)) return { kind: 'sol', address: t };
  return null;
}

// One keyless call instead of probing 7 chains. Returns chains sorted by USD liquidity.
export async function resolveEvmChains(address) {
  const r = await fetch(DEXSCREENER + address, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`dexscreener -> ${r.status}`);
  const body = await r.json();
  const pairs = Array.isArray(body.pairs) ? body.pairs : [];
  const byChain = new Map();
  for (const p of pairs) {
    const chain = DS_CHAINS[p.chainId];
    if (!chain) continue;
    const liq = Number(p.liquidity?.usd) || 0;
    byChain.set(chain, (byChain.get(chain) || 0) + liq);
  }
  return [...byChain.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chain, liquidityUsd]) => ({ chain, liquidityUsd }));
}
