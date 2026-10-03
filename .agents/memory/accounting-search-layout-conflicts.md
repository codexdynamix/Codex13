---
name: Accounting search layout conflicts
description: How shared CRM form styles can break compact accounting search controls.
---

For compact CRM search controls, use a neutral container instead of a form-label element, and prevent generic field defaults from controlling the internal search input.

**Why:** Shared form styles can force label wrappers into block layout and add input spacing, minimum height, or background fills. These defaults made the search icon and input stack and appear as two framed fields; focus-style changes alone did not address it.

**How to apply:** When a compact search control looks doubled or misaligned, inspect its rendered structure and broad label/input selectors before changing focus styles. Keep accessible naming on the input itself.