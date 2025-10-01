import { NextResponse } from "next/server";

const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://hexel-tech.de",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
export async function GET() { return NextResponse.json({ ok: true, hint: "POST { message, history? }" }, { headers: cors }); }

// Llama-3.1 Chat-Template
function buildPrompt({ system, history = [], message }) {
  const S="<|start_header_id|>", E="<|end_header_id|>", EOT="<|eot_id|>", BOT="<|begin_of_text|>";
  const sys = `${S}system${E}\n${(system||"Antworte kurz, präzise und auf Deutsch.").trim()}\n${EOT}`;
  const hist = (history||[]).slice(-6).map(m=>{
    const role = m.role==="assistant" ? "assistant":"user";
    return `${S}${role}${E}\n${(m.content||"").trim()}\n${EOT}`;
  }).join("");
  const userTurn = `${S}user${E}\n${(message||"").trim()}\n${EOT}`;
  const assistantCue = `${S}assistant${E}\n`;
  return `${BOT}${sys}${hist}${userTurn}${assistantCue}`;
}

export async function POST(req) {
  try {
    const { message, history = [], system } = await req.json().catch(()=>({}));
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message fehlt oder ist ungültig" }, { status: 400, headers: cors });
    }

    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL   = process.env.HF_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct";
    if (!HF_API_KEY) {
      return NextResponse.json({ error: "HF_API_KEY fehlt (in Vercel setzen)" }, { status: 500, headers: cors });
    }

    const endpoint = `https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: buildPrompt({ system, history, message }),
        parameters: {
          max_new_tokens: 256, temperature: 0.3, top_p: 0.9, do_sample: true,
          return_full_text: false, stop: ["<|eot_id|>"], repetition_penalty: 1.07,
        },
        options: { wait_for_model: true },
      }),
    });

    const raw = await r.text(); // HF schickt bei Errors oft Plaintext
    if (!r.ok) {
      let parsed; try { parsed = JSON.parse(raw); } catch {}
      return NextResponse.json(
        { error: parsed?.error || raw || "HF-Fehler ohne Nachricht", status: r.status, model: HF_MODEL, endpoint },
        { status: 502, headers: cors }
      );
    }

    // Antwort extrahieren
    let reply = "";
    try { const data = JSON.parse(raw); reply = Array.isArray(data) ? (data[0]?.generated_text || "") : (data?.generated_text || ""); }
    catch { reply = raw; }
    reply = String(reply).trim();

    // Echo-Schutz
    const u = message.trim();
    if (reply.toLowerCase().startsWith(u.toLowerCase())) reply = reply.slice(u.length).trim();
    reply = reply.replace(/^assistant:\s*/i, "").trim() || "…";

    return NextResponse.json({ reply, model: HF_MODEL }, { headers: cors });
  } catch (e) {
    return NextResponse.json({ error: "Serverfehler", details: String(e?.message || e) }, { status: 500, headers: cors });
  }
}
