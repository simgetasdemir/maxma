// Her platform için: giriş adresi, kod -> oturum değişimi ve kampanya raporu.
// Tüm raporlar aynı satır biçimine çevrilir:
// { name, product, spend, imp, clicks, orders, revenue }
import { getJson, dateRange, LABEL } from "./util.js";

const META_V = () => process.env.META_API_VERSION || "v21.0";
const GADS_V = () => process.env.GOOGLE_ADS_API_VERSION || "v20";
const TT = "https://business-api.tiktok.com/open_api/v1.3";

export function authUrl(p, redirectUri, state) {
  const e = process.env;
  if (p === "google") {
    const q = new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code",
      scope: "https://www.googleapis.com/auth/adwords", access_type: "offline",
      prompt: "consent", include_granted_scopes: "true", state,
    });
    return "https://accounts.google.com/o/oauth2/v2/auth?" + q;
  }
  if (p === "meta") {
    const q = new URLSearchParams({ client_id: e.META_APP_ID, redirect_uri: redirectUri, scope: "ads_read", state, response_type: "code" });
    return `https://www.facebook.com/${META_V()}/dialog/oauth?` + q;
  }
  if (p === "tiktok") {
    const q = new URLSearchParams({ app_id: e.TIKTOK_APP_ID, redirect_uri: redirectUri, state });
    return "https://business-api.tiktok.com/portal/auth?" + q;
  }
  throw new Error("Bilinmeyen platform");
}

export async function exchange(p, query, redirectUri) {
  const e = process.env;
  if (p === "google") {
    const t = await getJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: query.code, client_id: e.GOOGLE_CLIENT_ID, client_secret: e.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri, grant_type: "authorization_code",
      }),
    });
    if (!t.refresh_token) throw new Error("Google kalıcı erişim anahtarı vermedi. Bağlantıyı kaldırıp tekrar deneyin.");
    return { refresh_token: t.refresh_token };
  }
  if (p === "meta") {
    const base = `https://graph.facebook.com/${META_V()}/oauth/access_token?`;
    const short = await getJson(base + new URLSearchParams({
      client_id: e.META_APP_ID, client_secret: e.META_APP_SECRET, redirect_uri: redirectUri, code: query.code,
    }));
    const long = await getJson(base + new URLSearchParams({
      grant_type: "fb_exchange_token", client_id: e.META_APP_ID, client_secret: e.META_APP_SECRET,
      fb_exchange_token: short.access_token,
    }));
    return { access_token: long.access_token };
  }
  if (p === "tiktok") {
    const code = query.auth_code || query.code;
    const t = await getJson(`${TT}/oauth2/access_token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: e.TIKTOK_APP_ID, secret: e.TIKTOK_APP_SECRET, auth_code: code }),
    });
    if (t.code !== 0) throw new Error(t.message || "TikTok bağlantısı başarısız");
    return { access_token: t.data.access_token, advertiser_ids: t.data.advertiser_ids || [] };
  }
  throw new Error("Bilinmeyen platform");
}

const n = v => Number(v) || 0;

async function googleReport(s, days) {
  const e = process.env;
  const tok = await getJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID, client_secret: e.GOOGLE_CLIENT_SECRET,
      refresh_token: s.refresh_token, grant_type: "refresh_token",
    }),
  });
  const headers = {
    Authorization: `Bearer ${tok.access_token}`,
    "developer-token": e.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (e.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers["login-customer-id"] = e.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "");
  const base = `https://googleads.googleapis.com/${GADS_V()}`;
  const list = await getJson(`${base}/customers:listAccessibleCustomers`, { headers });
  const ids = (list.resourceNames || []).map(r => r.split("/")[1]);
  const { start, end } = dateRange(days);
  const M = `metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value`;
  const W = `segments.date BETWEEN '${start}' AND '${end}' AND metrics.impressions > 0`;
  const geoQuery = `SELECT customer.descriptive_name, campaign.name, geographic_view.country_criterion_id, ${M}
    FROM geographic_view WHERE ${W} AND geographic_view.location_type = 'LOCATION_OF_PRESENCE'`;
  const plainQuery = `SELECT customer.descriptive_name, campaign.name, ${M} FROM campaign WHERE ${W}`;
  const search = (id, query) => getJson(`${base}/customers/${id}/googleAds:searchStream`, {
    method: "POST", headers, body: JSON.stringify({ query }),
  }).then(c => [].concat(c).flatMap(ch => ch.results || []));
  const raw = [];
  for (const id of ids.slice(0, 20)) {
    let res;
    try { res = await search(id, geoQuery); }
    catch {
      try { res = await search(id, plainQuery); } catch { continue; } // yönetici veya erişilemeyen hesaplar atlanır
    }
    for (const r of res) raw.push({ id, r });
  }
  // Ülke kimliklerini (ör. 2792) iki harfli koda (TR) çevir
  const geoIds = [...new Set(raw.map(x => x.r.geographicView?.countryCriterionId).filter(Boolean))];
  const codeOf = {};
  if (geoIds.length && ids.length) {
    try {
      const q = `SELECT geo_target_constant.id, geo_target_constant.country_code FROM geo_target_constant
        WHERE geo_target_constant.resource_name IN (${geoIds.map(g => `'geoTargetConstants/${g}'`).join(",")})`;
      for (const r of await search(raw[0].id, q)) codeOf[r.geoTargetConstant.id] = r.geoTargetConstant.countryCode;
    } catch { /* kod bulunamazsa kimlik gösterilir */ }
  }
  const rows = [];
  {
    for (const { id, r } of raw) {
      const gid = r.geographicView?.countryCriterionId;
      rows.push({
        name: r.campaign?.name || "Kampanya",
        product: `${LABEL.google} · ${r.customer?.descriptiveName || id}`,
        country: gid ? (codeOf[gid] || String(gid)) : "",
        spend: n(r.metrics?.costMicros) / 1e6,
        imp: n(r.metrics?.impressions),
        clicks: n(r.metrics?.clicks),
        orders: Math.round(n(r.metrics?.conversions)),
        revenue: n(r.metrics?.conversionsValue),
      });
    }
  }
  return rows;
}

const PURCHASE = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"];
function pick(list) {
  if (!Array.isArray(list)) return 0;
  for (const t of PURCHASE) { const a = list.find(x => x.action_type === t); if (a) return n(a.value); }
  return 0;
}

async function metaReport(s, days) {
  const g = `https://graph.facebook.com/${META_V()}`;
  const tok = encodeURIComponent(s.access_token);
  const accts = await getJson(`${g}/me/adaccounts?fields=id,name,currency&limit=50&access_token=${tok}`);
  const { start, end } = dateRange(days);
  const range = encodeURIComponent(JSON.stringify({ since: start, until: end }));
  const rows = [];
  for (const a of accts.data || []) {
    const ins = await getJson(`${g}/${a.id}/insights?level=campaign&limit=200&time_range=${range}` +
      `&breakdowns=country&fields=campaign_name,spend,impressions,clicks,actions,action_values&access_token=${tok}`);
    for (const r of ins.data || []) {
      rows.push({
        name: r.campaign_name || "Kampanya",
        product: `${LABEL.meta} · ${a.name || a.id}`,
        country: r.country || "",
        spend: n(r.spend), imp: n(r.impressions), clicks: n(r.clicks),
        orders: Math.round(pick(r.actions)), revenue: pick(r.action_values),
      });
    }
  }
  return rows;
}

async function tiktokReport(s, days) {
  const { start, end } = dateRange(Math.min(days, 30)); // TikTok tek seferde en fazla 30 gün verir
  const rows = [];
  for (const adv of (s.advertiser_ids || []).slice(0, 20)) {
    const q = new URLSearchParams({
      advertiser_id: adv, report_type: "BASIC", data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id"]),
      metrics: JSON.stringify(["campaign_name", "spend", "impressions", "clicks", "complete_payment", "complete_payment_roas"]),
      start_date: start, end_date: end, page_size: "200",
    });
    const r = await getJson(`${TT}/report/integrated/get/?${q}`, { headers: { "Access-Token": s.access_token } });
    if (r.code !== 0) throw new Error(r.message || "TikTok raporu alınamadı");
    const names = {};
    for (const it of r.data?.list || []) names[it.dimensions?.campaign_id] = it.metrics?.campaign_name;
    // Ülke kırılımı (AUDIENCE raporu); alınamazsa ülkesiz toplamlar kullanılır
    let list = r.data?.list || [];
    try {
      const qa = new URLSearchParams(q);
      qa.set("report_type", "AUDIENCE");
      qa.set("dimensions", JSON.stringify(["campaign_id", "country_code"]));
      qa.set("metrics", JSON.stringify(["spend", "impressions", "clicks", "complete_payment", "complete_payment_roas"]));
      const a = await getJson(`${TT}/report/integrated/get/?${qa}`, { headers: { "Access-Token": s.access_token } });
      if (a.code === 0 && (a.data?.list || []).length) list = a.data.list;
    } catch { /* ülkesiz devam */ }
    for (const it of list) {
      const m = it.metrics || {};
      const spend = n(m.spend);
      const cid = it.dimensions?.campaign_id;
      rows.push({
        name: names[cid] || m.campaign_name || cid || "Kampanya",
        product: `${LABEL.tiktok} · ${adv}`,
        country: it.dimensions?.country_code || "",
        spend, imp: n(m.impressions), clicks: n(m.clicks),
        orders: Math.round(n(m.complete_payment)),
        revenue: spend * n(m.complete_payment_roas),
      });
    }
  }
  return rows;
}

export function report(p, s, days) {
  if (p === "google") return googleReport(s, days);
  if (p === "meta") return metaReport(s, days);
  if (p === "tiktok") return tiktokReport(s, days);
  throw new Error("Bilinmeyen platform");
}
