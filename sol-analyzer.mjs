const GOPLUS_SOL = 'https://api.gopluslabs.io/api/v1/solana/token_security';

const on = (v) => v === '1' || v === 1 || v === true;
const auth = (a) => (a && on(a.status) ? true : a ? false : null);

const WEIGHTS = {
  non_transferable: 30, owner_can_change_balance: 30, no_dex_liquidity: 30,
  freeze_authority: 25, closable_accounts: 25,
  mintable: 15, transfer_hook: 15, holder_concentration_high: 15, taxable_transfer: 10,
};

export async function assessSol(address) {
  const r = await fetch(`${GOPLUS_SOL}?contract_addresses=${address}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`goplus solana -> ${r.status}`);
  const body = await r.json();
  const t = body.result?.[address];
  if (!t) throw new Error('token not found on Solana');

  const flags = [];
  if (on(t.non_transferable)) flags.push('non_transferable');
  if (auth(t.balance_mutable_authority)) flags.push('owner_can_change_balance');
  if (auth(t.freezable)) flags.push('freeze_authority');
  if (auth(t.closable)) flags.push('closable_accounts');
  if (auth(t.mintable)) flags.push('mintable');
  if (Array.isArray(t.transfer_hook) && t.transfer_hook.length) flags.push('transfer_hook');
  const feePct = t.transfer_fee?.fee_rate != null ? +(Number(t.transfer_fee.fee_rate) * 100).toFixed(2) : null;
  if ((feePct ?? 0) > 0) flags.push('taxable_transfer');

  const pools = Array.isArray(t.dex)
    ? t.dex
        .map((d) => ({ name: d.dex_name, liquidityUsd: Number(d.tvl) || 0 }))
        .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
        .slice(0, 3)
    : [];
  const tvl = pools.reduce((a, p) => a + p.liquidityUsd, 0);
  if (Array.isArray(t.dex) && !t.dex.length) flags.push('no_dex_liquidity');

  const holderCount = t.holder_count != null ? Number(t.holder_count) : null;
  const top10 = Array.isArray(t.holders) && t.holders.length
    ? +(t.holders.slice(0, 10).reduce((a, h) => a + (Number(h.percent) || 0), 0) * 100).toFixed(2)
    : null;
  if (top10 != null && top10 > 80 && (holderCount ?? 0) > 50) flags.push('holder_concentration_high');

  const score = on(t.trusted_token) ? 0 : Math.min(100, flags.reduce((a, f) => a + (WEIGHTS[f] || 10), 0));

  // GoPlus lags minutes-old mints: metadata arrives instantly but holders/dex don't
  const dataSparse = !(holderCount > 0) && !pools.length;

  return {
    chain: { name: 'solana' },
    address,
    symbol: t.metadata?.symbol || null,
    name: t.metadata?.name || null,
    supply: {
      mintAuthorityActive: auth(t.mintable),
      freezeAuthorityActive: auth(t.freezable),
      metadataMutable: t.metadata_mutable ? auth(t.metadata_mutable) : null,
    },
    transferFeePct: feePct,
    liquidity: { topPools: pools, totalUsd: +tvl.toFixed(2) },
    holders: { count: holderCount, top10Pct: top10 },
    trusted: on(t.trusted_token),
    score,
    flags,
    dataSparse,
  };
}
