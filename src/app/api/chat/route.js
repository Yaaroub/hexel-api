import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// --- CORS Helpers ---
function corsHeaders() {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST { message, history? }" }, { headers: corsHeaders() });
}

// --- Llama 3.1 Chat-Template ---
function buildLlamaPrompt({ system, history = [], message }) {
  const S = "<|start_header_id|>", E = "<|end_header_id|>", EOT = "<|eot_id|>", BOT = "<|begin_of_text|>";
  const sys = `${S}system${E}\n${(system || "Antworte kurz, präzise und auf Deutsch.").trim()}\n${EOT}`;
  const hist = (history || []).slice(-6).map(m => {
    const role = m.role === "assistant" ? "assistant" : "user";
    return `${S}${role}${E}\n${(m.content || "").trim()}\n${EOT}`;
  }).join("");
  const userTurn = `${S}user${E}\n${(message || "").trim()}\n${EOT}`;
  const assistantCue = `${S}assistant${E}\n`;
  return `${BOT}${sys}${hist}${userTurn}${assistantCue}`;
}

export async function POST(req) {
  try {
    const { message, history = [], system } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message fehlt oder ist ungültig" }, { status: 400, headers: corsHeaders() });
    }

    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL   = process.env.HF_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct";
    if (!HF_API_KEY) {
      return NextResponse.json({ error: "HF_API_KEY fehlt (in Vercel setzen)" }, { status: 500, headers: corsHeaders() });
    }

    const prompt = buildLlamaPrompt({ system, history, message });

    const r = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.3,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
          repetition_penalty: 1.07,
          stop: ["<|eot_id|>"],
        },
        options: { wait_for_model: true },
      }),
    });

    const raw = await r.text();
    if (!r.ok) {
      let parsed; try { parsed = JSON.parse(raw); } catch {}
      const msg = parsed?.error || raw || "HF-Fehler ohne Nachricht";
      return NextResponse.json({ error: msg, status: r.status, provider: "hf" }, { status: 502, headers: corsHeaders() });
    }

    let reply = "";
    try {
      const data = JSON.parse(raw);
      reply = Array.isArray(data) ? (data[0]?.generated_text || "") : (data?.generated_text || "");
    } catch { reply = raw; }
    reply = String(reply).trim();

    // Echo-Schere
    const u = message.trim();
    if (reply.toLowerCase().startsWith(u.toLowerCase())) reply = reply.slice(u.length).trim();
    reply = reply.replace(/^assistant:\s*/i, "").trim() || "…";

    return NextResponse.json({ reply, model: HF_MODEL }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ error: "Serverfehler", details: String(e?.message || e) }, { status: 500, headers: corsHeaders() });
  }
}
