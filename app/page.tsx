"use client";

import { useState } from "react";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("15m");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setOut(null);
    setLoading(true);
    try {
      const fd = new FormData();
      if (file) fd.append("image", file);
      fd.append("symbol", symbol);
      fd.append("timeframe", timeframe);

      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل الطلب");
      setOut(data);
    } catch (e: any) {
      setError(e.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  const plans = out?.result?.plans ?? [];

  return (
    <main className="card">
      <h1>SMC Plan Generator (Crypto Spot)</h1>
      <small className="badge">مخرجات مزدوجة: LONG + SELL/EXIT — Entry/SL/TP + فريم الإغلاق</small>

      <hr />

      <div className="row">
        <div>
          <label>ارفع صورة الشارت (اختياري)</label>
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <small>الصورة للعرض/التوثيق. المستويات تُحسب من OHLC (Binance).</small>
        </div>

        <div>
          <label>Symbol (Binance)</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="BTCUSDT" />

          <div style={{ height: 10 }} />

          <label>Timeframe</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
        </div>
      </div>

      <div style={{ height: 12 }} />
      <button disabled={loading} onClick={submit}>
        {loading ? "جاري التوليد..." : "توليد الخطة"}
      </button>

      {error && (
        <>
          <div style={{ height: 12 }} />
          <div className="card" style={{ borderColor: "#7f1d1d", background: "#120b0b" }}>
            <b>خطأ:</b> {error}
          </div>
        </>
      )}

      {out && (
        <>
          <hr />
          <small>{out.disclaimer}</small>

          <h2>ملخص</h2>
          <div className="grid3">
            <div className="kv"><b>السعر الحالي</b>{out.result.price_now}</div>
            <div className="kv"><b>Trend hint</b>{out.result.trend_hint}</div>
            <div className="kv"><b>فريم الإغلاق</b>{out.meta.timeframe}</div>
          </div>

          <h2>الخطط</h2>
          {plans.map((p: any, i: number) => (
            <div key={i} className="card" style={{ marginTop: 10 }}>
              <div className="grid3">
                <div className="kv"><b>Side</b>{p.side}</div>
                <div className="kv"><b>Confirmation TF</b>{p.confirmation_tf}</div>
                <div className="kv"><b>Type</b>{p.type}</div>
              </div>

              <div style={{ height: 10 }} />
              <div className="kv"><b>Entry Rule</b>{p.entry_rule}</div>

              <div className="grid3" style={{ marginTop: 10 }}>
                <div className="kv"><b>Entry Zone</b>{p.entry_zone[0]} → {p.entry_zone[1]}</div>
                <div className="kv"><b>Stop Loss</b>{p.stop_loss}</div>
                <div className="kv"><b>Expiry</b>{p.expiry}</div>
              </div>

              <div className="kv" style={{ marginTop: 10 }}>
                <b>Targets</b>
                {p.targets.map((t: any, idx: number) => (
                  <div key={idx}>TP{idx + 1}: {t}</div>
                ))}
              </div>

              <div className="kv" style={{ marginTop: 10 }}>
                <b>Invalidation</b>
                {p.invalidation}
              </div>
            </div>
          ))}

          <h2>JSON</h2>
          <pre>{JSON.stringify(out, null, 2)}</pre>
        </>
      )}
    </main>
  );
}
