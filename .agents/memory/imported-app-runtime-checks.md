---
name: Imported app runtime checks
description: Runtime and port checks that prevent repeated failures when starting imported Replit artifacts.
---

For imported artifacts, verify the workflow-provided runtime and port against native APIs and the package's start command before retrying. A fixed CLI port can override the artifact's assigned port even when the app itself starts normally.

**Why:** This project initially used Node 20 despite importing `node:sqlite`, and its Vite command forced port 3000 while the artifact expected port 23839. Both services appeared broken until the runtime and actual listening port were compared with their configured values.

**How to apply:** On a failed preview, compare the required runtime, workflow `PORT`, artifact `localPort`, package start script, and the server's logged bind address before restarting or changing application code.