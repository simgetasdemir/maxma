import { PLATFORMS, configured, session, json } from "../lib/util.js";
import { report } from "../lib/platforms.js";

export default async function handler(req, res) {
  const p = req.query.platform;
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  if (!PLATFORMS.includes(p) || !configured(p)) return json(res, 400, { error: "Platform hazır değil" });
  const s = session(req, p);
  if (!s) return json(res, 401, { error: "Hesap bağlı değil" });
  try {
    json(res, 200, { rows: await report(p, s, days) });
  } catch (e) {
    json(res, 502, { error: String(e.message).slice(0, 300) });
  }
}
