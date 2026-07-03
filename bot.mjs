import { Bot, InlineKeyboard, GrammyError } from 'grammy';
import { assessEvm } from './evm-analyzer.mjs';
import { assessTon } from './ton-analyzer.mjs';
import { detectAddress, resolveEvmChains } from './resolve.mjs';
import { pickLang, formatEvmReport, formatTonReport } from './report.mjs';
import { consumeCheck, refundCheck, addCredits, getUser, freeLimit, recordPurchase, stats } from './store.mjs';

if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN is required');
  process.exit(1);
}

const PACKS = {
  p100: { checks: 100, stars: 75 },
  p500: { checks: 500, stars: 300 },
};
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;

const MSG = {
  en: {
    start: (limit) =>
      `Send me a token contract address — I return an instant rug/honeypot risk report.\n\n` +
      `Supported: Ethereum, BSC, Base, Arbitrum, Polygon, Optimism, Avalanche + TON jettons.\n\n` +
      `Free: ${limit} checks/day. /buy for more. /help for details.`,
    help: (limit) =>
      `Paste a contract address (0x… for EVM chains, EQ…/UQ… for TON jettons).\n\n` +
      `I check: honeypot (static + live buy/sell simulation where available), taxes, ` +
      `owner powers, mint, blacklist, proxy, holder concentration, DEX liquidity.\n\n` +
      `Free: ${limit} checks/day, then paid packs (/buy). /balance shows what you have left.\n` +
      `Payment issues: /paysupport`,
    balance: (u, limit) => `Today: ${Math.max(0, limit - u.usedToday)}/${limit} free checks left · paid credits: ${u.credits}`,
    buy: 'Extra check packs (paid in Telegram Stars):',
    pack: (p) => `${p.checks} checks — ${p.stars} ⭐`,
    paid: (n, total) => `✅ Payment received. +${n} checks (balance: ${total}).`,
    limit_hit: 'Daily free limit reached. Buy a pack to continue:',
    choose_chain: 'Token not found on DEXes. Which chain is it on?',
    not_found: (chain) => `Token not found on ${chain}. Check the address and chain.`,
    sol: 'Solana is not supported yet — EVM chains and TON only.',
    limit_btn: 'Limit reached — buy a pack',
    error: 'Could not analyze this token right now. Try again in a minute.',
    paysupport: 'Payment problems? Describe the issue in a message starting with /paysupport and it will be reviewed. Refunds are honored for undelivered credits.',
    scanning: '🔎 Scanning…',
  },
  ru: {
    start: (limit) =>
      `Пришли мне адрес контракта токена — верну мгновенный отчёт о рисках (rug/honeypot).\n\n` +
      `Поддержка: Ethereum, BSC, Base, Arbitrum, Polygon, Optimism, Avalanche + TON-джеттоны.\n\n` +
      `Бесплатно: ${limit} проверок в день. /buy — купить ещё. /help — подробности.`,
    help: (limit) =>
      `Вставь адрес контракта (0x… для EVM-сетей, EQ…/UQ… для TON-джеттонов).\n\n` +
      `Проверяю: honeypot (статика + живая симуляция покупки/продажи где доступна), налоги, ` +
      `права владельца, минт, чёрные списки, proxy, концентрацию держателей, ликвидность на DEX.\n\n` +
      `Бесплатно: ${limit} проверок в день, дальше пакеты (/buy). /balance — остаток.\n` +
      `Проблемы с оплатой: /paysupport`,
    balance: (u, limit) => `Сегодня: ${Math.max(0, limit - u.usedToday)}/${limit} бесплатных проверок · платных кредитов: ${u.credits}`,
    buy: 'Пакеты проверок (оплата в Telegram Stars):',
    pack: (p) => `${p.checks} проверок — ${p.stars} ⭐`,
    paid: (n, total) => `✅ Оплата получена. +${n} проверок (баланс: ${total}).`,
    limit_hit: 'Дневной бесплатный лимит исчерпан. Пакет, чтобы продолжить:',
    choose_chain: 'Токен не найден на DEX. На какой он сети?',
    not_found: (chain) => `Токен не найден на ${chain}. Проверь адрес и сеть.`,
    sol: 'Solana пока не поддерживается — только EVM-сети и TON.',
    limit_btn: 'Лимит исчерпан — купить пакет',
    error: 'Не получилось проанализировать токен. Попробуй через минуту.',
    paysupport: 'Проблема с оплатой? Опиши её сообщением, начинающимся с /paysupport — оно будет рассмотрено. Кредиты, не выданные после оплаты, возмещаются.',
    scanning: '🔎 Сканирую…',
  },
};

const bot = new Bot(process.env.BOT_TOKEN);
let BOT_USERNAME = null;

// crude per-user throttle: one scan at a time, min 3s apart
const lastScan = new Map();
function throttled(id) {
  const now = Date.now();
  const prev = lastScan.get(id) || 0;
  if (now - prev < 3_000) return true;
  lastScan.set(id, now);
  if (lastScan.size > 10_000) lastScan.clear();
  return false;
}

function msg(ctx) {
  return MSG[pickLang(ctx.from?.language_code)];
}
function lang(ctx) {
  return pickLang(ctx.from?.language_code);
}

function buyKeyboard(ctx) {
  const m = msg(ctx);
  const kb = new InlineKeyboard();
  for (const [id, p] of Object.entries(PACKS)) kb.text(m.pack(p), `buy|${id}`).row();
  return kb;
}

async function sendReport(ctx, kind, address, chain) {
  const m = msg(ctx);
  const quota = consumeCheck(ctx.from.id);
  if (!quota.ok) {
    await ctx.reply(m.limit_hit, { reply_markup: buyKeyboard(ctx) });
    return;
  }
  const note = await ctx.reply(m.scanning);
  try {
    const text = kind === 'ton'
      ? formatTonReport(await assessTon(address), lang(ctx), BOT_USERNAME)
      : formatEvmReport(await assessEvm(chain, address), lang(ctx), BOT_USERNAME);
    await ctx.api.editMessageText(note.chat.id, note.message_id, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (e) {
    refundCheck(ctx.from.id, quota.source);
    const failText = /not found/i.test(e.message) ? m.not_found(chain || 'TON') : m.error;
    await ctx.api.editMessageText(note.chat.id, note.message_id, failText).catch(() => {});
    console.error(`scan failed kind=${kind} chain=${chain} addr=${address}: ${e.message}`);
  }
}

bot.command('start', (ctx) => {
  if (ctx.match === 'buy') return ctx.reply(msg(ctx).buy, { reply_markup: buyKeyboard(ctx) });
  return ctx.reply(msg(ctx).start(freeLimit()));
});
bot.command('help', (ctx) => ctx.reply(msg(ctx).help(freeLimit())));
bot.command('balance', (ctx) => ctx.reply(msg(ctx).balance(getUser(ctx.from.id), freeLimit())));
bot.command('buy', (ctx) => ctx.reply(msg(ctx).buy, { reply_markup: buyKeyboard(ctx) }));
bot.command('paysupport', (ctx) => ctx.reply(msg(ctx).paysupport));
bot.command('stats', (ctx) => {
  if (ADMIN_ID && ctx.from?.id === ADMIN_ID) return ctx.reply(JSON.stringify(stats(), null, 2));
});

bot.callbackQuery(/^buy\|(p\d+)$/, async (ctx) => {
  const pack = PACKS[ctx.match[1]];
  if (!pack) return ctx.answerCallbackQuery();
  await ctx.answerCallbackQuery();
  const m = msg(ctx);
  await ctx.api.sendInvoice(ctx.chat.id, m.pack(pack), m.pack(pack), ctx.match[1], 'XTR', [
    { label: m.pack(pack), amount: pack.stars },
  ]);
});

bot.callbackQuery(/^c\|([a-z]+)\|(0x[0-9a-fA-F]{40})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await sendReport(ctx, 'evm', ctx.match[2], ctx.match[1]);
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('message:successful_payment', async (ctx) => {
  const p = ctx.message.successful_payment;
  const pack = PACKS[p.invoice_payload];
  const n = pack ? pack.checks : 0;
  const total = addCredits(ctx.from.id, n);
  recordPurchase({
    userId: ctx.from.id,
    payload: p.invoice_payload,
    stars: p.total_amount,
    checks: n,
    chargeId: p.telegram_payment_charge_id,
  });
  await ctx.reply(msg(ctx).paid(n, total));
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text || '';
  const inGroup = ctx.chat.type !== 'private';
  if (inGroup) {
    const mentioned = BOT_USERNAME && text.toLowerCase().includes('@' + BOT_USERNAME.toLowerCase());
    const bare = detectAddress(text) && text.trim().split(/\s+/).length <= 2;
    if (!mentioned && !bare) return;
  }
  const hit = detectAddress(text);
  if (!hit) {
    if (!inGroup) await ctx.reply(msg(ctx).help(freeLimit()));
    return;
  }
  if (throttled(ctx.from.id)) return;
  const m = msg(ctx);

  if (hit.kind === 'sol') {
    await ctx.reply(m.sol);
    return;
  }
  if (hit.kind === 'ton') {
    await sendReport(ctx, 'ton', hit.address);
    return;
  }
  // EVM: resolve chain via DexScreener; on ambiguity/failure ask with buttons
  let chains = [];
  try {
    chains = await resolveEvmChains(hit.address);
  } catch {
    chains = [];
  }
  if (chains.length > 0) {
    await sendReport(ctx, 'evm', hit.address, chains[0].chain);
  } else {
    const kb = new InlineKeyboard();
    const all = ['ethereum', 'bsc', 'base', 'arbitrum', 'polygon', 'optimism', 'avalanche'];
    all.forEach((c, i) => {
      kb.text(c, `c|${c}|${hit.address}`);
      if (i % 3 === 2) kb.row();
    });
    await ctx.reply(m.choose_chain, { reply_markup: kb });
  }
});

// Inline mode: @bot <address> in any chat; result message carries "via @bot".
bot.on('inline_query', async (ctx) => {
  const hit = detectAddress(ctx.inlineQuery.query);
  if (!hit || hit.kind === 'sol') {
    await ctx.answerInlineQuery([], { cache_time: 10 }).catch(() => {});
    return;
  }
  const quota = consumeCheck(ctx.from.id);
  if (!quota.ok) {
    await ctx.answerInlineQuery([], {
      cache_time: 5,
      button: { text: MSG[lang(ctx)].limit_btn, start_parameter: 'buy' },
    }).catch(() => {});
    return;
  }
  try {
    let text, title;
    if (hit.kind === 'ton') {
      const r = await assessTon(hit.address);
      text = formatTonReport(r, lang(ctx), BOT_USERNAME);
      title = `${r.symbol || 'TON jetton'} · risk ${r.score}/100`;
    } else {
      const chains = await resolveEvmChains(hit.address);
      const chain = chains[0]?.chain || 'ethereum';
      const r = await assessEvm(chain, hit.address);
      text = formatEvmReport(r, lang(ctx), BOT_USERNAME);
      title = `${r.symbol ? '$' + r.symbol : hit.address.slice(0, 10)} · ${chain} · risk ${r.score}/100`;
    }
    await ctx.answerInlineQuery(
      [{
        type: 'article',
        id: hit.address.slice(-40),
        title,
        description: 'Rug & honeypot risk report',
        input_message_content: { message_text: text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
      }],
      { cache_time: 300, is_personal: false },
    );
  } catch (e) {
    refundCheck(ctx.from.id, quota.source);
    await ctx.answerInlineQuery([], { cache_time: 5 }).catch(() => {});
    console.error(`inline scan failed addr=${hit.address}: ${e.message}`);
  }
});

bot.catch(({ error, ctx }) => {
  if (error instanceof GrammyError && error.error_code === 403) return; // blocked by user
  console.error('bot error:', error?.message || error, 'update:', ctx?.update?.update_id);
});

const me = await bot.api.getMe();
BOT_USERNAME = me.username;
console.log(`@${BOT_USERNAME} up · free/day=${freeLimit()} · packs=${JSON.stringify(PACKS)}`);
await bot.start();
