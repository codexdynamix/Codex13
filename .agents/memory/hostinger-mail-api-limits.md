---
name: Hostinger Mail API limits
description: Provider limitations affecting Codex Dynamics mailbox drafts and message-list previews.
---

The official Hostinger Mail API contract exposes no provider-side draft operations, and folder-message summaries have no preview/snippet field. Keep drafts stored in Codex, scoped to both client and mailbox. Do not fetch every message body on every page just to synthesize previews without first accounting for added provider traffic and rate limits.

**Why:** The documented list and send schemas were checked while implementing the portal; local drafts are the supported fallback, while body fetching is a separate provider request.

**How to apply:** Recheck Hostinger's current OpenAPI before changing this behavior. If previews are added, use bounded requests and caching rather than one uncached body request per list row.