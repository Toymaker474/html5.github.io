---
name: edge-secret-probe
description: Safely tests AI Edge Gallery's secure skill secret-injection path without echoing or storing the secret.
metadata:
  require-secret: true
  require-secret-description: Enter disposable test text only. The skill will report its character count and a short SHA-256 fingerprint, never the secret itself.
---

# Edge Secret Probe

Use this only to test the `require-secret` mechanism.

You MUST call `run_js` with:
- script name: `index.html`
- data: `{"action":"probe"}`

The script receives the secret through Edge Gallery's separate secret parameter. It must never print, return, persist, transmit, or log the secret value. It returns only whether a secret was received, its character count, and the first 12 hex characters of its SHA-256 digest.

If the secret prompt does not appear, report that the host did not expose the documented secure-secret path for this skill/runtime.