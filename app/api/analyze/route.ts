import { NextResponse } from "next/server";

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

function atr(candles: Candle[], period = 14) {
  if (candles.length < period + 2) {
    const avg = candles.reduce((s, x) => s + (x.h - x.l), 0) / Math.max(1, candles.length);
    return Math.max(1e-9, avg);
  }
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].h, l = candles[i].l, pc = candles[i - 1].c;
    tr.push(Math.max(h - l, Math.max(Math.abs(h - pc), Math.abs(l - pc))));
  }
  const slice = tr.slice(-period);
  return slice.reduce((s, x) => s + x, 0) / slice.length;
}

function swings(candles: Candle[], left = 2, right = 2) {
  const highs = candles.map(x => x.h);
  const lows = candles.map(x => x.l);
  const sh: Array<[number, number]> = [];
  const sl: Array<[number, number]> = [];

  for (let i = left; i < candles.length - right; i++) {
    const wH = highs.slice(i - left, i + right + 1);
    const wL = lows.slice(i - left, i + right + 1);
    const maxH = Math.max(...wH);
    const minL = Math.min(...wL);

    if (highs[i] === maxH && highs[i] > Math.max(...wH.filter((_, idx) => idx !== left))) sh.push([i, highs[i]]);
    if (lows[i] === minL && lows[i] < Math.min(...wL.filter((_, idx) => idx !== left))) sl.push([i, lows[i]]);
  }
  return { sh, sl };
}

function inferTrend(sh: Array<[number, number]>, sl: Array<[number, number]>) {
  if (sh.length < 2 || sl.length < 2) return "neutral";
  const h1 = sh[sh.length - 2][1], h2 = sh[sh.length - 1][1];
  const l1 = sl[sl.length - 2][1], l2 = sl[sl.length - 1][1];
  if (h2 < h1 && l2 < l1) return "bearish";
  if (h2 > h1 && l2 > l1) return "bullish";
  return "neutral";
}

function buildPlans(candles: Candle[], timeframe: string) {
  const price = candles[candles.length - 1].c;
  const A = atr(candles, 14);
  const { sh, sl } = swings(candles, 2, 2);
  const trend = inferTrend(sh, sl);

  const lastSh = sh.length ? sh[sh.length - 1][1] : price + A;
  const lastSl = sl.length ? sl[sl.length - 1][1] : price - A;

  const longZone = [+(lastSl + 0.15 * A).toFixed(2), +(lastSl + 0.45 * A).toFixed(2)];
  const shortZone = [+(lastSh - 0.45 * A).toFixed(2), +(lastSh - 0.15 * A).toFixed(2)];

  const longSL = +(lastSl - 0.35 * A).toFixed(2);
  const shortSL = +(lastSh + 0.35 * A).toFixed(2);

  const longMid = (longZone[0] + longZone[1]) / 2;
  const shortMid = (shortZone[0] + shortZone[1]) / 2;

  const riskL = Math.max(1e-9, Math.abs(longMid - longSL));
  const riskS = Math.max(1e-9, Math.abs(shortSL - shortMid));

  const longTPs = [
    +(longMid + 2 * riskL).toFixed(2),
    +(longMid + 3 * riskL).toFixed(2),
    +(longMid + 4 * riskL).toFixed(2),
  ];

  const shortTPs = [
    +(shortMid - 2 * riskS).toFixed(2),
    +(shortMid - 3 * riskS).toFixed(2),
    +(shortMid - 4 * riskS).toFixed(2),
  ];

  return {
    price_now: +price.toFixed(2),
    trend_hint: trend,
    atr: +A.toFixed(2),
    plans: [
      {
        side: "LONG",
        type: "SPOT",
        confirmation_tf: timeframe,
        entry_rule: `${timeframe} close > ${longZone[1]} then retest zone`,
        entry_zone: longZone,
        stop_loss: longSL,
        targets: longTPs,
        invalidation: `${timeframe} close < ${longSL}`,
        expiry: `if no trigger within 12 candles on ${timeframe}, cancel`,
      },
      {
        side: "SELL/EXIT",
        type: "SPOT",
        confirmation_tf: timeframe,
        entry_rule: `${timeframe} close < ${shortZone[0]} then retest zone (sell/exit signal)`,
        entry_zone: shortZone,
        stop_loss: shortSL,
        targets: shortTPs,
        invalidation: `${timeframe} close > ${shortSL}`,
        expiry: `if no trigger within 12 candles on ${timeframe}, cancel`,
      },
    ],
  };
}

const DISCLAIMER =
  "تنبيه: هذا تقرير تعليمي/معلوماتي وليس نصيحة مالية أو توصية استثمارية. التداول عالي المخاطر وقد تخسر رأس المال. أنت المسؤول عن قرارك.";

export async function POST(req: Request) {
  const formData = await req.formData();
  const symbol = String(formData.get("symbol") || "BTCUSDT").toUpperCase();
  const timeframe = String(formData.get("timeframe") || "15m");

  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", timeframe);
  url.searchParams.set("limit", "500");

  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "Binance API error" }, { status: 500 });

  const klines = await r.json();
  const candles: Candle[] = klines.map((k: any[]) => ({
    t: Number(k[0]),
    o: Number(k[1]),
    h: Number(k[2]),
    l: Number(k[3]),
    c: Number(k[4]),
    v: Number(k[5]),
  }));

  const result = buildPlans(candles, timeframe);

  return NextResponse.json({
    meta: { market: "crypto", symbol, timeframe, mode: "spot_only" },
    disclaimer: DISCLAIMER,
    result,
  });
}
