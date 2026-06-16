[Skip to main content](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/#__docusaurus_skipToContent_fallback)

On this page

## Overview [​](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/\#overview "Direct link to Overview")

The **List Categories** endpoint allows you to retrieve all categories associated with your OneUp account. Each category is used to group and manage your **connected social accounts**, not posts. You can use these categories to identify which accounts belong together under the same group.

**Base URL:**

```text
https://www.oneupapp.io
```

## Endpoint [​](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/\#endpoint "Direct link to Endpoint")

```text
GET /api/listcategory?apiKey=YOUR_API_KEY
```

**Example:**

```text
GET https://www.oneupapp.io/api/listcategory?apiKey=621544d93ffe2db52b01
```

## Request Parameters [​](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/\#request-parameters "Direct link to Request Parameters")

| Parameter | Required | Description |
| --- | --- | --- |
| `apiKey` | Yes | Your personal API key generated from the [API Access page](https://www.oneupapp.io/api-access). |

## Sample Request [​](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/\#sample-request "Direct link to Sample Request")

```text
curl -X GET "https://www.oneupapp.io/api/listcategory?apiKey=YOUR_API_KEY"
```

## Sample Response [​](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/\#sample-response "Direct link to Sample Response")

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

✅ **Result:** The response returns all categories linked to your account. Each category includes an `id`, `category_name`, and creation details — allowing you to later fetch the accounts grouped under that category.

- [Overview](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/#overview)
- [Endpoint](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/#endpoint)
- [Request Parameters](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/#request-parameters)
- [Sample Request](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/#sample-request)
- [Sample Response](https://oneup-docs.netlify.app/docs/managing-connections/list-categories/#sample-response)