// app/api/chat/route.js
import { NextResponse } from "next/server";

/** CORS: erlaube deinen Frontend-Origin (oder temporär "*") */
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://hexel-tech.de",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  // Healthcheck im Browser
  return NextResponse.json({ ok: true, hint: "POST { message, history? }" }, { headers: corsHeaders });
}

/** Llama 3.1 Chat-Template (verhindert Echo-Probleme) */
function buildLlamaPrompt({ system, history = [], message }) {
  const S = "<|start_header_id|>";
  const E = "<|end_header_id|>";
  const EOT = "<|eot_id|>";
  const BOT = "<|begin_of_text|>";

  const sys = `${S}system${E}\n${(system || "Antworte kurz, präzise und auf Deutsch.").trim()}\n${EOT}`;

  const hist = (history || [])
    .slice(-6)
    .map((m) => {
      const role = m.role === "assistant" ? "assistant" : "user";
      return `${S}${role}${E}\n${(m.content || "").trim()}\n${EOT}`;
    })
    .join("");

  const userTurn = `${S}user${E}\n${(message || "").trim()}\n${EOT}`;
  const assistantCue = `${S}assistant${E}\n`; // kein EOT -> Modell soll antworten

  return `${BOT}${sys}${hist}${userTurn}${assistantCue}`;
}

export async function POST(req) {
  try {
    const { message, history = [], system } = await req.json().catch(() => ({}));
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message fehlt oder ist ungültig" }, { status: 400, headers: corsHeaders });
    }

    const HF_API_KEY = process.env.HF_API_KEY;
    const HF_MODEL   = process.env.HF_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct";
    if (!HF_API_KEY) {
      return NextResponse.json({ error: "HF_API_KEY fehlt (in Vercel setzen)" }, { status: 500, headers: corsHeaders });
    }

    const prompt = buildLlamaPrompt({ system, history, message });
    const endpoint = `https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`;

    const r = await fetch(endpoint, {
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
          stop: ["<|eot_id|>"],
          repetition_penalty: 1.07,
        },
        options: { wait_for_model: true }, // kaltstart abfedern
      }),
    });

    const raw = await r.text(); // nie blind .json() (HF kann plaintext-Fehler senden)
    if (!r.ok) {
      let parsed; try { parsed = JSON.parse(raw); } catch {}
      const msg = parsed?.error || raw || "HF-Fehler ohne Nachricht";
      return NextResponse.json(
        { error: msg, status: r.status, model: HF_MODEL, endpoint },
        { status: 502, headers: corsHeaders }
      );
    }

    // Erfolgsfall extrahieren (array oder objekt)
    let reply = "";
    try {
      const data = JSON.parse(raw);
      reply = Array.isArray(data) ? (data[0]?.generated_text || "") : (data?.generated_text || "");
    } catch { reply = raw; }
    reply = String(reply).trim();

    // Echo-Schutz (falls Modell User-Text spiegelt)
    const u = message.trim();
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
