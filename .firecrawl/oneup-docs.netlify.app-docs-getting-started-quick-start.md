[Skip to main content](https://oneup-docs.netlify.app/docs/getting-started/quick-start/#__docusaurus_skipToContent_fallback)

On this page

## Overview [​](https://oneup-docs.netlify.app/docs/getting-started/quick-start/\#overview "Direct link to Overview")

This guide walks you through the **step-by-step process** of integrating with the **OneUp API** — from searching categories to scheduling your first post.

All requests use your `apiKey` as a query parameter and share the following **Base URL:**

```text
https://www.oneupapp.io
```

## Step 1: Search for Categories [​](https://oneup-docs.netlify.app/docs/getting-started/quick-start/\#step-1-search-for-categories "Direct link to Step 1: Search for Categories")

Start by retrieving and searching through all categories linked to your account. Once you find the category you want, note its ID for later.

**Endpoint:**

```text
GET https://www.oneupapp.io/api/listcategory?apiKey=YOUR_API_KEY
```

**Response Example:**

```json
{
  "message": "OK",
  "error": false,
  "data": [\
    {\
      "id": 49839,\
      "category_name": "AAA testingg",\
      "isPaused": 0,\
      "created_at": "2020-12-09 14:37:45"\
    },\
    {\
      "id": 63889,\
      "category_name": "Client #2",\
      "isPaused": 0,\
      "created_at": "2021-10-05 18:29:04"\
    }\
  ]
}
```

✅ **Result:** Filter the list by `category_name` to find the one you want, then copy its `id`.

## Step 2: Find Accounts Linked to a Category [​](https://oneup-docs.netlify.app/docs/getting-started/quick-start/\#step-2-find-accounts-linked-to-a-category "Direct link to Step 2: Find Accounts Linked to a Category")

Use your chosen `category_id` to find all the social accounts associated with it.

**Endpoint:**

```text
GET https://www.oneupapp.io/api/listcategoryaccount?apiKey=YOUR_API_KEY&category_id=CATEGORY_ID
```

**Response Example:**

```json
{
  "message": "OK",
  "error": false,
  "data": [\
    {\
      "category_id": 49839,\
      "social_network_name": "kumarvishi",\
      "social_network_id": "pin_kumarvishi",\
      "social_network_type": "Pinterest"\
    },\
    {\
      "category_id": 49839,\
      "social_network_name": "OneUp (United States)",\
      "social_network_id": "accounts/116185162672310389659/locations/1366069594757511498",\
      "social_network_type": "GBP"\
    }\
  ]
}
```

✅ **Result:** Save one or more `social_network_id` values that you want to post to.

## Step 3: Schedule a Post [​](https://oneup-docs.netlify.app/docs/getting-started/quick-start/\#step-3-schedule-a-post "Direct link to Step 3: Schedule a Post")

Once you have both your **Category ID** and **Social Account IDs**, you can create your post.

**Endpoint:**

Use this endpoint to schedule a text post. If you want to schedule the post across all social accounts enabled for a given category, set the value of `social_network_id` to `ALL`.

```text
GET https://www.oneupapp.io/api/scheduletextpost?apiKey=YOUR_API_KEY&category_id=CATEGORY_ID&social_network_id=["NETWORK_ID_1","NETWORK_ID_2"]&scheduled_date_time=YYYY-MM-DD HH:MM&content=Your post content here
```

**Response Example:**

```json
{
  "message": "1 new Posts Scheduled.",
  "error": false,
  "data": []
}
```

✅ **Result:** Your post has been successfully scheduled! 🎉

## Summary [​](https://oneup-docs.netlify.app/docs/getting-started/quick-start/\#summary "Direct link to Summary")

1. **Search for a category** → get `category_id`.
2. **List accounts for that category** → get `social_network_id`s.
3. **Use both IDs** → create your post with `scheduletextpost`.

- [Overview](https://oneup-docs.netlify.app/docs/getting-started/quick-start/#overview)
- [Step 1: Search for Categories](https://oneup-docs.netlify.app/docs/getting-started/quick-start/#step-1-search-for-categories)
- [Step 2: Find Accounts Linked to a Category](https://oneup-docs.netlify.app/docs/getting-started/quick-start/#step-2-find-accounts-linked-to-a-category)
- [Step 3: Schedule a Post](https://oneup-docs.netlify.app/docs/getting-started/quick-start/#step-3-schedule-a-post)
- [Summary](https://oneup-docs.netlify.app/docs/getting-started/quick-start/#summary)