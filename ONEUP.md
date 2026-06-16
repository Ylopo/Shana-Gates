# ONEUP.md — Content Engine Setup Guide

Step-by-step guide to replicate the Shana Gates content engine for a new client. This is the system that:

1. Publishes a video + blog post to **YouTube, TikTok, Facebook, and the website** in one click from `/admin/va-queue/`
2. Pulls **GA4 site analytics** and **OneUp social analytics** into a live dashboard at `/admin/blog-dashboard/`
3. Lets the operator drill into per-post performance across every channel

Order matters. Set up the external accounts first (OneUp, Google Cloud, Vercel env vars), then deploy the code. Most "stuck" issues during new-client setup are env-var or OAuth-scope problems — none of them require code changes if the steps below are followed in order.

---

## TL;DR — what you'll do

| Step | Time | Where |
|---|---|---|
| 1. Create OneUp category + connect socials | 10 min | https://app.oneupapp.io |
| 2. Capture OneUp IDs (api key, category id, social ids) | 5 min | curl + paste |
| 3. Create Google Cloud service account + grant GA4 access | 10 min | console.cloud.google.com + GA4 Admin |
| 4. Add 8 env vars to Vercel | 5 min | Vercel project settings |
| 5. Verify analytics endpoints return real data | 5 min | curl |
| 6. (Optional) Register OneUp MCP for Claude Code | 5 min | `.mcp.json` |
| **Total** | **~40 min** | |

---

## What needs to exist before you start

| Thing | Owned by | Notes |
|---|---|---|
| The agency OneUp account | Agency (kiwi@ylopo.com) | Intermediate+ plan, has analytics API access |
| The client's YouTube channel | Client | You need their Google login OR they sit next to you for OAuth |
| The client's TikTok | Client | Same — OAuth is per-account |
| The client's Facebook business page | Client | Needs to be a Page (account_type=1), not a personal profile |
| The client's Google Analytics 4 property | Client | They give you Editor access on the property, OR they create the service account on their side |
| The Vercel project for the client's site | Agency or client | A deployed Next.js / static site cloned from the Shana template |

If the client owns their own ad/analytics surfaces and won't share OAuth, **either they do steps 1-3 with you on screen-share**, or they create the service account on their Google Cloud and just send you the JSON file.

---

## 1. OneUp setup

### 1.1 Create the client's category

1. Log into https://app.oneupapp.io with the agency master account (`kiwi@ylopo.com`)
2. Categories → **+ New Category**
3. Name it the client's brand (e.g. `Acme Realty`)
4. Save

### 1.2 Connect the client's social accounts to that category

On the OneUp dashboard, click the new category → **Connect Account**. For each platform, click and complete the OAuth flow:

| Platform | What to check during OAuth |
|---|---|
| **YouTube** | ⚠️ **Critical:** when Google's OAuth screen appears, make sure BOTH boxes are ticked — "Manage your YouTube account" AND "View YouTube Analytics reports". The analytics scope is the one that's commonly missed; without it, the dashboard YouTube card stays at 0 forever. |
| **TikTok** | Use the creator's TikTok login. Skip "Light account" if asked — full account needed for analytics. |
| **Facebook** | Connect the **Page**, not the personal profile. Page has `account_type: 1` (returns analytics); profile returns nothing. |
| **Instagram** | Connect via Facebook Business — IG creator/business account linked to the FB page. Must be a business account, not personal. |
| **Google Business Profile** | Optional — Shana's site doesn't use it. Don't connect unless the client wants GBP posts. |

After connecting, sanity-check the connections still show `is_expired: 0` and `need_refresh: false` (see 1.3 below).

### 1.3 Capture the API key + IDs

The agency's existing API key works for any category under the agency account. Find it at https://app.oneupapp.io/api-keys (or wherever OneUp's settings expose it).

Now find the new category's `category_id` and each connected account's `social_network_id`:

```bash
# Set this to the agency-level API key
export ONEUP_API_KEY="fa0ab47bd8f8c2f5e55c"   # the value already in Vercel for Shana

# List categories — find the new client's category_id
curl -s "https://www.oneupapp.io/api/listcategory?apiKey=$ONEUP_API_KEY" \
  | python3 -m json.tool

# Sample output:
# {"data": [
#   {"id": 179200, "category_name": "Shana Gates", "isPaused": 0, ...},
#   {"id": 179217, "category_name": "Scofield Group", "isPaused": 0, ...},
#   ...
# ]}
#
# Note the id of the new category — that's ONEUP_CATEGORY_ID.

# List that category's connected accounts — find each social_network_id
export NEW_CATEGORY_ID="179999"  # paste from previous step
curl -s "https://www.oneupapp.io/api/listcategoryaccount?apiKey=$ONEUP_API_KEY&category_id=$NEW_CATEGORY_ID" \
  | python3 -m json.tool

# Sample output:
# {"data": [
#   {"category_id": 179999, "social_network_name": "@theirhandle",
#    "social_network_id": "UCxxxxxxxxxxxxxxxxxxxxx", "social_network_type": "YouTube"},
#   {"category_id": 179999, "social_network_name": "theirhandle",
#    "social_network_id": "_000xxxxxxxxxxxxxxxxxxx", "social_network_type": "TikTok"},
#   {"category_id": 179999, "social_network_name": "Their Brand (City)",
#    "social_network_id": "999999999999999",        "social_network_type": "Facebook"},
# ]}
#
# Save:
#   YouTube social_network_id  →  ONEUP_YOUTUBE_CHANNEL_ID
#   TikTok  social_network_id  →  ONEUP_TIKTOK_ACCOUNT_ID
#   Facebook social_network_id →  ONEUP_FACEBOOK_ACCOUNT_ID
```

### 1.4 Verify analytics is enabled for this account

Until OneUp's support enables analytics for a new agency account, the analytics endpoints return `{"success":false,"message":"Account not found or does not belong to the authenticated user."}` HTTP 404 — even though publishing works fine. We hit this on Shana's setup and Davis at OneUp had to flip a switch.

Probe each platform:

```bash
# YouTube
curl -s "https://analyze.oneupapp.io/api/youtube/overview?apiKey=$ONEUP_API_KEY&social_network_id=<YT_ID>&preset=last_30_days" \
  | python3 -m json.tool | head -20

# TikTok
curl -s "https://analyze.oneupapp.io/api/tiktok/overview?apiKey=$ONEUP_API_KEY&social_network_id=<TT_ID>&preset=last_30_days" \
  | python3 -m json.tool | head -20

# Facebook
curl -s "https://analyze.oneupapp.io/api/facebook/overview?apiKey=$ONEUP_API_KEY&social_network_id=<FB_ID>&preset=last_30_days&timezone=America%2FLos_Angeles" \
  | python3 -m json.tool | head -20
```

Expected: `{"success": true, "data": { "metrics": [...] }}` for all three. Real numbers appear after first publish + analytics propagation (YouTube takes 24-48h, TikTok ~1h, Facebook ~30min).

If you get `Account not found or does not belong to the authenticated user.` — **email Davis at OneUp** (`davis@oneupapp.io`) with this template:

> Hey Davis — I'm setting up analytics for another client, `<Brand Name>`, category id `<CATEGORY_ID>` under our agency account `kiwi@ylopo.com`. Posts publish fine via `/api/schedulevideopost` but `https://analyze.oneupapp.io/api/{youtube,tiktok,facebook}/overview` returns "Account not found" for the social_network_ids returned by `listcategoryaccount`. Can you enable analytics on this category the same way you did for Shana Gates (179200)?

He turned it on within a few hours for Shana.

### 1.5 Special case — YouTube analytics returns zeros even after Davis enables analytics

If publishing works and analytics returns HTTP 200 but `views: 0` for every preset (`last_7_days`, `last_30_days`, `last_90_days`), the YouTube channel was connected without the analytics OAuth scope. Fix on the client side:

1. OneUp UI → Settings → Social Accounts
2. Find the client's YouTube account → **Disconnect**
3. Click **Reconnect** → on Google's OAuth screen, **tick both checkboxes** (post + analytics)
4. Wait ~30 min for first metrics to populate

---

## 2. Google Analytics 4 setup

The dashboard needs the GA4 Data API. That requires a Google Cloud service account JSON + the property ID. ~10 minutes once you have credentials.

### 2.1 Create the Google Cloud project + service account

1. Go to https://console.cloud.google.com/
2. Sign in with the Google account that has access to the client's GA4 property (or use the agency's own GCP project if the client gives the service account email access in step 2.3)
3. Top-left project picker → **New Project** (skip if reusing an existing project)
   - Name: `<client>-analytics`
   - Org: client's org or agency org
4. Enable the **Google Analytics Data API**:
   - Library → search "Google Analytics Data API" → **Enable**
5. Create the service account:
   - IAM & Admin → Service Accounts → **Create Service Account**
   - Name: `<client>-dashboard-reader`
   - Role: skip (no project-level role needed)
   - Click Done
6. Create the JSON key:
   - Click the service account → **Keys** tab → **Add Key** → **Create new key** → JSON
   - A file like `<client>-analytics-abc123.json` downloads automatically
   - **Treat this file like a password** — it grants read access to the GA4 property

### 2.2 Get the GA4 property ID

1. https://analytics.google.com/ → switch to the client's property
2. Admin (bottom-left gear) → Property Settings
3. The top-right shows a 9-digit number, e.g. `354826719`
4. This is `GOOGLE_ANALYTICS_PROPERTY_ID` — **NOT** the same as the `G-XXXXXXX` tracking-tag measurement ID (that's `GA_MEASUREMENT_ID`)

### 2.3 Grant the service account access to the GA4 property

1. Still in GA4 Admin → **Property Access Management**
2. Click **+** (top-right) → **Add users**
3. Email: paste the service account email (in the JSON file, the `client_email` field — looks like `<client>-dashboard-reader@<project>.iam.gserviceaccount.com`)
4. Role: **Viewer** (don't need anything higher)
5. Untick "Notify by email" (the service account doesn't have an inbox)
6. Add

### 2.4 Get the GA4 measurement ID (for the gtag tracking pixel)

1. GA4 Admin → Data Streams → click the web stream
2. Top of the panel: `G-XXXXXXXXXX` — that's `GA_MEASUREMENT_ID`
3. This is what goes in every page's `<script src="https://www.googletagmanager.com/gtag/js?id=G-...">` tag

---

## 3. Vercel environment variables

Open the Vercel project → Settings → Environment Variables. Add all of these. Set **Production + Preview + Development** for each.

### 3.1 Required env vars

| Variable | Value | Source |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-…` | https://console.anthropic.com/ |
| `OPENAI_API_KEY` | `sk-proj-…` | https://platform.openai.com/api-keys (DALL-E 3 fallback for blog images) |
| `GOOGLE_API_KEY` | `AIza…` | https://console.cloud.google.com/apis/credentials — Gemini image generation |
| `TAVILY_API_KEY` | `tvly-…` | https://tavily.com (daily news research) |
| `UPSTASH_REDIS_REST_URL` | `https://…upstash.io` | https://console.upstash.com — create a Redis database for the client |
| `UPSTASH_REDIS_REST_TOKEN` | long base64 | Same Upstash page |
| `RESEND_API_KEY` | `re_…` | https://resend.com (digest emails) |
| `FROM_EMAIL` | `onboarding@resend.dev` | Or a verified sender on the client's domain |
| `OPERATOR_EMAIL` | `kiwi@ylopo.com` | Where the daily news digest goes |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_…` | Vercel project → Storage → Blob → create store |
| `CRON_SECRET` | 64-char random hex | Generate: `openssl rand -hex 32`. Used to authenticate Vercel cron jobs. |
| `ADMIN_SECRET` | 64-char random hex | Generate: `openssl rand -hex 32`. Used for `?secret=` deep links + HMAC session cookies. |
| `ASSISTANT_PASSWORD` | passphrase | The client's login password for `/admin/assistant/login.html` |

### 3.2 OneUp env vars

| Variable | Value | From step |
|---|---|---|
| `ONEUP_API_KEY` | agency API key | 1.3 |
| `ONEUP_CATEGORY_ID` | numeric category id | 1.3 (listcategory) |
| `ONEUP_YOUTUBE_CHANNEL_ID` | `UC…` | 1.3 (listcategoryaccount) |
| `ONEUP_TIKTOK_ACCOUNT_ID` | `_000…` | 1.3 (listcategoryaccount) |
| `ONEUP_FACEBOOK_ACCOUNT_ID` | numeric | 1.3 (listcategoryaccount) |

### 3.3 GA4 env vars

| Variable | Value | From step |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | full JSON contents | 2.1 (paste the entire file contents as the value) |
| `GOOGLE_ANALYTICS_PROPERTY_ID` | 9-digit number | 2.2 |
| `GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | 2.4 |

### 3.4 HeyGen + video env vars (optional — only if using AI video)

| Variable | Value | Source |
|---|---|---|
| `HEYGEN_API_KEY` | `sk_V2_…` | https://app.heygen.com — Agent API key |
| `HEYGEN_AVATAR_LOOK_ID` | hex string | client's preferred avatar look ID |
| `HEYGEN_VOICE_ID` | hex string | client's preferred voice ID |

Skip these to disable the AI-generated video pipeline; operators can still upload pre-recorded videos manually.

### 3.5 Brand / domain config

The Shana repo hardcodes a few client-specific values that need to be customized for the new client. See section 5 below.

---

## 4. (Optional) Set up the OneUp MCP for Claude Code

The OneUp MCP lets Claude Code (or Claude desktop) call OneUp's API directly through a tool interface — useful for ad-hoc operations like "publish this image to TikTok and Facebook" from a conversation rather than through code.

We didn't use it in production for Shana — the publishing path runs server-side via `lib/oneup-client.ts` calling the REST API directly. But for one-off operator commands it's handy.

### 4.1 Add OneUp MCP to your Claude Code settings

Edit `~/.claude/mcp.json` (or use the Claude Code UI):

```json
{
  "mcpServers": {
    "oneup": {
      "command": "npx",
      "args": ["-y", "@oneupapp/mcp-server"],
      "env": {
        "ONEUP_API_KEY": "fa0ab47bd8f8c2f5e55c"
      }
    }
  }
}
```

(Check https://docs.oneupapp.io/ for the current MCP package name; this is based on the pattern they use. If they don't publish an MCP, this section doesn't apply — use the REST API directly.)

Restart Claude Code. The MCP tools should appear (e.g. `mcp__oneup__schedulevideopost`, `mcp__oneup__listcategoryaccount`).

### 4.2 What the MCP is good for

- Quickly reposting an existing video to a different category
- Bulk-scheduling content for a campaign
- Reading the published posts feed to spot anomalies

**Not recommended for the production publish path** — that needs the structured server-side flow with retry handling, RSS waiting, Redis state, etc. that lives in `api/content/publish-video.ts`.

---

## 5. Per-client code customization

Most of the system is data-driven (env vars), but a few files have hard-coded brand/domain assumptions that need editing per client. Track these in a per-client commit.

### 5.1 Files to customize

| File | What to change |
|---|---|
| `CLAUDE.md` | Client name, brokerage, market, YLOPO domain, contact email |
| `index.html` and all community/blog pages | gtag measurement ID (`G-XXXXXXXXXX`) — replace site-wide |
| `lib/publish-service.ts` | `SITE_URL` constant → client's production domain |
| `lib/oneup-client.ts` | Default timezone in `formatOneUpDateTime` — change `America/Los_Angeles` if client is in a different time zone |
| `lib/oneup-analytics.ts` | Default fallback IDs in `getNetworkId()` — keep generic since env vars override |
| `admin/admin-nav.js` | `.sg-brand` text (currently "Shana Gates") |
| `admin/blog-dashboard/index.html` | Color tokens (bronze / teal / gold), brand voice in masthead, font pairing |
| `lib/blog-email.ts`, `lib/writer.ts` | Brand voice prompt (currently first-person Shana / Coachella Valley) |
| `community-map.js` + community pages | Map boundaries, POIs, market regions |

### 5.2 Files that are entirely portable (no edit needed)

These are pure infrastructure — copy verbatim:

- `lib/admin-auth.ts` (unified auth helper)
- `lib/oneup-client.ts` (timezone-aware publish, title clamp)
- `lib/oneup-analytics.ts` (analytics normalization)
- `lib/ga4-client.ts` (service-account JWT + Data API)
- `lib/youtube-rss.ts` (RSS poll for new video discovery)
- `lib/blog-redis.ts` (state machine + index management)
- `lib/blog-store.ts` (Upstash client)
- `lib/heygen-client.ts` (HeyGen video generation, if used)
- `api/content/publish-video.ts` (orchestrator — calls oneup-client, returns since cutoff)
- `api/content/youtube-wait.ts` (RSS-found endpoint)
- `api/blog/queue-publish.ts`, `queue-mark-ready.ts`, `queue-schedule.ts`, `queue-delete.ts`
- `api/blog/dashboard.ts` (already env-driven for GA4 + OneUp)
- `api/cron/research.ts`, `weekly.ts`, `publish-scheduled.ts`
- `admin/va-queue/editor.html` (15-min RSS poll, per-platform captions)
- `admin/idea-review/index.html`

### 5.3 Critical numeric values (already-correct defaults, do not change)

| Value | Where | Why |
|---|---|---|
| YouTube title clamp = 100 chars | `lib/oneup-client.ts` → `clampYoutubeTitle` | YouTube API hard limit |
| RSS poll window = 90 × 10s = 15 min | `admin/va-queue/editor.html` | RSS lag typically 1-10 min, sometimes longer |
| OneUp `scheduled_date_time` offset = 0 (current) | `lib/oneup-client.ts` → `scheduleVideoNow` | Past timestamps are SKIPPED by OneUp's worker; current = "publish now" |
| OneUp timezone = `America/Los_Angeles` | `lib/oneup-client.ts` → `formatOneUpDateTime` | OneUp interprets the timestamp in the account's local TZ. Change to client's TZ if not PT. |

---

## 6. Verification checklist after first deploy

Run these in order. Each failure has a known cause documented below.

### 6.1 Auth works end-to-end
1. Open `https://<client-domain>/admin/idea-review/?secret=<ADMIN_SECRET>`
2. Page loads without redirecting to login → ✅
3. Click Media Queue in top nav → loads without re-asking for login → ✅
4. Click Analytics → loads without re-asking for login → ✅

If any step redirects to login: check that `ADMIN_SECRET` is set in Vercel for all environments, AND the same value is used in the URL.

### 6.2 GA4 works
1. Open `/admin/blog-dashboard/?secret=<ADMIN_SECRET>`
2. The Website card shows real "sessions · 30 days" with a "Live · GA4" chip → ✅

If it shows `—`: GA4 service account isn't authorized on the property. Re-do step 2.3.

### 6.3 OneUp analytics works
1. Same dashboard, scroll to "Across the Network"
2. TikTok and Facebook cards show real numbers with "Live · OneUp" chip → ✅
3. YouTube card may show "awaiting first metrics" for the first 24-48h after first publish — this is normal

If all three show "Connecting…": the analytics fetch is failing. Check the response of step 1.4 — most likely Davis needs to enable analytics on the new category.

If only YouTube is stuck at zero after 48h: re-do step 1.5 (YouTube OAuth analytics scope).

### 6.4 Publishing works
1. Open the latest blog post in `/admin/va-queue/editor.html`
2. Upload thumbnail + generate/upload video
3. Click **Publish**
4. Network panel — `/api/content/publish-video` returns `{ok: true, message: "1 new Posts Scheduled."}`
5. Within 30-60s: `GET https://www.oneupapp.io/api/getpublishedposts?apiKey=$ONEUP_API_KEY` shows 3 entries (TT/YT/FB) for this post
6. Editor's YouTube status flips to "Published" within 1-15 minutes (RSS lag)
7. Blog page goes live with the YouTube embed

If post sits in `getscheduledposts` and never moves: timezone bug — `scheduled_date_time` is being interpreted in a different TZ than expected. Check `formatOneUpDateTime` is using the client's local TZ.

If `getfailedposts` shows a YouTube entry with "invalid or empty video title": the title is over 100 chars. The clamp in `oneup-client.ts` should handle this, but verify the latest commit is deployed.

### 6.5 Email digests work
1. Manually trigger: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<client>/api/cron/research`
2. Email arrives at `OPERATOR_EMAIL` within ~3 minutes

If no email: `RESEND_API_KEY` is wrong, or `FROM_EMAIL` isn't a verified Resend sender. Use `onboarding@resend.dev` for testing.

---

## 7. Common issues + fixes (learned from Shana's setup)

These all happened during Shana's setup. Read them before debugging from scratch.

### 7.1 Posts queued in OneUp but never publish, no failures either

**Cause:** OneUp interprets `scheduled_date_time` in the account's local timezone (Pacific for US accounts). If the code formats in UTC or Eastern, OneUp reads the same clock-face digits as Pacific and schedules the post 3-4 hours in the future.

**Fix:** `lib/oneup-client.ts:formatOneUpDateTime` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', ... })` to format. For clients in other timezones, change the `timeZone` argument.

**Symptom signature:** `getscheduledposts` shows entries with `date_time` 3-4h in the future relative to current Pacific time. `getfailedposts` is empty. Posts eventually publish at the future time and then everything looks fine — making this look like a "slow" problem rather than a TZ bug.

### 7.2 Posts queued in OneUp, visible in UI, never publish even when past-due

**Cause #1:** Past-due timestamps are SKIPPED by OneUp's worker. The fix is to send `current` (per OneUp's "immediate publish" docs), not a past offset.

**Fix:** `formatOneUpDateTime(new Date())` — no offset.

**Cause #2:** YouTube account was connected without the analytics scope AND OneUp is also using that auth to publish. Reconnect per step 1.5.

### 7.3 "Account not found or does not belong to the authenticated user" on analytics

**Cause:** OneUp's analytics needs explicit per-category enablement, separate from publishing access. Even a paid plan doesn't auto-enable.

**Fix:** Email Davis (step 1.4 template). Wait for confirmation.

### 7.4 Editor times out waiting for YouTube ("not detected yet")

**Cause:** YouTube channel RSS sometimes lags 8-12 min after a video publishes. The editor's RSS poll defaults to 15 min (`maxAttempts = 90` × 10s).

**Fix:** Already at 15 min in current code. If still timing out, check that the video actually published on YouTube — `getfailedposts` for the relevant `post_id`. If the title is over 100 chars, YouTube rejects with "invalid or empty video title" and the clamp in `oneup-client.ts` should prevent this.

**Manual recovery for already-stuck post:** if the YouTube video IS live but blog never published, run the Redis publish script in Section 8.2.

### 7.5 Dashboard shows blog dashboard with no top nav

**Cause:** `admin-nav.js` was inserting before `<header>` (semantic tag) but the dashboard wraps its header inside `.page`. `document.body.insertBefore` throws when the reference node isn't a direct child of body.

**Fix:** Already fixed in `admin/admin-nav.js` — selector is now `body > header` so it only short-circuits when header is a direct child.

### 7.6 Analytics dashboard says "Unauthorized" when opened via deep link

**Cause:** The dashboard's HTML loads fine on `?secret=…` but the AJAX call to `/api/blog/dashboard` doesn't forward the secret.

**Fix:** Already fixed — the dashboard monkey-patches `window.fetch` at script-startup to auto-append `?secret=` to any `/api/` request. Replicate this pattern in any new admin page that fetches data.

---

## 8. Reusable scripts

### 8.1 Inspect post state in Redis

```bash
cd /path/to/repo
set -a && source .env.local && set +a && python3 <<PYEOF
import json, urllib.request, urllib.parse, os
URL = os.environ["UPSTASH_REDIS_REST_URL"]
TOKEN = os.environ["UPSTASH_REDIS_REST_TOKEN"]
def rget(k):
    req = urllib.request.Request(f"{URL}/get/{urllib.parse.quote(k, safe='')}",
        headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())["result"]

SLUG = "your-post-slug-here"
post = json.loads(rget(f"blog_post:{SLUG}"))
print(f"  workflowStatus: {post.get('workflowStatus')}")
print(f"  publishedAt:    {post.get('publishedAt')}")
print(f"  youtubeUrl:     {post.get('youtubeUrl')}")
print(f"  videoUrl:       {bool(post.get('videoUrl'))}")
print(f"  heroImageUrl:   {bool(post.get('heroImageUrl'))}")
PYEOF
```

### 8.2 Publish a stuck post manually

```bash
cd /path/to/repo
set -a && source .env.local && set +a && python3 <<PYEOF
import json, urllib.request, urllib.parse, os
URL = os.environ["UPSTASH_REDIS_REST_URL"]
TOKEN = os.environ["UPSTASH_REDIS_REST_TOKEN"]
SLUG = "your-post-slug-here"
YT_URL = "https://www.youtube.com/watch?v=XXXX"  # optional; set to None to publish without embed

def rget(k):
    req = urllib.request.Request(f"{URL}/get/{urllib.parse.quote(k, safe='')}",
        headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())["result"]

def rset(k, v):
    req = urllib.request.Request(f"{URL}/set/{urllib.parse.quote(k, safe='')}",
        data=v.encode("utf-8"),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "text/plain"},
        method="POST")
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

post = json.loads(rget(f"blog_post:{SLUG}"))
if YT_URL: post["youtubeUrl"] = YT_URL
post["workflowStatus"] = "published"
post.pop("scheduledPublishAt", None)
rset(f"blog_post:{SLUG}", json.dumps(post))

queue = json.loads(rget("blog_posts_queue") or "[]")
queue = [p for p in queue if p.get("slug") != SLUG]
rset("blog_posts_queue", json.dumps(queue))

index = json.loads(rget("blog_posts_index") or "[]")
summary = {k: v for k, v in {
    "_id": post["_id"], "title": post["title"], "slug": post["slug"],
    "publishedAt": post["publishedAt"], "category": post.get("category"),
    "excerpt": post.get("excerpt"), "heroImageUrl": post.get("heroImageUrl"),
    "pipeline": post.get("pipeline"), "city": post.get("city"),
    "workflowStatus": "published",
    "youtubeUrl": YT_URL if YT_URL else post.get("youtubeUrl"),
}.items() if v is not None}
index = [p for p in index if p.get("slug") != SLUG]
index.insert(0, summary)
index.sort(key=lambda p: p.get("publishedAt", ""), reverse=True)
rset("blog_posts_index", json.dumps(index))
print(f"✓ {SLUG} → published")
PYEOF
```

### 8.3 Find a YouTube video URL from the channel RSS

```bash
cd /path/to/repo
set -a && source .env.local && set +a && \
curl -s "https://www.youtube.com/feeds/videos.xml?channel_id=$ONEUP_YOUTUBE_CHANNEL_ID" \
  | python3 -c "
import sys, re
content = sys.stdin.read()
for entry in re.findall(r'<entry>(.*?)</entry>', content, re.S)[:10]:
    vid = (re.search(r'<yt:videoId>(.*?)</yt:videoId>', entry) or [None,'?'])[1]
    title = (re.search(r'<title>(.*?)</title>', entry) or [None,'?'])[1]
    published = (re.search(r'<published>(.*?)</published>', entry) or [None,'?'])[1]
    print(f'{published}  https://www.youtube.com/watch?v={vid}')
    print(f'  {title[:90]}')
"
```

### 8.4 Clean up orphaned scheduled posts in OneUp

If you accidentally fire multiple test publishes and want to clear them out:

```bash
set -a && source .env.local && set +a && \
curl -s "https://www.oneupapp.io/api/getscheduledposts?apiKey=$ONEUP_API_KEY" \
  | python3 -c "import sys, json; print('\n'.join(str(p['post_id']) for p in json.load(sys.stdin)['data']))" \
  | while read POST_ID; do
      curl -s -X POST "https://www.oneupapp.io/api/deletescheduledpost" \
        -d "apiKey=$ONEUP_API_KEY" -d "post_id=$POST_ID"
      echo " ← deleted $POST_ID"
    done
```

---

## 9. Architecture sequence — what happens during one publish

```
Operator clicks Publish in /admin/va-queue/editor.html
  │
  ├─→ POST /api/blog/queue-mark-ready
  │     persists VA edits to Redis (captions, scheduledPublishAt, etc.)
  │
  ├─→ POST /api/content/publish-video                       (15-30s)
  │     ├─ Reads post from Redis
  │     ├─ Builds caption = socialCopy + blog URL
  │     ├─ Clamps title to ≤100 chars for YouTube
  │     ├─ Calls scheduleVideoNow() → OneUp /api/schedulevideopost
  │     ├─ OneUp's worker publishes to TT/YT/FB (~30-60s)
  │     └─ Returns { ok, since, submitted }
  │
  ├─→ GET /api/content/youtube-wait?slug=X&since=ISO         (polled every 10s, up to 90 attempts = 15 min)
  │     ├─ Fetches client's YouTube channel RSS feed
  │     ├─ Looks for an entry published AFTER `since`
  │     ├─ On found: calls setYouTubeUrl() → persists to Redis
  │     └─ Returns { found: true, url, videoId, ... }
  │
  └─→ POST /api/blog/queue-publish                           (200ms)
        ├─ Sets post.workflowStatus = "published"
        ├─ Removes from blog_posts_queue
        └─ Adds to blog_posts_index (public listing)

Result: blog page is live with the YouTube embed already in place.
```

The strict order — social first → wait for YouTube → blog last — ensures the blog page never publishes before the YouTube embed URL is known. Without this gating, the blog would render `youtubeUrl: undefined` and the post page would have no video. This ordering was deliberate during Shana's setup and should be preserved per-client.

---

## 10. Where things live (file map)

| Path | Owner | Purpose |
|---|---|---|
| `lib/oneup-client.ts` | infra | OneUp publish (REST, timezone-aware) |
| `lib/oneup-analytics.ts` | infra | OneUp analytics normalization (YT/TT/FB) |
| `lib/ga4-client.ts` | infra | GA4 Data API client (service-account JWT) |
| `lib/youtube-rss.ts` | infra | Channel RSS parser + "find newest since" |
| `lib/blog-redis.ts` | infra | Blog post state machine + indexes |
| `lib/admin-auth.ts` | infra | Shared admin auth (URL secret + cookie) |
| `api/blog/dashboard.ts` | infra | Dashboard data endpoint (GA4 + OneUp + Redis) |
| `api/content/publish-video.ts` | infra | One-click publish orchestrator |
| `api/content/youtube-wait.ts` | infra | RSS-discovery endpoint |
| `api/cron/research.ts` | infra | Daily 6am Tavily research |
| `api/cron/publish-scheduled.ts` | infra | Every-15-min scheduled-post fire |
| `admin/admin-nav.js` | per-client | Top nav — brand text per client |
| `admin/blog-dashboard/index.html` | per-client | Fable-designed dashboard (palette per client) |
| `admin/va-queue/editor.html` | infra | One-click publisher UI |
| `admin/idea-review/index.html` | infra | Daily news idea picker |
| `CLAUDE.md` | per-client | Project-specific instructions for Claude Code |
| `.env.local` | per-client | Local env (NEVER commit — `.gitignore`d) |

---

## 11. Final smoke test

A new client setup is "done" when:

- ✅ `/admin/idea-review/?secret=<ADMIN_SECRET>` loads with no auth challenge
- ✅ Click Media Queue, Analytics — no auth challenge
- ✅ `/admin/blog-dashboard/` shows real GA4 sessions for the Website card
- ✅ TikTok and Facebook cards show "Live · OneUp" with real numbers (after first publish)
- ✅ Publishing a test post from the editor moves it to `getpublishedposts` within 60s
- ✅ The post's blog page goes live with a YouTube embed within 15 min
- ✅ Daily research cron (`/api/cron/research`) fires at 6am PT and sends digest email

If all of these pass, the engine is replicated. Ship it.
