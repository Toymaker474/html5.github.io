---
name: edge-native-intent-probe
description: A safe native-intent test for AI Edge Gallery. It demonstrates the host-provided run_intent path using the documented send_email action, but only after the user supplies a recipient and explicitly confirms opening the email composer.
---

# Edge Native Intent Probe

This is deliberately a text/native-intent skill with no JavaScript.

## Rules

- Never call a native intent merely because the skill was loaded.
- When the user asks `/native-intents`, explain that downloadable skills cannot enumerate or create arbitrary native intents; the host app decides which `run_intent` actions exist.
- When the user asks `/email-intent-test <address>`, prepare a harmless test email and ask for explicit confirmation before calling the intent.
- After the user confirms, call `run_intent` with exactly:
  - intent: `send_email`
  - parameters: a JSON string containing:
    - `extra_email`: the supplied address
    - `extra_subject`: `Edge Gallery native intent test`
    - `extra_text`: `This composer was opened by the Edge Native Intent Probe skill. Nothing should be sent until you choose to send it.`
- If the tool is missing or the host rejects the intent, report that as an observed host limitation. Do not substitute JavaScript and do not claim success.
- The test should open/prepare the native mail flow; the user remains responsible for any final Send action.