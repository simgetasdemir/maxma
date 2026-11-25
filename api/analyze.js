// Yapay zekâ önerileri (isteğe bağlı): ANTHROPIC_API_KEY girilirse çalışır.
import { json } from "../lib/util.js";

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let s = "";
  for await (const c of req) s += c;
  return JSON.parse(s || "{}");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "POST gerekli" });
  if (!process.env.ANTHROPIC_API_KEY) return json(res, 400, { error: "Yapay zekâ anahtarı girilmedi" });
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: "Geçersiz istek" }); }
  const prompt = String(body.prompt || "").slice(0, 30000);
  if (!prompt) return json(res, 400, { error: "Boş istek" });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    if (!r.ok) return json(res, 502, { error: d?.error?.message || "Yapay zekâ yanıt vermedi" });
    json(res, 200, { text: (d.content || []).filter(c => c.type === "text").map(c => c.text).join("\n") });
  } catch (e) {
    json(res, 502, { error: String(e.message).slice(0, 200) });
  }
}
