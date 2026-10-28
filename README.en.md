# MAGI // Local Codex Council

An unofficial Evangelion-inspired decision console with **three real Codex sessions** and your own ChatGPT sign-in.

[한국어 / full guide](./README.md) · [Interface gallery](./docs/INTERFACE.md)

![MAGI console](./docs/screenshots/desktop.png)

The gallery uses authored documentation examples, not live model output or actual processing times. Production evaluates your question using your own signed-in account.

## Quick start

Requires Node.js 22+, npm, internet access and a ChatGPT account/workspace eligible to use Codex. Use macOS, Linux or WSL2 on Windows. Native Windows has not been validated.

```sh
git clone https://github.com/jhyeong687/MAGI.git
cd MAGI
npm ci
npm run setup
```

Setup checks the project-local official Codex CLI, opens its ChatGPT sign-in if needed, builds the UI and starts the server. Open **http://127.0.0.1:5173**. Afterwards use `npm start`. You can also start the app first and click **Sign in with ChatGPT**. Login takes place through official Codex; MAGI never collects your password or OAuth tokens. No shared author account or API key is included.

```sh
npm run login
npm run login -- --device
npm run doctor
```

Device-code authentication must be available for your account/workspace. Your ChatGPT/Codex allowance and limits apply. Access is not free or unlimited by virtue of using this app. See [official authentication documentation](https://learn.chatgpt.com/docs/auth).

## Actual process

1. Independent analysis in three separate threads.
2. Cross-examination using a completed-round snapshot.
3. Reconsideration against each persona's previous assessment.
4. Final APPROVE / DENY / ABSTAIN votes.
5. A deterministic majority result followed by one synthesized answer preserving conditions and dissent.

MELCHIOR weights evidence and feasibility; BALTHASAR weights care, relationships and responsibility; CASPER weights personal desire, attachment and choice. These are three aspects of Naoko Akagi, with application-specific conversational interpretation. Disagreement is not forced. They may use the same underlying model.

Default: **12 persona calls + 1 synthesis call**. Two/three discussion cycles use 19/25 calls. Replay makes no additional calls. Report-only retry uses one call.

## Interface

![Processing example](./docs/screenshots/processing.gif)

- Front-facing 4:3 display, fixed diagnostic panels, irregular processing lights.
- Live stages, inspectable public assessments, transcript and searchable archive.
- Voting result and direct answer together; copy and Markdown export.
- Korean/English/Japanese, draft persistence, replay controls, optional audio and reduced motion.
- Local login, cancellation and connection checks.

[All screens](./docs/INTERFACE.md) · [Full desktop](./docs/screenshots/desktop-full.png) · [Mobile](./docs/screenshots/mobile.png)

## Local execution and development

This is a downloaded local application, not a multi-user hosted service or a GitHub Pages AI endpoint. Each installation uses the credentials on that user's computer. Settings and public decision history stay in `.magi/`; questions are sent through Codex to the model. The server binds to loopback and validates Host/Origin. Model sessions are read-only with shell, extra subagents, web search and user MCP configuration disabled. Voting never executes system actions.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run screenshots  # ffmpeg required for the GIF
```

Tests use isolated temporary data and fake runners; they need no account or model calls. `npm run verify:live` is an explicit real-model check, consuming the default 13 calls.

Software: [MIT](./LICENSE). See [third-party notices](./THIRD_PARTY_NOTICES.md) for attribution and the NERV emblem, which is not covered by the software license. This project is not affiliated with the original franchise or OpenAI.
