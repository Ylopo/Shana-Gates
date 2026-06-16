[Skip to main content](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/#__docusaurus_skipToContent_fallback)

On this page

## Overview [​](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/\#overview "Direct link to Overview")

The **List Published Posts** endpoint allows you to retrieve a history of posts that have already been published. This is useful for auditing or displaying a publication history in your application.

**Base URL:**

```text
https://www.oneupapp.io
```

## Endpoint [​](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/\#endpoint "Direct link to Endpoint")

```text
GET /api/getpublishedposts
```

## Request Parameters [​](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/\#request-parameters "Direct link to Request Parameters")

| Parameter | Required | Description |
| --- | --- | --- |
| `apiKey` | Yes | Your personal API key generated from the [API Access page](https://www.oneupapp.io/api-access). |
| `start` | No | The starting index for pagination. Defaults to `0`. Each request returns up to 50 posts. |

## Sample Request [​](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/\#sample-request "Direct link to Sample Request")

```bash
curl --location --request GET \
"https://www.oneupapp.io/api/getpublishedposts?apiKey=YOUR_API_KEY&start=0"
```

## Sample Response [​](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/\#sample-response "Direct link to Sample Response")

```json
{
  "message": "OK",
  "error": false,
  "data": [\
    {\
      "email": "user@example.com",\
      "content": "My published post content",\
      "source_url": null,\
      "created_at": "2026-02-15 10:00:00",\
      "category_name": "My Category",\
      "video_url": null,\
      "post_id": "FB_123456789",\
      "content_image": "https://example.com/image.jpg",\
      "social_network_username": "my_social_handle"\
    }\
  ]
}
```

## Response Fields [​](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/\#response-fields "Direct link to Response Fields")

| Field | Description |
| --- | --- |
| `email` | The account email associated with the post. |
| `content` | The text content of the post. |
| `source_url` | The source URL (if applicable). |
| `created_at` | The date and time when the post was published. |
| `category_name` | The name of the category the post belongs to. |
| `video_url` | The URL of the attached video (if applicable). |
| `post_id` | The platform-specific post ID (if available). |
| `content_image` | The URL of the attached image (if applicable). |
| `social_network_username` | The username of the social account where the post was published. |

✅ **Result:** You have successfully retrieved your published posts history!

- [Overview](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/#overview)
- [Endpoint](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/#endpoint)
- [Request Parameters](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/#request-parameters)
- [Sample Request](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/#sample-request)
- [Sample Response](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/#sample-response)
- [Response Fields](https://oneup-docs.netlify.app/docs/managing-posts/list-published-posts/#response-fields)