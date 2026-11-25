import { PLATFORMS, configured, session, json } from "../lib/util.js";

export default function handler(req, res) {
  const out = {};
  for (const p of PLATFORMS) out[p] = { configured: configured(p), connected: configured(p) && !!session(req, p) };
  json(res, 200, { platforms: out, ai: !!process.env.ANTHROPIC_API_KEY });
}
