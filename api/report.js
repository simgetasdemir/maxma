import { PLATFORMS, configured, session, json, dateRange } from "../lib/util.js";
import { report } from "../lib/platforms.js";

export default async function handler(req, res) {
  const p = req.query.platform;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  let range;
  if (iso.test(req.query.start || "") && iso.test(req.query.end || "")) {
    const span = (Date.parse(req.query.end) - Date.parse(req.query.start)) / 864e5;
    if (!(span >= 0 && span <= 366)) return json(res, 400, { error: "Tarih aralığı 1 gün ile 1 yıl arasında olmalı" });
    range = { start: req.query.start, end: req.query.end };
  } else {
    range = dateRange(Math.min(366, Math.max(1, parseInt(req.query.days, 10) || 30)));
  }
  if (!PLATFORMS.includes(p) || !configured(p)) return json(res, 400, { error: "Platform hazır değil" });
  const s = session(req, p);
  if (!s) return json(res, 401, { error: "Hesap bağlı değil" });
  try {
    json(res, 200, { rows: await report(p, s, range) });
  } catch (e) {
    json(res, 502, { error: String(e.message).slice(0, 300) });
  }
}
