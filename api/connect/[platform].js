import crypto from "node:crypto";
import { PLATFORMS, configured, redirectUri, setCookie, json } from "../../lib/util.js";
import { authUrl } from "../../lib/platforms.js";

export default function handler(req, res) {
  const p = req.query.platform;
  if (!PLATFORMS.includes(p)) return json(res, 404, { error: "Bilinmeyen platform" });
  if (!configured(p)) return json(res, 400, { error: "Bu platformun anahtarları henüz Vercel'e girilmedi." });
  const state = crypto.randomBytes(16).toString("hex");
  setCookie(res, "mx_state", `${p}.${state}`, 600);
  res.statusCode = 302;
  res.setHeader("Location", authUrl(p, redirectUri(req, p), state));
  res.end();
}
