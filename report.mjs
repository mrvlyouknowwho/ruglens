const PROMO_CHANNEL = process.env.PROMO_CHANNEL || 'FreshPoolsFeed';

const FLAG_TEXT = {
  en: {
    static_honeypot: '🚨 Flagged as honeypot (static analysis)',
    simulated_honeypot: '🚨 Honeypot confirmed by live buy/sell simulation',
    cannot_sell_all: '⛔ Holders cannot sell their full balance',
    cannot_buy: '⛔ Token cannot be bought',
    owner_can_change_balance: '🚨 Owner can edit any holder balance',
    no_dex_liquidity: '💧 No DEX liquidity found',
    hidden_owner: '🕵️ Hidden owner',
    selfdestruct: '💣 Contract contains selfdestruct',
    can_take_back_ownership: '↩️ Renounced ownership can be taken back',
    not_open_source: '📕 Contract is not open source',
    high_tax: '💸 High buy/sell tax (>10%)',
    creator_prior_honeypots: '🧾 Creator deployed honeypots before',
    transfer_pausable: '⏸ Transfers can be paused',
    blacklist_function: '🚫 Blacklist function present',
    mintable: '🖨 Supply can be minted',
    holder_concentration_high: '🐋 Top-10 holders own most of supply',
    trading_cooldown: '🕐 Trading cooldown mechanism',
    proxy_contract: '🔀 Upgradeable proxy contract',
    mint_not_revoked: '🖨 Mint authority not revoked',
    admin_present: '👤 Admin address still set',
    few_holders: '👥 Very few holders (<25)',
    dex_blacklisted: '🚫 Blacklisted on STON.fi',
    taxable_transfer: '💸 Transfer tax detected',
    freeze_authority: '🥶 Freeze authority active — accounts can be frozen',
    closable_accounts: '💣 Token accounts can be closed by authority',
    non_transferable: '⛔ Token is non-transferable',
    transfer_hook: '🪝 Transfer hook program attached',
  },
  ru: {
    static_honeypot: '🚨 Флаг honeypot (статический анализ)',
    simulated_honeypot: '🚨 Honeypot подтверждён живой симуляцией покупки/продажи',
    cannot_sell_all: '⛔ Держатели не могут продать весь баланс',
    cannot_buy: '⛔ Токен нельзя купить',
    owner_can_change_balance: '🚨 Владелец может менять баланс любого держателя',
    no_dex_liquidity: '💧 Ликвидность на DEX не найдена',
    hidden_owner: '🕵️ Скрытый владелец',
    selfdestruct: '💣 В контракте есть selfdestruct',
    can_take_back_ownership: '↩️ Отказ от владения можно откатить',
    not_open_source: '📕 Контракт с закрытым кодом',
    high_tax: '💸 Высокий налог на покупку/продажу (>10%)',
    creator_prior_honeypots: '🧾 Создатель уже деплоил honeypot‑ы',
    transfer_pausable: '⏸ Переводы можно поставить на паузу',
    blacklist_function: '🚫 Есть функция чёрного списка',
    mintable: '🖨 Эмиссию можно увеличивать',
    holder_concentration_high: '🐋 Топ-10 держателей владеют большей частью эмиссии',
    trading_cooldown: '🕐 Механизм кулдауна торговли',
    proxy_contract: '🔀 Обновляемый proxy-контракт',
    mint_not_revoked: '🖨 Права на минт не отозваны',
    admin_present: '👤 Админ-адрес не обнулён',
    few_holders: '👥 Очень мало держателей (<25)',
    dex_blacklisted: '🚫 В чёрном списке STON.fi',
    taxable_transfer: '💸 Обнаружен налог на перевод',
    freeze_authority: '🥶 Freeze authority активна — аккаунты можно заморозить',
    closable_accounts: '💣 Токен-аккаунты может закрыть authority',
    non_transferable: '⛔ Токен нельзя переводить',
    transfer_hook: '🪝 К переводам прикреплена hook-программа',
  },
};

const T = {
  en: {
    verdict_high: '🔴 HIGH RISK',
    verdict_mid: '🟡 SUSPICIOUS',
    verdict_low: '🟢 NO MAJOR FLAGS',
    risk_score: 'Risk score',
    flags: 'Flags',
    no_flags: 'No risk flags triggered.',
    taxes: 'Taxes',
    buy: 'buy',
    sell: 'sell',
    holders: 'Holders',
    top10: 'top-10 hold',
    liquidity: 'Liquidity',
    pools: 'top pools',
    supply: 'Supply checks',
    open_source: 'open source',
    proxy: 'proxy',
    mintable: 'mintable',
    mint_revoked: 'mint revoked',
    admin: 'admin set',
    sim_basis: 'Verified with live buy/sell simulation',
    static_basis: 'Static analysis only (no simulation on this chain)',
    sim_failed_basis: 'Static analysis only (simulation not available for this token yet)',
    disclaimer: 'Automated heuristics, not financial advice. DYOR.',
    yes: 'yes',
    no: 'no',
    unknown: '?',
    verdict_new: '⏳ TOO NEW TO VERIFY',
    too_new:
      'This token is too fresh — analysis sources haven\'t indexed it yet, so holder, contract ' +
      'and liquidity data are missing. That is itself a risk: unverified fresh launches are where ' +
      'most rugs live. Treat as high risk until proven otherwise.\n\nRescan in ~15–30 min for a full report.',
    known_so_far: 'Known so far',
  },
  ru: {
    verdict_high: '🔴 ВЫСОКИЙ РИСК',
    verdict_mid: '🟡 ПОДОЗРИТЕЛЬНО',
    verdict_low: '🟢 СЕРЬЁЗНЫХ ФЛАГОВ НЕТ',
    risk_score: 'Риск-скор',
    flags: 'Флаги',
    no_flags: 'Ни один риск-флаг не сработал.',
    taxes: 'Налоги',
    buy: 'покупка',
    sell: 'продажа',
    holders: 'Держатели',
    top10: 'у топ-10',
    liquidity: 'Ликвидность',
    pools: 'топ-пулы',
    supply: 'Проверки контракта',
    open_source: 'открытый код',
    proxy: 'proxy',
    mintable: 'минтуемый',
    mint_revoked: 'минт отозван',
    admin: 'есть админ',
    sim_basis: 'Проверено живой симуляцией покупки/продажи',
    static_basis: 'Только статический анализ (симуляция недоступна на этой сети)',
    sim_failed_basis: 'Только статический анализ (симуляция для этого токена пока недоступна)',
    disclaimer: 'Автоматическая эвристика, не финансовый совет. DYOR.',
    yes: 'да',
    no: 'нет',
    unknown: '?',
    verdict_new: '⏳ СЛИШКОМ СВЕЖИЙ ДЛЯ ПРОВЕРКИ',
    too_new:
      'Токен появился только что — источники анализа его ещё не проиндексировали, поэтому данных ' +
      'о держателях, контракте и ликвидности нет. Это само по себе риск: непроверенные свежие запуски — ' +
      'главная среда обитания рагов. Считай высокорисковым, пока не доказано обратное.\n\nПересканируй через ~15–30 минут.',
    known_so_far: 'Что видно уже сейчас',
  },
};

export function pickLang(code) {
  return (code || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function verdict(score, t) {
  if (score >= 50) return t.verdict_high;
  if (score >= 20) return t.verdict_mid;
  return t.verdict_low;
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const bool = (v, t) => (v == null ? t.unknown : v ? t.yes : t.no);

function basisLine(r, t) {
  if (r.honeypot.simulated) return t.sim_basis;
  return r.honeypot.simSupported ? t.sim_failed_basis : t.static_basis;
}

function header(r, t, sparse) {
  const title = [r.symbol && `$${r.symbol}`, r.name].filter(Boolean).join(' — ') || r.address;
  const top = sparse
    ? `<b>${t.verdict_new}</b>`
    : `<b>${verdict(r.score, t)}</b> · ${t.risk_score}: <b>${r.score}/100</b>`;
  return [top, `<b>${esc(title)}</b> · ${esc(r.chain.name)}`, `<code>${esc(r.address)}</code>`, ''];
}

export function formatEvmReport(r, lang, botUsername) {
  const t = T[lang];
  const ft = FLAG_TEXT[lang];
  const lines = header(r, t, r.dataSparse);

  if (r.dataSparse) {
    lines.push(t.too_new);
    const known = [];
    if (r.honeypot.simulated && r.honeypot.buyTaxPct != null && r.honeypot.sellTaxPct != null) {
      known.push(`💸 ${t.taxes}: ${t.buy} ${r.honeypot.buyTaxPct}% · ${t.sell} ${r.honeypot.sellTaxPct}%`);
    }
    const realPools = (r.liquidity.topPools || []).filter((p) => p.liquidityUsd >= 100);
    if (realPools.length) {
      known.push(`💧 ${t.liquidity}: ${realPools.map((p) => `${esc(p.name)} $${Math.round(p.liquidityUsd).toLocaleString('en-US')}`).join(', ')}`);
    }
    if (known.length) {
      lines.push('');
      lines.push(`<b>${t.known_so_far}:</b>`);
      lines.push(...known);
    }
  } else {
    if (r.flags.length) {
      for (const f of r.flags) lines.push(ft[f] || f);
    } else {
      lines.push(t.no_flags);
    }
    lines.push('');
    const tax = [];
    if (r.honeypot.buyTaxPct != null) tax.push(`${t.buy} ${r.honeypot.buyTaxPct}%`);
    if (r.honeypot.sellTaxPct != null) tax.push(`${t.sell} ${r.honeypot.sellTaxPct}%`);
    if (tax.length) lines.push(`💸 ${t.taxes}: ${tax.join(' · ')}`);
    if (r.holders.count != null) {
      const conc = r.holders.top10Pct != null ? ` · ${t.top10} ${r.holders.top10Pct}%` : '';
      lines.push(`👥 ${t.holders}: ${r.holders.count}${conc}`);
    }
    if (r.liquidity.topPools?.length) {
      const pools = r.liquidity.topPools.map((p) => `${esc(p.name)} $${Math.round(p.liquidityUsd).toLocaleString('en-US')}`).join(', ');
      lines.push(`💧 ${t.liquidity}: ${pools}`);
    }
    lines.push(`🧾 ${t.supply}: ${t.open_source} ${bool(r.contract.openSource, t)} · ${t.proxy} ${bool(r.contract.proxy, t)} · ${t.mintable} ${bool(r.contract.mintable, t)}`);
  }

  lines.push('');
  lines.push(`<i>${basisLine(r, t)}. ${t.disclaimer}</i>`);
  if (botUsername) lines.push(`🔍 @${botUsername} · 📡 @${PROMO_CHANNEL}`);
  return lines.join('\n');
}

export function formatSolReport(r, lang, botUsername) {
  const t = T[lang];
  const ft = FLAG_TEXT[lang];
  const lines = header(r, t, r.dataSparse);

  if (r.dataSparse) {
    lines.push(t.too_new);
    if (r.supply.mintAuthorityActive != null || r.supply.freezeAuthorityActive != null) {
      lines.push('');
      lines.push(`<b>${t.known_so_far}:</b>`);
      lines.push(`🧾 ${t.supply}: ${t.mint_revoked} ${bool(r.supply.mintAuthorityActive == null ? null : !r.supply.mintAuthorityActive, t)} · freeze ${bool(r.supply.freezeAuthorityActive, t)}`);
      const authFlags = r.flags.filter((f) => ['mintable', 'freeze_authority', 'owner_can_change_balance', 'closable_accounts', 'non_transferable', 'transfer_hook'].includes(f));
      for (const f of authFlags) lines.push(ft[f] || f);
    }
  } else {
    if (r.flags.length) {
      for (const f of r.flags) lines.push(ft[f] || f);
    } else {
      lines.push(t.no_flags);
    }
    lines.push('');
    if (r.transferFeePct != null && r.transferFeePct > 0) lines.push(`💸 ${t.taxes}: ${r.transferFeePct}%`);
    if (r.holders.count != null) {
      const conc = r.holders.top10Pct != null ? ` · ${t.top10} ${r.holders.top10Pct}%` : '';
      lines.push(`👥 ${t.holders}: ${r.holders.count}${conc}`);
    }
    if (r.liquidity.topPools?.length) {
      const pools = r.liquidity.topPools.map((p) => `${esc(p.name)} $${Math.round(p.liquidityUsd).toLocaleString('en-US')}`).join(', ');
      lines.push(`💧 ${t.liquidity}: ${pools}`);
    }
    lines.push(`🧾 ${t.supply}: ${t.mint_revoked} ${bool(r.supply.mintAuthorityActive == null ? null : !r.supply.mintAuthorityActive, t)} · freeze ${bool(r.supply.freezeAuthorityActive, t)}`);
  }

  lines.push('');
  lines.push(`<i>${t.static_basis}. ${t.disclaimer}</i>`);
  if (botUsername) lines.push(`🔍 @${botUsername} · 📡 @${PROMO_CHANNEL}`);
  return lines.join('\n');
}

export function formatTonReport(r, lang, botUsername) {
  const t = T[lang];
  const ft = FLAG_TEXT[lang];
  const lines = [];
  const title = [r.symbol && `$${r.symbol}`, r.name].filter(Boolean).join(' — ') || r.address;
  lines.push(`<b>${verdict(r.score, t)}</b> · ${t.risk_score}: <b>${r.score}/100</b>`);
  lines.push(`<b>${esc(title)}</b> · TON`);
  lines.push(`<code>${esc(r.address)}</code>`);
  lines.push('');
  if (r.flags.length) {
    for (const f of r.flags) lines.push(ft[f] || f);
  } else {
    lines.push(t.no_flags);
  }
  lines.push('');
  if (r.holdersCount != null) {
    const conc = r.holders.top10Pct != null ? ` · ${t.top10} ${r.holders.top10Pct}%` : '';
    lines.push(`👥 ${t.holders}: ${r.holdersCount}${conc}`);
  }
  if (r.liquidity?.listed && r.liquidity.priceUsd != null) {
    const tier = r.liquidity.liquidityTier ? ` (${r.liquidity.liquidityTier})` : '';
    lines.push(`💧 ${t.liquidity}: STON.fi $${r.liquidity.priceUsd}${tier}`);
  }
  lines.push(`🧾 ${t.supply}: ${t.mint_revoked} ${bool(r.mintRevoked, t)} · ${t.admin} ${bool(r.flags.includes('admin_present'), t)}`);
  lines.push('');
  lines.push(`<i>${t.disclaimer}</i>`);
  if (botUsername) lines.push(`🔍 @${botUsername} · 📡 @${PROMO_CHANNEL}`);
  return lines.join('\n');
}
