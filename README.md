<div align="center">

# M A G I

### Three minds debate. MAGI delivers the verdict.

**A working Evangelion-inspired terminal, powered by your own ChatGPT account.**

[Quick start](#quick-start) · [Screens](#inside-the-console) · [How it works](#three-perspectives-one-recorded-decision) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [中文](./README.zh-CN.md)

![MAGI processing](./docs/screenshots/processing.gif)

**MELCHIOR-1 · BALTHASAR-2 · CASPER-3**

Real Codex sessions · Live debate · Majority vote · A direct final answer

</div>

MAGI turns a question into a recorded council session: three distinct perspectives analyze it independently, challenge each other, reconsider, and cast their final votes. You see the process unfold on a front-facing **4:3 MAGI display**, then read the verdict and the answer together.

It's an unofficial fan project with an actual decision engine behind the console. No shared author account, no API key to paste, and no canned production responses.

> The screenshots and GIF use authored documentation examples. They show the interface, not live model output or measured inference speed. Running MAGI invokes Codex with your own signed-in account.

If this is the kind of terminal you've wanted to use, a **★** helps other fans find it.

## Quick start

**Node.js 22+**, npm, internet access, and your own ChatGPT account/workspace with Codex access. macOS/Linux; use **WSL2** on Windows. Native Windows has not been validated.

```sh
git clone https://github.com/jhyeong687/MAGI.git
cd MAGI
npm ci
npm run setup
```

Setup checks the bundled official Codex CLI, opens the official ChatGPT sign-in when needed, builds the UI, and starts the local server. Open **[127.0.0.1:5173](http://127.0.0.1:5173)**.

Already connected? Use `npm start` next time. You can also start the app first and click **Sign in with ChatGPT**. Use the **Language** selector at the top: **English / 한국어 / 日本語 / 中文**. Fresh installs start in English. Menus, console labels and new deliberations follow your selection; saved questions and responses keep their original language.

```sh
npm start                 # Start; builds the UI if no build exists
npm run login             # Official browser sign-in
npm run login -- --device # Device code, if enabled for your account/workspace
npm run doctor            # Check CLI/auth/capabilities; no model call
```

**This is a downloaded local app.** Each person runs it on their own computer with their own credentials. GitHub Pages cannot execute its local Codex backend. [Detailed installation guide / 설치 안내](./docs/INSTALLATION.md)

## Inside the console

![MAGI operations control](./docs/screenshots/desktop.png)

| Screen                                                                                               | What you can do                                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Personal sign-in](./docs/screenshots/login.png)                                                     | Connect your own ChatGPT account through official Codex.                 |
| [Independent analysis](./docs/screenshots/independent.png)                                           | Watch each core analyze the question before seeing peer opinions.        |
| [Cross-examination](./docs/screenshots/debate.png)                                                   | Follow irregular processing lights and the actual response count.        |
| [Public transcript](./docs/screenshots/debate-transcript.png)                                        | Read each assessment, objection and reconsideration.                     |
| [Persona detail](./docs/screenshots/persona.png)                                                     | Inspect the source aspect, priorities, reasons and risks.                |
| [Final answer](./docs/screenshots/answer.png)                                                        | See the vote, answer, prerequisites and remaining disagreement together. |
| [Configuration](./docs/screenshots/settings.png)                                                     | Change language, cycles, timeout, persona prompts and effects.           |
| [Full desktop](./docs/screenshots/desktop-full.png) / [Mobile layout](./docs/screenshots/mobile.png) | Inspect the complete responsive interface.                               |

[Full visual walkthrough](./docs/INTERFACE.md) · [Share card](./docs/social-preview.png)

### Built to feel like an operations console

- A large, front-facing 4:3 display with fixed diagnostic panels and the NERV emblem.
- Irregular blue processing pulses, response-driven states, and a final decision stamp.
- Five visible stages, public assessments, a searchable decision archive, and saved drafts.
- A direct synthesized answer alongside the voting result; copy it or save a Markdown report.
- Replay the recorded process with pause, seek and speed controls. **No new model calls.**
- English, Korean, Japanese and Simplified Chinese from the top language control.
- Optional synthesized audio, animations OFF, reduced motion, keyboard focus and Escape controls.

The original work informs the visuals and persona mapping. Exact fonts, every animation frame and original sounds are not reproduced. [Reference and reconstruction notes](./docs/ANIME_REFERENCE.md)

## Three perspectives, one recorded decision

| Core            | Source aspect of Naoko Akagi | What carries more weight                                       |
| --------------- | ---------------------------- | -------------------------------------------------------------- |
| **MELCHIOR-1**  | Scientist                    | Evidence, causal claims, testable conditions and feasibility.  |
| **BALTHASAR-2** | Mother                       | Care, trust, responsibility and who bears the consequences.    |
| **CASPER-3**    | Woman / personal self        | Desire, attachment, pride and the freedom to choose or refuse. |

These are three aspects of one source personality, with application-specific dialogue. They can agree for different reasons. No persona is forced to approve, reject or create conflict. They may use the same underlying model; three sessions do not mean three statistically independent models. [Persona design](./docs/PERSONAS.md)

```text
Your question
    ↓
Independent analysis  →  Cross-examination  →  Reconsideration
    ↓
Three final votes: APPROVE / DENY / ABSTAIN
    ↓
Deterministic majority result
    ↓
Synthesized answer, conditions and dissent
```

Every stage waits for all three responses before sharing a fixed snapshot. Each persona retains its own thread. The report writer has **no fourth vote** and cannot change the result. Failed evaluations do not become fabricated votes. Report-only failure preserves the completed vote and can be retried separately.

**Voting:** two approvals → `APPROVED`; two denials → `DENIED`; otherwise → `INCONCLUSIVE`. Abstentions count toward neither side. The denominator stays three.

![Final answer with conditions and dissent](./docs/screenshots/answer.png)

## Your account, your allowance

MAGI delegates sign-in, token storage and renewal to official Codex. It never collects your password or reads OAuth credentials into the browser. API-key authentication is disabled for this app. [Official authentication documentation](https://learn.chatgpt.com/docs/auth)

A Codex-eligible account/workspace is required. Your account usage limits apply; this is **not free or unlimited** simply because it is open source.

| Discussion cycles | Persona calls | Report call |  Total |
| ----------------- | ------------: | ----------: | -----: |
| 1, default        |            12 |           1 | **13** |
| 2                 |            18 |           1 | **19** |
| 3                 |            24 |           1 | **25** |

Report-only generation, voice refresh or manual retry uses one report call. Cancellation does not undo usage already consumed. There are no automatic retries. Actual latency depends on the question, response length and account conditions.

## Local execution and data

Settings, questions and public decision records live in your installation's `.magi/`. The author's credentials and personal records are excluded from this repository. Requests are sent through Codex to the model; a local UI does not imply an offline model.

The server binds to loopback and validates Host/Origin. It is not a multi-user hosted service. Model sessions run read-only with shell, extra subagents, web search and user MCP configuration disabled. A vote never executes system actions.

## Development

```sh
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run screenshots     # Documentation examples; ffmpeg needed for GIF
npm run social-preview # Render the share card from local assets
```

Tests use isolated temporary storage and fake runners; they require no account or model calls. Browser tests run on port **5187**, never the production instance. `npm run verify:live` is an explicit real-model check consuming the default 13 calls. [Verification and limits](./docs/VERIFICATION.md)

- [Architecture and open-source research](./docs/RESEARCH.md)
- [Korean documentation](./README.ko.md)
- [Launch copy and sharing assets](./docs/SHARING.md)

## Credits

Unofficial fan project. Not affiliated with the Evangelion rights holders or OpenAI. Software: **[MIT](./LICENSE)**. The original franchise names, NERV emblem and other third-party assets are covered separately in [third-party notices](./THIRD_PARTY_NOTICES.md); the software license does not grant rights to those marks.
