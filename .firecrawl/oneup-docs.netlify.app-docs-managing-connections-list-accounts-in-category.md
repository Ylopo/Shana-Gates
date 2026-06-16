[Skip to main content](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/#__docusaurus_skipToContent_fallback)

On this page

## Overview [​](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/\#overview "Direct link to Overview")

The **List Category Accounts** endpoint allows you to retrieve all **social accounts** associated with a specific category. Each category can have one or more connected accounts, such as Facebook Pages, Twitter profiles, Google Business and more.

**Base URL:**

```text
https://www.oneupapp.io
```

## Endpoint [​](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/\#endpoint "Direct link to Endpoint")

```text
GET /api/listcategoryaccount?apiKey=YOUR_API_KEY&category_id=CATEGORY_ID
```

**Example:**

```text
GET https://www.oneupapp.io/api/listcategoryaccount?apiKey=621544d93ffe2db52b01&category_id=49839
```

## Request Parameters [​](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/\#request-parameters "Direct link to Request Parameters")

| Parameter | Required | Description |
| --- | --- | --- |
| `apiKey` | Yes | Your personal API key generated from the [API Access page](https://www.oneupapp.io/api-access). |
| `category_id` | Yes | The unique ID of the category whose connected accounts you want to retrieve. |

## Sample Request [​](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/\#sample-request "Direct link to Sample Request")

```text
curl -X GET "https://www.oneupapp.io/api/listcategoryaccount?apiKey=YOUR_API_KEY&category_id=CATEGORY_ID"
```

## Sample Response [​](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/\#sample-response "Direct link to Sample Response")

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

✅ **Result:** The response lists all the social media accounts linked to the specified category. Each item includes:

- `social_network_name` — The display name of the connected social account.
- `social_network_id` — The unique identifier used when scheduling or publishing posts.
- `social_network_type` — The type of network (e.g., Facebook, Pinterest, GBP, Twitter, etc.).

## Usage Example [​](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/\#usage-example "Direct link to Usage Example")

1. First, use the [List Categories](https://oneup-docs.netlify.app/docs/managing-connections/list-categories) endpoint to get your desired `category_id`.
2. Then, use this endpoint to find all accounts linked to that category.
3. Finally, use the `social_network_id` values when creating or scheduling posts.

✅ **Next Step:** Proceed to the [Creating Post](https://oneup-docs.netlify.app/docs/category/creating-posts) section to publish content using the category and account IDs retrieved here.

- [Overview](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/#overview)
- [Endpoint](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/#endpoint)
- [Request Parameters](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/#request-parameters)
- [Sample Request](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/#sample-request)
- [Sample Response](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/#sample-response)
- [Usage Example](https://oneup-docs.netlify.app/docs/managing-connections/list-accounts-in-category/#usage-example)