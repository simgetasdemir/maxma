# Maxma – Reklam hesabı bağlantıları kurulum rehberi

Site Vercel'de çalışır. Google Ads, Meta ve TikTok bağlantıları için her platformda bir "geliştirici uygulaması" açıp anahtarlarını Vercel'e girmeniz gerekir. Anahtar girilmeyen platform sitede "Kurulum bekleniyor" olarak görünür; diğerleri çalışmaya devam eder.

Aşağıda `SITE` yazan yerlere kendi Vercel adresinizi yazın (ör. `https://maxma.vercel.app`).

## 0. Ortak ayar (bir kez)

Vercel > maxma projesi > **Settings > Environment Variables**:

| Ad | Değer |
|---|---|
| `APP_SECRET` | Uzun, rastgele bir metin (en az 32 karakter). Kimseyle paylaşmayın. |
| `APP_URL` | `SITE` (sonunda / olmadan) |

Değişken ekledikten sonra **Deployments > en üstteki > Redeploy** yapın.

## 1. Meta (Facebook + Instagram reklamları)

1. https://developers.facebook.com adresinde geliştirici hesabı açın, **Create App** > türü **Business** seçin.
2. Uygulamaya **Facebook Login for Business** ve **Marketing API** ürünlerini ekleyin.
3. Facebook Login ayarlarında "Valid OAuth Redirect URIs" kısmına `SITE/api/callback/meta` yazın.
4. **App settings > Basic** sayfasından App ID ve App Secret'ı alın.
5. Vercel'e girin: `META_APP_ID`, `META_APP_SECRET`.

Not: Kendi reklam hesabınızla hemen deneyebilirsiniz. Müşterilerinizin hesaplarını bağlamak için `ads_read` izni için **App Review** ve **Business Verification** (şirket belgeleri) gerekir. Bu yüzden şirket kurulduktan sonra başvurun; onay genelde birkaç gün ile birkaç hafta sürer.

## 2. Google Ads

1. https://console.cloud.google.com adresinde yeni proje açın, **Google Ads API**'yi etkinleştirin.
2. **APIs & Services > OAuth consent screen**: uygulama adı "Maxma", tür "External".
3. **Credentials > Create credentials > OAuth client ID > Web application**. "Authorized redirect URIs" kısmına `SITE/api/callback/google` yazın. Client ID ve Client Secret'ı alın.
4. Bir **Google Ads yönetici (MCC) hesabı** açın: https://ads.google.com/home/tools/manager-accounts/ . İçinde **Tools > API Center** sayfasından **developer token** alın.
5. Vercel'e girin: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN` ve isteğe bağlı `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC numarası, tiresiz).

Not: Developer token ilk başta "Test" seviyesindedir ve sadece test hesaplarıyla çalışır. Gerçek hesaplar için API Center'dan **Basic Access** başvurusu yapın (birkaç gün sürer, şirket ve site bilgisi ister).

## 3. TikTok

1. https://business-api.tiktok.com/portal adresinde geliştirici olarak kaydolun.
2. **My Apps > Create App**. Redirect URL olarak `SITE/api/callback/tiktok` yazın. İzinlerden **Ad Account Management** ve **Reporting** seçin.
3. Uygulama onaylanınca (genelde 1–3 iş günü) App ID ve Secret'ı alın.
4. Vercel'e girin: `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`.

## 4. Yapay zekâ önerileri (isteğe bağlı)

https://console.anthropic.com adresinden API anahtarı alıp Vercel'e `ANTHROPIC_API_KEY` olarak girin. Kullandıkça ücretlendirilir.

## Güvenlik

- Bağlantılar yalnızca **okuma** izni ister; reklamlarda değişiklik yapılmaz.
- Erişim anahtarları şifrelenmiş olarak yalnızca kullanıcının tarayıcısında (çerez) tutulur, sunucuda saklanmaz. Bu ilk sürüm tek kullanıcı (ajans) içindir; müşterilere hesap açmak için sonraki adımda veritabanı ve giriş sistemi eklenecek.
- API sürümleri değişebilir: gerekirse `META_API_VERSION` (varsayılan v21.0) ve `GOOGLE_ADS_API_VERSION` (varsayılan v20) değişkenleriyle güncellenir.
