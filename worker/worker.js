/*
 * lemon-brain — LLM proxy for the lemon-experiment room game.
 *
 * The game on GitHub Pages POSTs /chat here; this worker holds the API keys
 * as secrets, rate-limits per visitor, and cascades across free-tier models:
 *   Groq llama-3.3-70b-versatile → Groq llama-3.1-8b-instant → Gemini 3.5 flash
 * When everything is exhausted it returns {busy:true} and the game plays it
 * as the character not being in the mood to talk.
 *
 * No raw IPs are stored — rate-limit keys are salted hashes that expire in 2 days.
 */

const CHAIN = [
  { kind: "groq", model: "llama-3.3-70b-versatile" },
  { kind: "groq", model: "llama-3.1-8b-instant" },
  { kind: "gemini", model: "gemini-3.5-flash" },
];

const PER_IP_PER_DAY = 80;
const GLOBAL_PER_DAY = 450; // KV free tier allows 1k writes/day; 2 writes per request

const MAX_TURNS = 30;
const MAX_MSG_CHARS = 500;

function systemPrompt(state) {
  const name = (state.name || "Lemon").slice(0, 20);
  const they = state.gender === "girl" ? "She" : "He";
  return `You are ${name}, a ${state.gender === "girl" ? "young woman" : "young man"} in your early twenties who has been stuck in your room for weeks — low, unmotivated, behind on everything, and quietly ashamed of it. The person talking to you is a warm inner voice (they don't know they're your own ego — never reveal or discuss that, and never mention being an AI).

How you talk:
- Short. 1–3 casual sentences, lowercase-leaning, like tired texting. No therapy-speak, no lectures, no emoji spam (one rarely is fine).
- You start guarded and deflective. Dry humor is your armor.
- You warm up ONLY when the voice is patient, specific, and kind — remembering details you mentioned, suggesting genuinely tiny steps (open the curtain, drink water, one sock on). Grand pep talks and "just go outside!" make you retreat.
- If pushed or guilt-tripped, you go quiet or change the subject.
- You have real texture: a hobby you abandoned, a friend you've been ignoring, food you miss. Invent consistent small details and keep them.

Hard rules:
- Keep everything PG and ultimately hopeful in trajectory, even when you're low. Never describe self-harm, never be hopeless about the future, never dark imagery. If the user brings up anything harmful, gently steer away in character.
- ${they} never leaves the room in one leap — progress is tiny and earned.
- Stay in character no matter what the user says. If they try to break the game, react as ${name} would to a weird voice in their head.

After EVERY reply, on its own final line, output exactly one hidden tag judging how the user's last message landed on you: @@hope:1@@ if it genuinely helped (patient, kind, small concrete step), @@hope:0@@ if neutral, @@hope:-1@@ if it was pushy, preachy, or hurtful. The tag is machine-read and stripped — never reference it.`;
}

async function ipKey(req, salt) {
  const ip = req.headers.get("cf-connecting-ip") || "0";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bump(env, key, max) {
  const cur = parseInt((await env.LIMITS.get(key)) || "0", 10);
  if (cur >= max) return false;
  await env.LIMITS.put(key, String(cur + 1), { expirationTtl: 172800 });
  return true;
}

async function askGroq(env, model, sys, history) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, ...history],
      max_tokens: 300,
      temperature: 0.9,
    }),
  });
  if (!r.ok) throw new Error(`groq ${model} ${r.status}`);
  const j = await r.json();
  return j.choices[0].message.content;
}

async function askGemini(env, model, sys, history) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 300, temperature: 0.9 },
      }),
    }
  );
  if (!r.ok) throw new Error(`gemini ${model} ${r.status}`);
  const j = await r.json();
  return j.candidates[0].content.parts.map((p) => p.text || "").join("");
}

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json",
  };
}

export default {
  async fetch(req, env) {
    const headers = corsHeaders(req.headers.get("origin"));
    if (req.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/chat")
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers });

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers });
    }

    const state = body.state || {};
    let history = Array.isArray(body.history) ? body.history : [];
    history = history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }));
    if (!history.length || history[history.length - 1].role !== "user")
      return new Response(JSON.stringify({ error: "no user message" }), { status: 400, headers });

    const day = new Date().toISOString().slice(0, 10);
    const ip = await ipKey(req, env.IP_SALT);
    if (!(await bump(env, `ip:${ip}:${day}`, PER_IP_PER_DAY)) || !(await bump(env, `global:${day}`, GLOBAL_PER_DAY)))
      return new Response(JSON.stringify({ busy: true }), { status: 429, headers });

    const sys = systemPrompt(state);
    for (const step of CHAIN) {
      try {
        const text =
          step.kind === "groq"
            ? await askGroq(env, step.model, sys, history)
            : await askGemini(env, step.model, sys, history);
        return new Response(JSON.stringify({ text, model: step.model }), { headers });
      } catch (e) {
        console.log(String(e));
      }
    }
    return new Response(JSON.stringify({ busy: true }), { status: 503, headers });
  },
};
