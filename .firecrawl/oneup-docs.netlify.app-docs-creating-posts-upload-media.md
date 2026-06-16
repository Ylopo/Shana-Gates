[Skip to main content](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#__docusaurus_skipToContent_fallback)

On this page

warning

This endpoint is only available on the **Growth** and **Business** plans. Uploading files via the API and using the URL returned by OneUp helps reduce the chances of failed posts, as the media is automatically resized and optimized to meet each social network's specifications.

## Overview [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#overview "Direct link to Overview")

The **Upload Media** endpoint allows you to upload media files (images and videos) to OneUp's storage. The upload process consists of two steps:

1. **Get an upload URL** — Call the Upload Media endpoint to receive a pre-signed `upload_url` and a `file_path`.
2. **Upload your file** — Use the `upload_url` to upload your file directly to storage via a PUT request.
3. **Use the file path** — Once uploaded, use the `file_path` as the `image_url` or `video_url` in your post creation requests.

**Base URL:**

```text
https://www.oneupapp.io
```

## Endpoint [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#endpoint "Direct link to Endpoint")

```text
GET /api/uploadmedia
```

## Request Parameters [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#request-parameters "Direct link to Request Parameters")

| Parameter | Required | Description |
| --- | --- | --- |
| `apiKey` | Yes | Your personal API key generated from the [API Access page](https://www.oneupapp.io/api-access). |

## Step 1: Get Upload URL [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#step-1-get-upload-url "Direct link to Step 1: Get Upload URL")

### Sample Request [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#sample-request "Direct link to Sample Request")

```bash
curl --location --request GET \
"https://oneupapp.io/api/uploadmedia?apiKey=621544d93ffe2db52b01"
```

### Sample Response [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#sample-response "Direct link to Sample Response")

```json
{
    "upload_url": "https://oneupdata.s3.us-east-2.amazonaws.com/api-uploads/daviswbaer%40gmail.com/9d13f671-6b21-4229-95b8-23240e78ad89?x-amz-acl=public-read&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIY6DV4UGMLTDBOLA%2F20260421%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20260421T120531Z&X-Amz-SignedHeaders=host%3Bx-amz-acl&X-Amz-Expires=1200&X-Amz-Signature=65e0a60eda48adb9a099eaea2c924d92bc4019e953bdab2bb7c6d5ed5592fc04",
    "file_path": "https://s3.us-east-2.amazonaws.com/oneupdata/api-uploads/daviswbaer@gmail.com/9d13f671-6b21-4229-95b8-23240e78ad89"
}
```

## Step 2: Upload Your File [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#step-2-upload-your-file "Direct link to Step 2: Upload Your File")

Use the `upload_url` from the response to upload your file via a PUT request. Make sure to include the correct `Content-Type` header for your file type.

### Sample Request [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#sample-request-1 "Direct link to Sample Request")

```bash
curl -X PUT "https://oneupdata.s3.us-east-2.amazonaws.com/api-uploads/daviswbaer%40gmail.com/13be1955-882e-4af1-bedc-0fa81b5592e8?x-amz-acl=public-read&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIY6DV4UGMLTDBOLA%2F20260421%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20260421T095711Z&X-Amz-SignedHeaders=host%3Bx-amz-acl&X-Amz-Expires=1200&X-Amz-Signature=ef93e63a81a175b68a35f08c1842ac9e28ffa3036041aee23a347dfe353fbf02" \
  -H "Content-Type: video/mp4" \
  --upload-file "/path/to/your/file.mp4"
```

### Common Content Types [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#common-content-types "Direct link to Common Content Types")

| File Type | Content Type |
| --- | --- |
| MP4 Video | `video/mp4` |
| JPEG Image | `image/jpeg` |
| PNG Image | `image/png` |
| GIF Image | `image/gif` |
| WebP Image | `image/webp` |

## Step 3: Use the File Path [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#step-3-use-the-file-path "Direct link to Step 3: Use the File Path")

After a successful upload, use the `file_path` from Step 1 as the media URL in your post creation requests:

- For image posts: use it as the `image_url` parameter in [Create Image Post](https://oneup-docs.netlify.app/docs/creating-posts/create-image-post).
- For video posts: use it as the `video_url` parameter in [Create Video Post](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post).

✅ **Result:** Your media file has been uploaded and is ready to be used in your scheduled posts.

## Tips & Notes [​](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/\#tips--notes "Direct link to Tips & Notes")

- The `upload_url` is a pre-signed URL that **expires after 20 minutes**. Upload your file promptly after receiving it.
- Make sure to set the correct `Content-Type` header that matches your file type.
- The `file_path` is publicly accessible after upload and can be used directly in post creation endpoints.
- You can reuse the same `file_path` across multiple posts.

✅ **Next Step:** Use the returned `file_path` with the [Create Image Post](https://oneup-docs.netlify.app/docs/creating-posts/create-image-post) or [Create Video Post](https://oneup-docs.netlify.app/docs/creating-posts/create-video-post) endpoints to schedule your posts.

- [Overview](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#overview)
- [Endpoint](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#endpoint)
- [Request Parameters](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#request-parameters)
- [Step 1: Get Upload URL](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#step-1-get-upload-url)
  - [Sample Request](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#sample-request)
  - [Sample Response](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#sample-response)
- [Step 2: Upload Your File](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#step-2-upload-your-file)
  - [Sample Request](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#sample-request-1)
  - [Common Content Types](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#common-content-types)
- [Step 3: Use the File Path](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#step-3-use-the-file-path)
- [Tips & Notes](https://oneup-docs.netlify.app/docs/creating-posts/upload-media/#tips--notes)