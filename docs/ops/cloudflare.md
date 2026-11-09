# Cloudflare runbook for naarad.io

Put Cloudflare in front of the GitHub Pages site. You do this by hand in the dashboard. Nothing here is automated and no secrets belong in this file.

Dashboard names change. Where a label is a guess it says "(label may differ)".

Values used below:

- Domain: `naarad.io` (the repo's `CNAME` file).
- GitHub Pages origin: `Naarad-Labs.github.io`.

## 1. Add the site

1. Sign in to the Cloudflare dashboard. Go to Websites, then Add a site.
2. Enter `naarad.io`. Pick the Free plan.
3. Cloudflare scans existing DNS records. Delete anything you do not recognise after step 3 below, then continue.
4. Cloudflare shows two nameservers (for example `xxx.ns.cloudflare.com`). Copy them. Do not paste them into this file.

## 2. DNS records

Go to DNS, then Records. Make these records exactly. Set every one to DNS only (grey cloud) first. Turn the proxy (orange cloud) on in step 5.

| Type | Name | Content |
|---|---|---|
| A | `@` | 185.199.108.153 |
| A | `@` | 185.199.109.153 |
| A | `@` | 185.199.110.153 |
| A | `@` | 185.199.111.153 |
| CNAME | `www` | `Naarad-Labs.github.io` |

Optional IPv6, if you want it: AAAA `@` to 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153. Verify these against GitHub's current "Managing a custom domain" page before adding.

Delete any record that conflicts, such as an old A record for the apex or a Netlify or Vercel record.

## 3. Change the nameservers

1. At your domain registrar, replace the current nameservers with the two Cloudflare gave you.
2. Back in Cloudflare, on the site Overview page, press Check nameservers (label may differ). Activation can take minutes to a day.
3. Before the switch, write down the old nameservers. You need them for rollback.

## 4. GitHub Pages

In the GitHub repo, Settings, Pages: custom domain stays `naarad.io`, and Enforce HTTPS stays on. If GitHub cannot issue its certificate while the proxy is on, leave records grey-cloud until the certificate is issued, then proxy.

## 5. SSL/TLS

1. Go to SSL/TLS, then Overview. Set the encryption mode to Full (strict).
2. Go to SSL/TLS, then Edge Certificates (label may differ). Turn Always Use HTTPS on.
3. Now go back to DNS, then Records, and turn the proxy (orange cloud) on for the apex and `www` records.

Do not use Flexible. GitHub Pages redirects HTTP to HTTPS, so Flexible causes a redirect loop.

## 6. Speed settings

Go to Speed, then Optimization (label may differ; Content Optimization section).

- Brotli: on.
- Rocket Loader: off. It rewrites script loading and breaks the service worker and module scripts.
- Auto Minify / HTML minification: off if the setting is present. Cloudflare has retired Auto Minify on newer accounts, so it may not be there. Minified HTML breaks the prerendered markup the build emits.
- Early Hints, Mirage, Polish: leave off. They are not needed.

## 7. Cache rules

Go to Caching, then Cache Rules (label may differ), and create these rules in this order. Rules is the parent area if Cache Rules is not under Caching.

### Rule A: static assets, cache everything

- Name: `naarad static`
- When: URI Path starts with `/app/` or URI Path starts with `/Images/`
- Then: Cache eligibility = Eligible for cache. Edge TTL = use cache-control header if present, otherwise 1 day. Browser TTL = respect origin.

Because these paths are cached at the edge, purge the cache after a deploy that changes them: Caching, then Configuration, then Purge Everything (label may differ).

### Rule B: content and HTML, respect the origin, revalidate

- Name: `naarad html and content`
- When: URI Path starts with `/content/` or the request is for HTML (everything else, including `/`, `/about/`, `/explore/` and other prerendered pages).
- Then: Edge TTL = Use cache-control header if present, bypass cache if not present. Browser TTL = Respect origin.

GitHub Pages sends `Cache-Control: max-age=600`. That is the origin header and this rule respects it. Do not set an override TTL on HTML, and do not use "Cache everything" with a long Edge TTL on HTML or `/content/*`.

### Media and range requests

Do not add any rule that strips or rewrites the `Range` header. Cloudflare passes range requests through to the origin for uncached files, which is what `<video>` needs. Leave the Cache Rules for video files (`.mp4`, `.webm`) off, so partial content (206) is never served from a rule that caches whole files.

## 8. How this fits with the service worker

`sw.js` revalidates pages and `/content/` with `cache: 'no-cache'`. That sends a conditional request every time. It sees a new deploy only if the edge also revalidates. So:

- Never let the edge keep HTML or `/content/*` past the origin's `max-age` (Rule B). Otherwise a deploy is invisible for as long as the edge holds the old copy, and the worker re-fetches that stale copy.
- Video and range requests bypass the worker (`sw.js` returns early for `destination === 'video'` and for any `Range` header). They go straight to Cloudflare and then GitHub, so the range rule above is what keeps playback working.
- `/app/*` and `/Images/*` are safe to cache at the edge, but purge after a deploy (Rule A).

## 9. Verify

After activation and the proxy is on:

1. `curl -sI https://naarad.io/` shows `server: cloudflare` and a `cf-cache-status` header.
2. `curl -sI https://naarad.io/app/main.js` shows `cf-cache-status: HIT` on the second request.
3. `curl -sI https://naarad.io/` is `DYNAMIC`, `MISS` or `REVALIDATED`, never a long-lived `HIT` that outlasts a deploy.
4. `curl -sI -H 'Range: bytes=0-99' <a video URL>` returns `206`.
5. Deploy a visible change and check it appears within the origin's `max-age` (about 10 minutes), without a manual purge, on a page not under `/app/` or `/Images/`.
6. Open the site, DevTools, Application, Service Workers: the worker still registers and Rocket Loader is not injected (no `rocket-loader.min.js` in the page source).

## 10. Rollback

1. At the registrar, set the nameservers back to the old ones you wrote down in section 3.
2. If the site misbehaves before that, DNS, then Records, and click the orange clouds to grey (DNS only). Traffic then goes straight to GitHub Pages.
3. Do not delete the Cloudflare site until the old nameservers are live, so DNS keeps answering during the switch.
