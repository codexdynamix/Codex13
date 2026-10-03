---
name: Client credential encryption
description: Stable key requirement for encrypted website and mailbox passwords in Codex Dynamics.
---

The client access feature derives its AES-256-GCM encryption key from the app's `SESSION_SECRET`. Do not rotate that secret while saved client credentials need to remain readable. If rotation is necessary, Super Admins must re-enter saved passwords afterward.

**Why:** changing the secret makes previously encrypted credentials impossible to decrypt.

**How to apply:** keep the same secret across deployments and database restore operations; plan credential resets before changing it.