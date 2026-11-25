import crypto from "node:crypto";

export const PLATFORMS = ["google", "meta", "tiktok"];
export const LABEL = { google: "Google Ads", meta: "Meta", tiktok: "TikTok" };

function key() {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET ayarlı değil");
  return crypto.createHash("sha256").update(s).digest();
}

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}

export function unseal(s) {
  try {
    const b = Buffer.from(s, "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
  } catch {
    return null;
  }
}

export function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(res, name, value, maxAge) {
  const c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? [].concat(prev, c) : c);
}

export function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

export const redirectUri = (req, p) => `${baseUrl(req)}/api/callback/${p}`;

export function configured(p) {
  const e = process.env;
  if (!e.APP_SECRET) return false;
  if (p === "google") return !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.GOOGLE_ADS_DEVELOPER_TOKEN);
  if (p === "meta") return !!(e.META_APP_ID && e.META_APP_SECRET);
  if (p === "tiktok") return !!(e.TIKTOK_APP_ID && e.TIKTOK_APP_SECRET);
  return false;
}

export function session(req, p) {
  const v = cookies(req)["mx_" + p];
  return v ? unseal(v) : null;
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function getJson(url, opts = {}) {
  const r = await fetch(url, opts);
  const t = await r.text();
  let data;
  try { data = JSON.parse(t); } catch { data = { raw: t.slice(0, 300) }; }
  if (!r.ok) {
    const msg = data?.error?.message || data?.error_description || data?.message || data?.raw || r.statusText;
    throw new Error(`${r.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

export function splitRange(start, end, maxDays) {
  const out = [];
  let a = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (a <= e) {
    const b = new Date(a); b.setUTCDate(b.getUTCDate() + maxDays - 1);
    const stop = b < e ? b : e;
    out.push({ start: a.toISOString().slice(0, 10), end: stop.toISOString().slice(0, 10) });
    a = new Date(stop); a.setUTCDate(a.getUTCDate() + 1);
  }
  return out;
}

export function dateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const f = d => d.toISOString().slice(0, 10);
  return { start: f(start), end: f(end) };
}
