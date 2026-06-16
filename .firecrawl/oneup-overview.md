[Skip to main content](https://docs.oneupapp.io/docs/overview/#__docusaurus_skipToContent_fallback)

On this page

warning

Analytics and Comment management API endpoints are not available on the **Basic** plan. Upgrade to **Intermediate**, **Growth** or **Business** plan to access these endpoints.

## Introduction [​](https://docs.oneupapp.io/docs/overview/\#introduction "Direct link to Introduction")

Welcome to the **OneUp API** — a RESTful JSON API that allows you to manage your social media content directly from your own applications, tools, or backend systems.
Whether you’re automating post creation, managing social accounts, or building integrations, the API gives you full access to OneUp’s core publishing features.

Agentic Scheduling with Claude

Connect Claude directly to OneUp using our [MCP connector](https://docs.oneupapp.io/docs/oneup-mcp/mcp-connector). Schedule posts, manage accounts, and automate your social media — all through natural language conversations.

## What is OneUp? [​](https://docs.oneupapp.io/docs/overview/\#what-is-oneup "Direct link to What is OneUp?")

**OneUp** is a social media scheduling and publishing platform designed to simplify your content workflow.
With OneUp, you can:

- Schedule and publish posts across multiple platforms
- Manage and categorize social accounts
- Automate recurring posts and campaigns
- Collaborate with your team through shared workspaces

**Supported networks:**
Facebook, Instagram, Twitter/X, LinkedIn, Pinterest, Google Business Profile, Threads, YouTube, Snapchat, and TikTok.

## What can I do with the OneUp API? [​](https://docs.oneupapp.io/docs/overview/\#what-can-i-do-with-the-oneup-api "Direct link to What can I do with the OneUp API?")

With the API, you can programmatically:

- **List Categories** to group social accounts
- **List Social Accounts** associated with each category
- **List All Connected Social Accounts**
- **Create Text Posts**, **Image Posts**, and **Video Posts**

You can use these capabilities to integrate OneUp’s scheduling and publishing workflows directly into your apps, dashboards, or automation tools.

## API Specifications [​](https://docs.oneupapp.io/docs/overview/\#api-specifications "Direct link to API Specifications")

| Property | Value |
| --- | --- |
| **Base URL** | `https://www.oneupapp.io/api/` |
| **Format** | JSON |
| **Auth Method** | API Key (passed as query parameter) |

### Authentication [​](https://docs.oneupapp.io/docs/overview/\#authentication "Direct link to Authentication")

Include your API key as a query parameter in every request:

```text
https://www.oneupapp.io/api/ENDPOINT?apiKey=YOUR_API_KEY
```

For example:

```text
https://www.oneupapp.io/api/listcategory?apiKey=ccf631a87e9e6e514df1
```

You can manage and regenerate your API keys in:
**[https://www.oneupapp.io/api-access](https://www.oneupapp.io/api-access)**

## Support & Resources [​](https://docs.oneupapp.io/docs/overview/\#support--resources "Direct link to Support & Resources")

If you need help using the API:

- Review the **Quick Start Guide** for basic setup instructions
- Check individual endpoint docs for detailed examples
- Contact **[support@oneupapp.io](mailto:support@oneupapp.io)** for technical assistance
- If you cannot find a way to do something, email **[Davis](mailto:davis@oneupapp.io)** from OneUp and we will try to add the feature to the API/MCP for you.

**Next Step:**
👉 Proceed to the [Quick Start Guide](https://docs.oneupapp.io/docs/getting-started/quick-start) to make your first API request.

- [Introduction](https://docs.oneupapp.io/docs/overview/#introduction)
- [What is OneUp?](https://docs.oneupapp.io/docs/overview/#what-is-oneup)
- [What can I do with the OneUp API?](https://docs.oneupapp.io/docs/overview/#what-can-i-do-with-the-oneup-api)
- [API Specifications](https://docs.oneupapp.io/docs/overview/#api-specifications)
  - [Authentication](https://docs.oneupapp.io/docs/overview/#authentication)
- [Support & Resources](https://docs.oneupapp.io/docs/overview/#support--resources)