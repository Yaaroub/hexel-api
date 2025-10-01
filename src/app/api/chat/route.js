import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://hexel-tech.de",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function GET() { return NextResponse.json({ ok: true }, { headers: corsHeaders }); }

// --- Llama 3.1 Chat-Template ---
function buildLlamaPrompt({ system, history = [], message }) {
  const S="<|start_header_id|>", E="<|end_header_id|>", EOT="<|eot_id|>", BOT="<|begin_of_text|>";
  const sys = `${S}system${E}\n${(system || "Antworte kurz, präzise und auf Deutsch.").trim()}\n${EOT}`;
  const hist = (history || []).slice(-6).map(m=>{
    const role = m.role === "assistant" ? "assistant" : "user";
    return `${S}${role}${E}\n${(m.content || "").trim()}\n${EOT}`;
  }).join("");
  const userTurn = `${S}user${E}\n${(message || "").trim()}\n${EOT}`;
  const assistantCue = `${S}assistant${E}\n`;
  return `${BOT}${sys}${hist}${userTurn}${assistantCue}`;
}

export async function POST(req) {
  try {
    const { message = "ping", history = [], system } = await req.json().catch(()=>({}));
    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL   = process.env.HF_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct";

    if (!HF_API_KEY) {
      return NextResponse.json({ error: "HF_API_KEY fehlt (Vercel Env-Var setzen)" }, { status: 500, headers: corsHeaders });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message fehlt oder ungültig" }, { status: 400, headers: corsHeaders });
    }

    const prompt = buildLlamaPrompt({ system, history, message });

    const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 256, temperature: 0.3, top_p: 0.9, do_sample: true,
          return_full_text: false, stop: ["<|eot_id|>"], repetition_penalty: 1.07,
        },
        options: { wait_for_model: true },
      }),
    });

    const raw = await r.text(); // niemals blind .json()

    if (!r.ok) {
      // HF sendet *manchmal* Plaintext ("Not Found") → gib das 1:1 zurück
      let parsed;
      try { parsed = JSON.parse(raw); } catch {}
      return NextResponse.json(
        {
          error: parsed?.error || raw || "HF-Fehler ohne Nachricht",
          status: r.status,
          endpoint: url,
          model: HF_MODEL,
        },
        { status: 502, headers: corsHeaders }
      );
    }

    // Erfolgsfall: Antwort extrahieren (robust)
    let reply = "";
    try {
      const data = JSON.parse(raw);
      reply = Array.isArray(data) ? (data[0]?.generated_text || "") : (data?.generated_text || "");
    } catch { reply = raw; }
    reply = String(reply).trim();

    // Echo-Schutz
    const u = (message || "").trim();
    if (reply.toLowerCase().startsWith(u.toLowerCase())) reply = reply.slice(u.length).trim();
    reply = reply.replace(/^assistant:\s*/i, "").trim() || "…";

    return NextResponse.json({ reply, model: HF_MODEL }, { headers: corsHeaders });
  } catch (e) {
    return NextResponse.json(
      { error: "Serverfehler", details: String(e?.message || e) },
      { status: 500, headers: corsHeaders }
    );
  }
}
