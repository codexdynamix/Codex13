---
name: Imported app runtime checks
description: Runtime and port checks that prevent repeated failures when starting imported Replit artifacts.
---

For imported artifacts, compare the runtime required by the actual command with the workflow-provided runtime, and compare the bound port with the artifact's assigned localPort. Treat engine warnings from build tools separately from runtime startup failures.

**Why:** Imports and subsequent edits can replace earlier runtime and port mismatches. Some locked tools require a newer Node version than the app's development server, so a successful preview alone does not verify the build path.

**How to apply:** Inspect the current package engine requirements, workflow PORT, artifact localPort, start/build commands, and logged bind address before changing runtimes or retrying a failed preview.