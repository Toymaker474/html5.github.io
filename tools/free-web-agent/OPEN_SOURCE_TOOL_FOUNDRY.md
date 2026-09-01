# NEXUS Open-Source Tool Foundry Rule

This rule applies to the NEXUS mobile-web simulation and its GitHub cloud agents.

## Plain-language rule

When NEXUS needs a capability:

1. Reuse a trustworthy free/open-source tool when one already fits.
2. Pin its version and verify downloads when practical.
3. If no suitable tool exists, create the smallest real reusable tool needed.
4. Give every tool a clear input, output, command, failure meaning, and evidence file.
5. Test generated tools before they may influence a release decision.
6. Never let an AI model silently merge, publish, delete, or rewrite the live site.
7. Prefer deterministic checks over AI opinions. AI review is advisory only.
8. Keep paid APIs, subscriptions, trials, ad SDKs, and proprietary cloud-model keys out of this system.

## Required qualities

Every found or generated tool must be:

- usable from GitHub Actions and a mobile browser workflow;
- friendly to humans and AI agents;
- non-destructive by default;
- able to explain failure in normal language;
- source-controlled or generated from source-controlled templates;
- covered by a free/open-source license where legally possible;
- evidence-producing rather than self-certifying;
- replaceable without rewriting the simulation.

## Tool layers

### Existing open-source tools

- Vite: production web build.
- Playwright: real browser and touch-size testing.
- Lighthouse CI: web quality evidence.
- Gitleaks: accidental credential scanning.
- npm audit: package vulnerability checks.
- Ollama plus Qwen: advisory second opinion inside the GitHub cloud runner.
- MuJoCo: authoritative physics.
- Babylon.js: visual rendering.

### NEXUS-created tools

The Tool Foundry creates focused tools when the existing stack has a gap. Initial templates include:

- mobile bundle-budget checker;
- evidence hash manifest builder;
- capability inventory and missing-tool plan;
- final fail-closed release gate.

Generated tools are written to workflow artifacts first. They are not automatically committed or published.

## AI-readable contract

The file `capabilities.json` is the machine-readable catalog. The Tool Foundry writes:

- `artifacts/tool-foundry-report.json`;
- `artifacts/tool-foundry-report.md`;
- generated tools under `artifacts/generated-tools/`;
- a generated-tools manifest containing commands and hashes.

## Safety boundary

The web agent may build, inspect, test, create evidence, and update one status issue. It may not merge a pull request, update the production branch with generated code, expose credentials, or call a paid AI API.
