import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://hexel-tech.de",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function GET() { return NextResponse.json({ ok: true }, { headers: corsHeaders }); }

export async function POST(req) {
  try {
    const { message = "ping", history = [], system } = await req.json().catch(()=>({}));
    const HF_API_KEY = process.env.HF_API_KEY ;
    const HF_MODEL   = process.env.HF_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct";
console.log(HF_API_KEY);

    // 1) Env-Diagnose (ohne Secrets zu leaken)
    if (!HF_API_KEY) {
      return NextResponse.json({ error: "HF_API_KEY fehlt (Vercel Env-Var setzen)" }, { status: 500, headers: corsHeaders });
    }

    // 2) Minimaler Provider-Call (zeigt 401/403/503 sauber an)
    const r = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: `user: ${message}\nassistant:`,
        parameters: { max_new_tokens: 8, return_full_text: false },
        options: { wait_for_model: true }
      }),
    });

    const raw = await r.text();
    if (!r.ok) {
      let parsed; try { parsed = JSON.parse(raw); } catch {}
      return NextResponse.json(
        { error: parsed?.error || raw || "HF-Fehler ohne Nachricht", status: r.status, model: HF_MODEL },
        { status: 502, headers: corsHeaders }
      );
    }

    let txt = ""; try { const data = JSON.parse(raw); txt = Array.isArray(data) ? (data[0]?.generated_text||"") : (data?.generated_text||""); } catch { txt = raw; }
    return NextResponse.json({ ok: true, model: HF_MODEL, sample: String(txt).slice(0,120) }, { headers: corsHeaders });
  } catch (e) {
    return NextResponse.json({ error: "Serverfehler", details: String(e?.message || e) }, { status: 500, headers: corsHeaders });
  }
}
