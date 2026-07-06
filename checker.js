const GOPLUS_CHAIN = { eth:'1', bsc:'56', base:'8453', arbitrum:'42161', polygon:'137', optimism:'10', avalanche:'43114' };
const HONEYPOT_CHAIN = { eth:'1', bsc:'56', base:'8453' };
const DEX_TO_CHAIN = { ethereum:'eth', bsc:'bsc', base:'base', arbitrum:'arbitrum', polygon:'polygon', optimism:'optimism', avalanche:'avalanche', solana:'solana' };
const CHAIN_LABEL = { eth:'Ethereum', bsc:'BNB Chain', base:'Base', arbitrum:'Arbitrum', polygon:'Polygon', optimism:'Optimism', avalanche:'Avalanche', solana:'Solana' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isEvm = (a) => /^0x[0-9a-fA-F]{40}$/.test(a);
const isTon = (a) => /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(a);
const isSol = (a) => !isTon(a) && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);

async function jget(url){
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if(!r.ok) throw new Error(url.split('/')[2] + ' ' + r.status);
  return r.json();
}

async function detectChain(addr){
  try{
    const d = await jget('https://api.dexscreener.com/latest/dex/tokens/' + addr);
    const pairs = (d.pairs || []).filter(p => DEX_TO_CHAIN[p.chainId]);
    if(!pairs.length) return null;
    pairs.sort((a,b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    return { chain: DEX_TO_CHAIN[pairs[0].chainId], pair: pairs[0] };
  }catch{ return null; }
}

async function dexLiquidity(addr, chain){
  try{
    const d = await jget('https://api.dexscreener.com/latest/dex/tokens/' + addr);
    let pairs = (d.pairs || []);
    if(chain){
      const onChain = pairs.filter(p => DEX_TO_CHAIN[p.chainId] === chain);
      if(onChain.length) pairs = onChain;
    }
    if(!pairs.length) return null;
    pairs.sort((a,b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    return pairs[0];
  }catch{ return null; }
}

function scoreGoPlus(t){
  let score = 0; const flags = [];
  const on = (v) => v === '1' || v === 1 || v === true;
  if(on(t.is_honeypot)){ score += 100; flags.push(['bad','🚨 Flagged as a honeypot (cannot sell)']); }
  if(on(t.cannot_sell_all)){ score += 90; flags.push(['bad','⛔ Holders cannot sell their full balance']); }
  if(on(t.hidden_owner)){ score += 40; flags.push(['bad','🕵️ Hidden owner']); }
  if(on(t.can_take_back_ownership)){ score += 35; flags.push(['bad','↩️ Renounced ownership can be taken back']); }
  if(on(t.is_blacklisted)){ score += 30; flags.push(['warn','🚫 Blacklist function present (owner can block sells)']); }
  if(on(t.selfdestruct)){ score += 40; flags.push(['bad','💣 Contract can self-destruct']); }
  if(on(t.is_mintable)){ score += 20; flags.push(['warn','🪙 Supply is mintable']); }
  if(on(t.is_proxy)){ score += 15; flags.push(['warn','🔁 Proxy contract (logic can change)']); }
  if(on(t.trading_cooldown)){ score += 15; flags.push(['warn','⏳ Trading cooldown enforced']); }
  if(t.is_open_source === '0'){ score += 20; flags.push(['warn','📕 Contract is not open source']); }
  const buy = parseFloat(t.buy_tax) * 100, sell = parseFloat(t.sell_tax) * 100;
  if(sell >= 30){ score += 40; flags.push(['bad', `💸 Very high sell tax: ${sell.toFixed(0)}%`]); }
  else if(sell >= 10){ score += 15; flags.push(['warn', `💸 High sell tax: ${sell.toFixed(0)}%`]); }
  return { score, flags, buyTax: buy, sellTax: sell };
}

function verdict(score, sparse){
  if(sparse) return ['b-warn','⏳ TOO NEW TO VERIFY'];
  if(score >= 70) return ['b-bad','⛔ HIGH RISK'];
  if(score >= 25) return ['b-warn','⚠️ CAUTION'];
  return ['b-ok','✓ NO MECHANICAL SCAM FOUND'];
}

function scoreSolana(t){
  const on = (v) => v === '1' || v === 1 || v === true;
  const auth = (a) => (a && on(a.status) ? true : a ? false : null);
  let score = 0; const flags = [];
  const add = (w, sev, txt) => { score += w; flags.push([sev, txt]); };
  if(on(t.non_transferable)) add(30,'bad','⛔ Token is non-transferable');
  if(auth(t.balance_mutable_authority)) add(30,'bad','🕵️ An authority can change wallet balances');
  if(auth(t.freezable)) add(25,'bad','🧊 Freeze authority active — your tokens can be frozen');
  if(auth(t.closable)) add(25,'bad','🚪 Token accounts can be force-closed by an authority');
  if(auth(t.mintable)) add(15,'warn','🪙 Mint authority active — supply can be inflated');
  if(Array.isArray(t.transfer_hook) && t.transfer_hook.length) add(15,'warn','🪝 Transfer hook installed (custom code runs on every transfer)');
  const feePct = t.transfer_fee?.fee_rate != null ? +(Number(t.transfer_fee.fee_rate) * 100).toFixed(2) : null;
  if((feePct ?? 0) > 0) add(10,'warn',`💸 Transfer fee: ${feePct}%`);
  const holders = t.holder_count != null ? Number(t.holder_count) : null;
  const top10 = Array.isArray(t.holders) && t.holders.length
    ? +(t.holders.slice(0,10).reduce((a,h)=> a + (Number(h.percent)||0), 0) * 100).toFixed(1)
    : null;
  if(top10 != null && top10 > 80 && (holders ?? 0) > 50) add(15,'warn',`🐋 Top 10 wallets hold ${top10}% of supply`);
  const pools = Array.isArray(t.dex) ? t.dex : null;
  const tvl = pools ? pools.reduce((a,d)=> a + (Number(d.tvl)||0), 0) : null;
  if(pools && !pools.length) add(30,'warn','💧 No DEX liquidity found');
  if(on(t.trusted_token)){ score = 0; flags.length = 0; flags.push(['ok','✅ Whitelisted as a trusted token (major established asset)']); }
  const sparse = !(holders > 0) && !(pools && pools.length);
  return { score: Math.min(100, score), flags, holders, top10, tvl, sparse,
           symbol: t.metadata?.symbol || null, name: t.metadata?.name || null };
}

async function runSolana(addr, out){
  out.innerHTML = `<div class="card"><span class="spin"></span> Scanning Solana on-chain data…</div>`;
  const [gpRes, dexRes] = await Promise.allSettled([
    jget(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${addr}`),
    dexLiquidity(addr, 'solana')
  ]);
  if(gpRes.status !== 'fulfilled' || !gpRes.value.result?.[addr]){
    out.innerHTML = `<div class="card">This mint isn’t indexed on Solana yet (or the address is wrong). Very fresh tokens take a few minutes to appear — treat unverifiable tokens as risky by default.
      <div class="cta"><div>Scan it in the bot (with a re-scan button):</div>
      <a class="btn" href="https://t.me/RugLens_bot?start=${encodeURIComponent(addr)}" rel="noopener">Open @RugLens_bot →</a></div></div>`;
    return;
  }
  const s = scoreSolana(gpRes.value.result[addr]);
  const data = { address: addr, chain: 'solana', score: s.score, flags: s.flags,
    buyTax: null, sellTax: null, holders: s.holders, liqUsd: s.tvl, symbol: s.symbol, name: s.name,
    simulated: null, sparse: s.sparse, top10: s.top10 };
  if(dexRes.status === 'fulfilled' && dexRes.value){
    const p = dexRes.value;
    if(data.liqUsd == null) data.liqUsd = p.liquidity?.usd ?? null;
    if(!data.symbol && p.baseToken?.symbol) data.symbol = p.baseToken.symbol;
    if(!data.name && p.baseToken?.name) data.name = p.baseToken.name;
    if(p.liquidity?.usd > 0) data.sparse = false;
  }
  if(data.sparse) data.flags.push(['warn','⏳ Not indexed yet (no holders / no liquidity data) — a minutes-old mint. Unverifiable = risky by default.']);
  render(data);
}

function render(data){
  const [cls,label] = verdict(data.score, data.sparse);
  let flagsHtml = '';
  if(data.flags.length){
    flagsHtml = '<ul class="flags">' + data.flags
      .sort((a,b)=> (a[0]==='bad'?0:1)-(b[0]==='bad'?0:1))
      .map(f => `<li>${esc(f[1])}</li>`).join('') + '</ul>';
  } else {
    flagsHtml = '<ul class="flags"><li>No dangerous contract traits detected.</li></ul>';
  }
  const kv = [];
  if(data.symbol) kv.push(`Token: <b>${esc(data.symbol)}</b>`);
  kv.push(`Chain: <b>${esc(CHAIN_LABEL[data.chain]||data.chain)}</b>`);
  if(data.buyTax!=null) kv.push(`Buy tax: <b>${data.buyTax.toFixed(1)}%</b>`);
  if(data.sellTax!=null) kv.push(`Sell tax: <b>${data.sellTax.toFixed(1)}%</b>`);
  if(data.holders!=null) kv.push(`Holders: <b>${Number(data.holders).toLocaleString('en-US')}</b>`);
  if(data.top10!=null) kv.push(`Top-10 hold: <b>${data.top10}%</b>`);
  if(data.liqUsd!=null) kv.push(`Liquidity: <b>$${Math.round(data.liqUsd).toLocaleString('en-US')}</b>`);
  if(data.simulated) kv.push(`Sell sim: <b>${data.simulated}</b>`);

  $('out').innerHTML = `
    <div class="card">
      <div class="score">
        <span class="badge ${cls}">${label}</span>
        <span class="tok">${esc(data.name || data.symbol || 'Token')}</span>
      </div>
      <div class="addr">${esc(data.address)}</div>
      ${flagsHtml}
      <div class="kv">${kv.join('')}</div>
    </div>
    <div class="cta">
      <div>Want to scan this from your phone, inside a group chat, or check a <strong>TON jetton</strong>? The bot does inline scans and posts fresh pools hourly.</div>
      <a class="btn" href="https://t.me/RugLens_bot?start=${encodeURIComponent(data.address)}" rel="noopener">Re-scan in @RugLens_bot →</a>
    </div>
    <div class="disc">Automated screening only. It can miss risks and can flag safe tokens. Not financial advice.</div>`;
}

async function run(){
  const addr = $('addr').value.trim();
  const out = $('out');
  if(!addr){ out.innerHTML=''; return; }

  if(isTon(addr)){
    out.innerHTML = `<div class="card">TON jettons aren’t supported on this page yet.
      <div class="cta"><div>Scan TON jettons in the bot:</div>
      <a class="btn" href="https://t.me/RugLens_bot?start=${encodeURIComponent(addr)}" rel="noopener">Open @RugLens_bot →</a></div></div>`;
    return;
  }
  if(isSol(addr)){
    $('go').disabled = true;
    try{ await runSolana(addr, out); }
    catch(e){ out.innerHTML = `<div class="card">Couldn’t complete the scan (${esc(e.message||e)}). Try again in a moment, or use <a href="https://t.me/RugLens_bot" rel="noopener">@RugLens_bot</a>.</div>`; }
    finally{ $('go').disabled = false; }
    return;
  }
  if(!isEvm(addr)){
    out.innerHTML = `<div class="card">That doesn’t look like a valid token address. EVM addresses start with <code>0x</code> (42 chars); Solana mints are base58 (32–44 chars).</div>`;
    return;
  }

  $('go').disabled = true;
  out.innerHTML = `<div class="card"><span class="spin"></span> Scanning on-chain data…</div>`;

  try{
    let chain = $('chain').value;
    let detectedPair = null;
    if(chain === 'auto'){
      const det = await detectChain(addr);
      if(det){ chain = det.chain; detectedPair = det.pair; }
      else {
        out.innerHTML = `<div class="card">No DEX liquidity found for this address, so the chain can’t be auto-detected. Pick the network manually and try again.</div>`;
        $('go').disabled = false; return;
      }
    }

    const goplusId = GOPLUS_CHAIN[chain];
    const [gpRes, hpRes, dexRes] = await Promise.allSettled([
      jget(`https://api.gopluslabs.io/api/v1/token_security/${goplusId}?contract_addresses=${addr}`),
      HONEYPOT_CHAIN[chain] ? jget(`https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=${HONEYPOT_CHAIN[chain]}`) : Promise.reject('n/a'),
      detectedPair ? Promise.resolve({pairs:[detectedPair]}) : dexLiquidity(addr, chain).then(p=>({pairs:p?[p]:[]}))
    ]);

    const data = { address: addr, chain, score: 0, flags: [], buyTax:null, sellTax:null, holders:null, liqUsd:null, symbol:null, name:null, simulated:null };

    if(gpRes.status === 'fulfilled'){
      const r = gpRes.value.result || {};
      const t = r[addr.toLowerCase()] || Object.values(r)[0];
      if(t){
        const s = scoreGoPlus(t);
        data.score += s.score; data.flags.push(...s.flags);
        data.buyTax = s.buyTax; data.sellTax = s.sellTax;
        data.holders = t.holder_count != null ? t.holder_count : null;
        data.symbol = t.token_symbol || null; data.name = t.token_name || null;
      }
    }

    if(hpRes.status === 'fulfilled'){
      const h = hpRes.value;
      const isHp = h.honeypotResult?.isHoneypot;
      data.simulated = isHp ? 'HONEYPOT' : 'sell OK';
      if(isHp){ data.score += 100; data.flags.push(['bad','🚨 Live sell simulation failed — this is a honeypot']); }
      if(h.simulationResult){
        if(data.buyTax==null && h.simulationResult.buyTax!=null) data.buyTax = h.simulationResult.buyTax;
        if(data.sellTax==null && h.simulationResult.sellTax!=null) data.sellTax = h.simulationResult.sellTax;
      }
      if(!data.symbol && h.token?.symbol) data.symbol = h.token.symbol;
    }

    if(dexRes.status === 'fulfilled'){
      const p = dexRes.value.pairs?.[0];
      if(p){
        data.liqUsd = p.liquidity?.usd ?? null;
        if(!data.symbol && p.baseToken?.symbol) data.symbol = p.baseToken.symbol;
        if(!data.name && p.baseToken?.name) data.name = p.baseToken.name;
        if(data.liqUsd != null && data.liqUsd < 5000){ data.score += 15; data.flags.push(['warn', `💧 Very low liquidity: $${Math.round(data.liqUsd).toLocaleString('en-US')}`]); }
      } else {
        data.flags.push(['warn','💧 No DEX liquidity found']);
        data.score += 20;
      }
    }

    data.score = Math.min(100, data.score);
    render(data);
  }catch(e){
    out.innerHTML = `<div class="card">Couldn’t complete the scan (${esc(e.message||e)}). Try again in a moment, or use <a href="https://t.me/RugLens_bot" rel="noopener">@RugLens_bot</a>.</div>`;
  }finally{
    $('go').disabled = false;
  }
}

$('go').addEventListener('click', run);
$('addr').addEventListener('keydown', (e)=>{ if(e.key==='Enter') run(); });
// deep-link: ?a=0x…
const qa = new URLSearchParams(location.search).get('a');
if(qa){ $('addr').value = qa; run(); }