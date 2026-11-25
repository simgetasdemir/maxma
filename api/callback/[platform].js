import { PLATFORMS, cookies, seal, setCookie, redirectUri, baseUrl } from "../../lib/util.js";
import { exchange } from "../../lib/platforms.js";

export default async function handler(req, res) {
  const p = req.query.platform;
  const back = (msg) => {
    res.statusCode = 302;
    res.setHeader("Location", `${baseUrl(req)}/?${msg}`);
    res.end();
  };
  if (!PLATFORMS.includes(p)) return back("hata=platform");
  const st = cookies(req).mx_state || "";
  if (st !== `${p}.${req.query.state}`) return back("hata=" + encodeURIComponent("Güvenlik kontrolü tutmadı, tekrar bağlanın."));
  setCookie(res, "mx_state", "", 0);
  if (req.query.error || (!req.query.code && !req.query.auth_code)) return back("hata=" + encodeURIComponent("Bağlantı iptal edildi."));
  try {
    const s = await exchange(p, req.query, redirectUri(req, p));
    setCookie(res, "mx_" + p, seal(s), 60 * 60 * 24 * 60);
    back("baglandi=" + p);
  } catch (e) {
    back("hata=" + encodeURIComponent(String(e.message).slice(0, 200)));
  }
}
