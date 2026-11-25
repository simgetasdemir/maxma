import { PLATFORMS, setCookie, json } from "../lib/util.js";

export default function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "POST gerekli" });
  const p = req.query.platform;
  if (!PLATFORMS.includes(p)) return json(res, 400, { error: "Bilinmeyen platform" });
  setCookie(res, "mx_" + p, "", 0);
  json(res, 200, { ok: true });
}
