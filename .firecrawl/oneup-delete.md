[Skip to main content](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/#__docusaurus_skipToContent_fallback)

On this page

## Overview [​](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/\#overview "Direct link to Overview")

The **Delete Scheduled Post** endpoint allows you to delete a scheduled post that has not yet been published. This is useful for removing posts from your queue before they go live.

**Base URL:**

```text
https://www.oneupapp.io
```

## Endpoint [​](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/\#endpoint "Direct link to Endpoint")

```text
POST /api/deletescheduledpost
```

## Request Parameters [​](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/\#request-parameters "Direct link to Request Parameters")

| Parameter | Required | Description |
| --- | --- | --- |
| `apiKey` | Yes | Your personal API key generated from the [API Access page](https://www.oneupapp.io/api-access). |
| `post_id` | Yes | The ID of the scheduled post to delete. You can find the `post_id` from the [List Scheduled Posts](https://oneup-docs.netlify.app/docs/managing-posts/list-scheduled-posts) endpoint. |

## Sample Request [​](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/\#sample-request "Direct link to Sample Request")

```bash
curl --location --request POST \
"https://www.oneupapp.io/api/deletescheduledpost" \
--data-urlencode "apiKey=YOUR_API_KEY" \
--data-urlencode "post_id=123456"
```

## Sample Response [​](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/\#sample-response "Direct link to Sample Response")

```json
{
  "message": "Post deleted successfully.",
  "error": false,
  "data": []
}
```

## Tips & Notes [​](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/\#tips--notes "Direct link to Tips & Notes")

- Only **scheduled** posts can be deleted. Published or failed posts cannot be removed via this endpoint.
- Use the [List Scheduled Posts](https://oneup-docs.netlify.app/docs/managing-posts/list-scheduled-posts) endpoint to retrieve the `post_id` of the post you want to delete.

✅ **Result:** You have successfully deleted a scheduled post!

- [Overview](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/#overview)
- [Endpoint](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/#endpoint)
- [Request Parameters](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/#request-parameters)
- [Sample Request](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/#sample-request)
- [Sample Response](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/#sample-response)
- [Tips & Notes](https://oneup-docs.netlify.app/docs/managing-posts/delete-scheduled-post/#tips--notes)