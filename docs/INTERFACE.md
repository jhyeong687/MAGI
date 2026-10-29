# Inside the MAGI console

[English](./INTERFACE.md) · [한국어](./INTERFACE.ko.md) · [Installation](./INSTALLATION.md) · [Try the public demo](https://jhyeong687.github.io/MAGI/)

The central **4:3, front-facing MAGI display** keeps its Japanese lettering and original-inspired atmosphere in every language. Controls, help and new local deliberations support English, Japanese, Korean and Simplified Chinese. Fresh installations start in Japanese; select **言語 → English** at the top to switch.

The new public-demo images below use a purpose-made **actual Codex recording**. Its original English opinions and final answer are preserved; localized titles and card summaries are editorial translations. The recording took about 85.8 seconds and starts at 4× playback speed, about 22 seconds. Other legacy gallery images use authored documentation examples. [Complete provenance](./screenshots/README.md)

## Start with a real recorded session

The public demo highlights the actual recording first. A labelled start button appears above the console on desktop and mobile. It replays the existing recording without login or new model calls. Three separately labelled illustrative examples cover approval, denial and no-majority outcomes.

![Japanese default public demo](./screenshots/demo-desktop.png)

[English interface](./screenshots/demo-english.png) · [Mobile first screen](./screenshots/demo-mobile.png)

## Independent analysis

Each core analyzes the question before seeing the others' assessments. Diagnostic panels remain still. Core states change when recorded responses arrive; blue processing pulses are an interface effect, not a measurement of CPU activity.

The status below the sequence shows actual responses received in the current stage, such as **2 / 3 · awaiting CASPER-3**. Counts reset for each stage and discussion cycle. Live runs show elapsed time and time since the last received opinion; replays show **recording position**, not a fabricated estimate. During synthesis, the status distinguishes three received final votes from the single report being written.

![Actual recorded per-stage response status](./screenshots/demo-progress.png)

![Actual recorded independent analysis](./screenshots/demo-independent.png)

## Cross-examination and reconsideration

Select a core to bring its latest public assessment and response to the others into view, including on mobile. Connections remain still; there are no travelling circular markers. Expand **Public debate** for the complete chronological public transcript. This is not a display of private internal reasoning.

![Actual recorded cross-examination](./screenshots/demo-debate.png)

![Actual public assessments](./screenshots/demo-transcript.png)

## Final vote and answer

MELCHIOR approves with conditions, while BALTHASAR and CASPER deny the public demonstration proposal. The recorded result is **2–1 DENIED**; no conflict or vote was forced. **Show final answer** ends playback, plays the Japanese decision reveal, then moves keyboard focus and the viewport to the answer. Natural completion also brings the answer into view.

The report opens with **one concise conclusion, up to three supported next actions and the key objection**. Expand **Read the full answer & evidence** for the original full answer, all conditions and reasons. The three original final opinions have their own expandable section. The report writer does not cast a fourth vote.

Existing records use a labelled first-sentence excerpt, up to three saved conditions and the first saved disagreement. Their source text and votes stay unchanged; no model call is made. New deliberations produce a structured brief within the existing final-report call, keeping the default total at 13 calls. Actions and dissent are not invented to fill empty slots.

The public result uses green for approval, red for denial and amber for no majority. Approval, denial and abstention counts appear beside the ratio.

![Actual final answer, after the decision reveal](./screenshots/demo-recorded.png)

## Share a verdict

Open **Share verdict** after an answer. Review the Japanese **1200×1600** card, edit its short headline and conclusion, or exclude either before saving a PNG. This changes the card caption only; the original question and full report remain unchanged. Supported browsers also provide native image sharing.

![Review the caption and verdict card](./screenshots/share-preview.png)

Public-demo links reopen the same public example, selected language and result. Local decisions link to the generic public demo; private questions, answers and run identifiers never go into those links. MAGI uploads no card content.

## Ask your own question locally

The **Prepare a question** helper offers Project, Career and Everyday decision templates. Edit the situation, decision and priorities, then explicitly add them to your question. Existing text is preserved, repeated application avoids duplication and the 6,000-character limit is enforced. Applying a draft never starts a deliberation. Helper fields survive reloads in this browser.

The public demo provides the same helper for local drafting and copying only. It never submits your draft, changes the selected recorded proposal or inserts draft text into shared URLs. Use the separate free cloud trial or the local app to deliberate on that question.

![Editable question helper in the public demo](./screenshots/demo-question-guide.png)

The recorded-demo mode is replay-only. A separate **Try your own question — free** screen submits new questions to Cloudflare GLM-4.7-Flash without login, with shared daily limits and honest availability. [Trial limits and privacy](./CLOUD_TRIAL.md). **Ask your own question · install locally** leads to installation instructions and the [English installation/troubleshooting guide](./INSTALLATION.md). Each person uses their own computer and ChatGPT/Codex account. Official Codex handles sign-in and credential storage.

![Local app sign-in](./screenshots/login.png)

A default new deliberation uses **13 calls** against the signed-in account's allowance. The local app also offers a searchable archive, replay, copy/report export, persona details and configurable discussion cycles, prompts and effects.

[Local desktop](./screenshots/desktop-full.png) · [Persona detail](./screenshots/persona.png) · [Settings](./screenshots/settings.png)

[Mobile answer brief](./screenshots/demo-answer-mobile.png)

## Language, motion and keyboard controls

The MAGI artwork always keeps **提訴 / 決議 / 待機 / 審議中 / 可決 / 否決 / 保留**, including the final reveal. Switching the surrounding language does not translate saved records. Chinese UI uses Simplified Chinese.

The console maintains its 4:3 ratio at small sizes. The primary start and playback controls retain text labels and touch targets. The app supports visible keyboard focus, Escape to close dialogs, reduced motion and animations OFF. Synthesized audio is optional and OFF by default.

Use **Effects ON/OFF** in the public-demo header to disable visual effects without stopping playback. The choice survives reloads. System reduced-motion preferences take priority and update while the page is open; turning motion off during the decision reveal still brings the final answer into view.
