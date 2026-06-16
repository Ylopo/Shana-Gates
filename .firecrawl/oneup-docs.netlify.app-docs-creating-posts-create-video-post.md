[Skip to main content](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#__docusaurus_skipToContent_fallback)

On this page

## Overview [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#overview "Direct link to Overview")

The **Create Video Post** endpoint allows you to schedule and publish video-based posts to one or multiple connected social accounts under a specific category. You can set the post content, attach a video URL, assign it to a category, and define the date and time for scheduling.

**Base URL:**

```text
https://www.oneupapp.io
```

## Endpoint [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#endpoint "Direct link to Endpoint")

```text
POST /api/schedulevideopost
```

## Request Parameters [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#request-parameters "Direct link to Request Parameters")

| Parameter | Required | Description |
| --- | --- | --- |
| `apiKey` | Yes | Your personal API key generated from the [API Access page](https://www.oneupapp.io/api-access). |
| `category_id` | Yes | The ID of the category that groups your target social accounts. You can find your category IDs using the [List Categories](https://oneup-docs.netlify.app/docs/managing-connections/list-categories) endpoint. |
| `social_network_id` | Yes | A JSON array of social network IDs where the post will be published. You can find the social network IDs for accounts in a category using the [List Category Accounts](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category) endpoint. You can also set the value to `ALL` to publish the post across all accounts enabled for the selected category. |
| `scheduled_date_time` | Yes | The date and time (in `YYYY-MM-DD HH:MM` format) when the post should be published. Alternatively, you can pass `timeslot` to use your predefined time slots (requires Intermediate, Growth, or Business plan). |
| `title` | No | The title of your post. For YouTube and Reddit, it serves as the post title. For Threads, it's used as the topic. |
| `content` | Yes | The text content of your post. |
| `video_url` | Yes | The URL to the video you want to attach to the post. You can also upload videos via the [Upload Media](https://oneup-docs.netlify.app/docs/creating-posts/upload-media) endpoint and use the returned `file_path` as the `video_url`. |
| `thumbnail_url` | No | The URL of the thumbnail image for video posts (optional and only for video posts). |
| `first_comment` | No | The first comment to be added to the post (optional and only for Facebook, Instagram, LinkedIn, and YouTube). |
| `google_post_type` | No | Google Business Profile post type. Values: `update`, `event`, `offer`, `none`. Required when posting to a GBP account. When set to `none`, the image will only be added to the Photos section of GBP. It will not publish as a GBP Post. |
| `cta_button` | No | CTA button for GBP `update` and `event` types. Values: `CALL`, `LEARN_MORE`, `BOOK`, `SIGN_UP`, `ORDER_ONLINE`, `BUY` |
| `cta_button_url` | No | URL for the CTA button. Optional when `cta_button` is `CALL`, required for all other button types. |
| `event_title` | No | Required for GBP `event` type. The title of the event. |
| `event_start_date` | No | Required for GBP `event` type. Format: `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-14 08:50 am`) |
| `event_end_date` | No | Required for GBP `event` type. Format: `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-21 08:50 am`) |
| `offer_title` | No | Required for GBP `offer` type. The title of the offer. |
| `offer_start_date` | No | Required for GBP `offer` type. Format: `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-14 08:50 am`) |
| `offer_end_date` | No | Required for GBP `offer` type. Format: `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-21 08:50 am`) |
| `coupon_code` | No | Optional for GBP `offer` type. A coupon code for the offer. |
| `link_to_redeem_url` | No | Optional for GBP `offer` type. A link to redeem the offer. |
| `subreddit` | No | The target location for your Reddit post. <br> \- **To publish to a Subreddit:** Use the subreddit name (e.g., `vishal2947world`). <br> \- **To publish to your Profile:** Prefix your username with `u_` (e.g., `u_daviswbaer`). |
| `isDraftPost` | No | Set to `true` to save the post as a draft instead of scheduling it. Default: `false` |

warning

The `timeslot` feature is not available on the **Basic** plan. Upgrade to **Intermediate**, **Growth** or **Business** plan to use timeslot scheduling.

### Google Drive Video URLs [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#google-drive-video-urls "Direct link to Google Drive Video URLs")

You can also use a Google Drive sharing link as the `video_url`. The link must be in the following format:

```text
https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
```

Public Access Required

The Google Drive file must be publicly accessible for OneUp to process it. To make your file public:

1. Open the sharing settings for your video file
2. Change access from "Restricted" to **"Anyone with the link"**
3. Copy the sharing link and use it as your `video_url`

Example:

```text
https://drive.google.com/file/d/1qIvrm1yXF7Qez0wfzObSrykMbG3t525g/view?usp=sharing
```

**Example with Google Drive video:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["17841408823790514"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "content=Video post from Google Drive" \
--data-urlencode "video_url=https://drive.google.com/file/d/1qIvrm1yXF7Qez0wfzObSrykMbG3t57P5/view?usp=sharing"
```

**Example with timeslot scheduling:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["17841408823790514"]' \
--data-urlencode "scheduled_date_time=timeslot" \
--data-urlencode "content=Video post using timeslot scheduling" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M"
```

### Platform-Specific Parameters [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#platform-specific-parameters "Direct link to Platform-Specific Parameters")

Some social networks support additional parameters for specific video post types:

**Instagram:**

- `instagram`: A JSON object with the following options:
  - `isStory` (boolean): Set to `true` to publish as an Instagram Story. Default: `false`
  - `collaborator` (string): A comma-separated string of Instagram usernames (e.g., `"nike,adidas"`). When adding collaborators, use the Instagram @username exactly as it appears without the '@' symbol. You can add up to 5 collaborators on a post. Note that the tagged account cannot be private, otherwise the post will not publish.
  - `addToFeed`:
    - `1` -\> The reel will appear on the Posts tab (Feed)
    - `0` -\> The reel will only appear in the Reels tab
  - `isTrialReel`(optional):
    - `1` -\> The trial reel can be manually graduated in the Instagram app
    - `2` -\> The trial reel will be automatically graduated if the trial reel performs well
  - `locationId` (number): The Instagram location ID for tagging a location on the post. For help finding a location ID, see [How to find your location ID](https://help.oneupapp.io/en-us/article/location-not-found-for-instagram-or-facebook-post-jbt4m5/?bust=1748873490456).
  - `musicOption`(object): Add trending music to your Instagram video. Contains:
    - `music_sound_id` (string): The unique identifier of the audio track
    - `music_title` (string): The title of the audio track
    - `music_url` (string): The direct URL to download the audio file

Add music to your Instagram video posts by providing the music details. These can be fetched from the [Get Instagram Trending Sound](https://oneup-docs.netlify.app/docs/creating-posts/get-instagram-trending-sound) endpoint.

**Facebook:**

- `facebook`: A JSON object with the following options:
  - `isStory` (boolean): Set to `true` to publish as a Facebook Story. Default: `false`
  - `isFBReel` (boolean): Set to `true` to publish as a Facebook Reel. Default: `false`
  - `locationId` (number): The Facebook location ID for tagging a location on the post. For help finding a location ID, see [How to find your location ID](https://help.oneupapp.io/en-us/article/location-not-found-for-instagram-or-facebook-post-jbt4m5/?bust=1748873490456).

**Snapchat:**

- `snapchat`: A JSON object with the following option:
  - `isSpotLight` (boolean): Set to `true` to publish as a Snapchat Spotlight. Default: `false`

**YouTube:**

- `youtube`: A JSON object with the following fields:
  - `playlist_name` (string, required): The name of the YouTube playlist.
  - `playlist_id` (string, required): The ID of the YouTube playlist.
  - You can fetch available playlists using the [Fetch YouTube Playlists](https://oneup-docs.netlify.app/docs/managing-connections/fetch-youtube-playlists) endpoint.

YouTube Shorts

Video posts to YouTube in portrait orientation that are 3 minutes or less will automatically be posted as Shorts.

**Pinterest:**

- `pinterest`: A JSON object with the following fields (required when posting to a Pinterest account):
  - `board_name` (string, required): The name of the Pinterest board.
  - `board_id` (string, required): The ID of the Pinterest board.
  - `destination_link` (string, optional): The URL of the destination link for the Pin.
  - Both `board_name` and `board_id` are mandatory fields. You can fetch available boards using the [Fetch Pinterest Boards](https://oneup-docs.netlify.app/docs/managing-connections/fetch-pinterest-boards) endpoint.

**TikTok:**

- `tiktok`: A JSON object with the following options:
  - `music_title` (string): Title of the music
  - `music_sound_id` (string): TikTok sound ID
  - `music_url` (string): URL of the music
  - `music_thumbnail` (string): Thumbnail image URL
  - `music_author` (string): Music author/artist name

Add music to your TikTok video posts by providing the music details. These can be fetched from the [Get TikTok Trending Sound](https://oneup-docs.netlify.app/docs/creating-posts/get-tiktok-trending-sound) endpoint.

**Google Business Profile:**

Google Business Profile supports three post types via the `google_post_type` parameter. These parameters are passed as individual fields (not as a JSON object).

**Update type (`google_post_type=update`):**

- `cta_button` (optional): `CALL`, `LEARN_MORE`, `BOOK`, `SIGN_UP`, `ORDER_ONLINE`, `BUY`
- `cta_button_url` (optional if `cta_button` is `CALL`, required otherwise): The URL for the CTA button

**Event type (`google_post_type=event`):**

- `event_title` (required): The title of the event
- `event_start_date` (required): Format `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-14 08:50 am`)
- `event_end_date` (required): Format `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-21 08:50 am`)
- `cta_button` (optional): `CALL`, `LEARN_MORE`, `BOOK`, `SIGN_UP`, `ORDER_ONLINE`, `BUY`
- `cta_button_url` (optional if `cta_button` is `CALL`, required otherwise): The URL for the CTA button

**Offer type (`google_post_type=offer`):**

- `offer_title` (required): The title of the offer
- `offer_start_date` (required): Format `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-14 08:50 am`)
- `offer_end_date` (required): Format `YYYY-MM-DD HH:MM am/pm` (e.g., `2026-04-21 08:50 am`)
- `coupon_code` (optional): A coupon code for the offer
- `link_to_redeem_url` (optional): A link to redeem the offer

**Example with platform-specific parameters:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["17841408823790514"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "title=My Video Post" \
--data-urlencode "content=Video post from API" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M" \
--data-urlencode 'instagram={"isStory":true, "isTrialReel":1}'
```

**Example with Instagram location:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["17841408823790514"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "content=Video post with location" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M" \
--data-urlencode 'instagram={"locationId":992739747256078}'
```

**Example with YouTube playlist:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["UC2tfTuFO9diTgaaeozmDLKg"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "title=My Video Title" \
--data-urlencode "content=Video post to YouTube playlist" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M" \
--data-urlencode 'youtube={"playlist_name":"ijhwofejifow","playlist_id":"PLsmRfwpAUptdmOY0mHWCZaS-466bvZQcZ"}'
```

**Example with Pinterest board:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["pin_oneupapp"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "content=Video post to Pinterest" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M" \
--data-urlencode 'pinterest={"board_name":"OneUp","board_id":"635641003596046298"}'
```

**Example with Instagram trending sound:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["17841459099133515"]' \
--data-urlencode "scheduled_date_time=2026-05-22 14:30" \
--data-urlencode "content=My video with trending music" \
--data-urlencode "video_url=https://example.com/video.mp4" \
--data-urlencode 'instagram={"isStory":true, "isTrialReel":1, "musicOption":{"music_sound_id":"3132622323696161", "music_title":"I Know What You Want x Madison Calley", "music_url":"https://video-sin11-2.xx.fbcdn.net/o1/v/t2/f2/m86/AQPzAvaScETGbPm9MBpvAiUpzMu8bfqAOv4xfS9k89bKue073YseRqd-4zFE8YqMhcGRrjx6nBcODev_4rzTiCo.mp4"}}'
```

**Example with TikTok music:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["tiktok_account_id"]' \
--data-urlencode "scheduled_date_time=2026-05-20 14:30" \
--data-urlencode "content=My video with trending music" \
--data-urlencode "video_url=https://example.com/video.mp4" \
--data-urlencode 'tiktok={"music_title":"Viral Song 2026","music_sound_id":"123456789","music_url":"https://tiktok.com/music/sound/123456789","music_thumbnail":"https://cdn.tiktok.com/album/123456789.jpg","music_author":"Popular Artist"}'
```

### GBP Examples [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#gbp-examples "Direct link to GBP Examples")

**Google Business Profile - Update type:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["accounts/116185162672310389659/locations/1366069594757511498"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "content=Check out our new products!" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M" \
--data-urlencode "google_post_type=update" \
--data-urlencode "cta_button=LEARN_MORE" \
--data-urlencode "cta_button_url=https://example.com"
```

**Google Business Profile - Event type:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["accounts/116185162672310389659/locations/1366069594757511498"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "content=Join us for our annual sale event!" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M" \
--data-urlencode "google_post_type=event" \
--data-urlencode "event_title=Annual Sale" \
--data-urlencode "event_start_date=2026-04-14 08:50 am" \
--data-urlencode "event_end_date=2026-04-21 08:50 am" \
--data-urlencode "cta_button=LEARN_MORE" \
--data-urlencode "cta_button_url=https://example.com"
```

**Google Business Profile - Offer type:**

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/schedulevideopost" \
--data-urlencode "apiKey=621544d93ffe2db52b01" \
--data-urlencode "category_id=49839" \
--data-urlencode 'social_network_id=["accounts/116185162672310389659/locations/1366069594757511498"]' \
--data-urlencode "scheduled_date_time=2026-12-12 13:13" \
--data-urlencode "content=Get 20% off your next order!" \
--data-urlencode "video_url=https://cdn.filestackcontent.com/tpVlPE0qT7u4TwyPoA1M" \
--data-urlencode "google_post_type=offer" \
--data-urlencode "offer_title=20% Off Sale" \
--data-urlencode "offer_start_date=2026-04-14 08:50 am" \
--data-urlencode "offer_end_date=2026-04-21 08:50 am" \
--data-urlencode "coupon_code=SAVE20" \
--data-urlencode "link_to_redeem_url=https://example.com/redeem"
```

## Sample Response [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#sample-response "Direct link to Sample Response")

```json
{
  "message": "1 new Posts Scheduled.",
  "error": false,
  "data": []
}
```

✅ **Result:** Your video post has been successfully scheduled! The message confirms that the post is queued for publishing at the specified date and time.

## Tips & Notes [​](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/\#tips--notes "Direct link to Tips & Notes")

- Ensure your target social accounts are **active** and not expired before scheduling.
- The `social_network_id` must exactly match the account IDs retrieved from the [List Category Accounts](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category) or [List Social Accounts](https://oneup-docs.netlify.app/docs/managing-connections/list-social-accounts) endpoints.
- The `video_url` must be publicly accessible and point directly to a video file.
- For **immediate publishing**, set `scheduled_date_time` to the current timestamp.
- Avoid overloading with too many simultaneous posts to prevent API rate limiting.
- When using platform-specific parameters, ensure the JSON is properly formatted and URL-encoded in the request.

✅ **Next Step:** Combine this with your category and account lookups to automate the video posting workflow end-to-end.

- [Overview](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#overview)
- [Endpoint](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#endpoint)
- [Request Parameters](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#request-parameters)
  - [Google Drive Video URLs](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#google-drive-video-urls)
  - [Platform-Specific Parameters](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#platform-specific-parameters)
  - [GBP Examples](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#gbp-examples)
- [Sample Response](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#sample-response)
- [Tips & Notes](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post/#tips--notes)