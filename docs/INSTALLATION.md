# Installation and personal ChatGPT sign-in

[English](./INSTALLATION.md) · [한국어](./INSTALLATION.ko.md) · [日本語 quick start](../README.ja.md#起動) · [中文 quick start](../README.zh-CN.md#开始使用)

**Want to look around first? [Open the public demo](https://jhyeong687.github.io/MAGI/).** It replays one actual Codex session and three labelled illustrative examples, with no login or new model calls. Asking your own question requires the local app described here.

## 1. Before you start

You need **Node.js 22+**, npm, Git, internet access, and your own ChatGPT account/workspace with Codex access.

| Platform | Where to run the commands                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| macOS    | Terminal                                                                                                     |
| Linux    | Your terminal                                                                                                |
| Windows  | A **WSL2 Linux terminal** with Node.js and Git installed inside WSL2. Native Windows has not been validated. |

Install Node.js from the [official download page](https://nodejs.org/en/download), then check:

```sh
node --version
npm --version
git --version
```

## 2. Download and install

```sh
git clone https://github.com/jhyeong687/MAGI.git
cd MAGI
npm ci
npm run setup
```

Setup checks the official Codex CLI included in the project, starts official ChatGPT sign-in if needed, builds the interface, and starts the local server. No global Codex installation or API key is required.

If you do not use Git, choose **Code → Download ZIP** on GitHub, unzip it, open a terminal in that folder, and run `npm ci` followed by `npm run setup`.

## 3. Sign in and open MAGI

Complete the official browser sign-in with **your own ChatGPT account** and the workspace you intend to use. Open the local address shown in Terminal, normally **[http://127.0.0.1:5173](http://127.0.0.1:5173)**.

You can also run `npm start` first and use the app's **Sign in with ChatGPT** button. MAGI starts the official Codex login process and checks its result; Codex handles credential storage and renewal. MAGI does not collect your password or send OAuth credentials to the browser UI. API-key authentication is disabled for this app.

If this computer already has an official Codex ChatGPT login, it may be reused. People sharing the same OS account and Codex credential store are not automatically separated into different MAGI accounts; use your own computer/OS account.

**Japanese is the first-launch language.** Use **言語** at the top to select **English / 한국어 / 日本語 / 中文**. Controls and new deliberations follow the selection. The central MAGI artwork, 提訴 / 決議, status stamps and verdict reveal stay Japanese. Saved responses retain their original text.

## 4. Ask a question

Write a question that MAGI can judge, then start the deliberation. The three personas independently analyze it, exchange objections, reconsider and vote. The main screen shows the result and a synthesized answer. Open a core or the transcript to inspect the public assessments.

Use **Prepare a question** to choose a Project, Career or Everyday decision example and edit its situation, decision and priorities. Explicitly applying the helper preserves an existing draft and does not start the model. During a run, the status shows actual responses received per stage and the personas still awaited. The answer opens with a concise conclusion, up to three next actions and the key objection; expand the full answer and evidence for all conditions and original opinions. Existing records use labelled excerpts without a new call.

**A default deliberation uses 13 model calls against your account allowance.** Two/three discussion cycles use 19/25 calls. Sign-in alone does not guarantee model availability or unlimited access. Replay makes no new calls. Cancellation cannot undo completed usage, and there are no automatic retries.

## 5. Next time, stop and update

```sh
cd MAGI
npm start
```

Stop the server with **Ctrl+C** in its terminal. To update a Git checkout after stopping it:

```sh
git pull --ff-only
npm ci
npm run build
npm start
```

Your `.magi/` directory stores settings, questions and decision records. Keep that folder to preserve them. Requests still go through Codex to the online model; local execution is not offline inference.

## Troubleshooting

| What happened?                                  | What to check                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The login browser did not open                  | Run `npm run login` in the project folder and open the official URL printed by Codex.                                    |
| The browser callback cannot reach this computer | Run `npm run login -- --device` if device-code login is enabled for your account/workspace.                              |
| MAGI still asks you to connect                  | Use **Check connection again** or run `npm run doctor`. This app requires ChatGPT authentication, not an API key.        |
| Login succeeds, but a deliberation is rejected  | Check Codex access, workspace policy, model availability and account usage limits. Read the actual error.                |
| Missing files or unsupported CLI capabilities   | Run `npm ci` to restore the pinned dependencies.                                                                         |
| Usage limit or timeout                          | Wait for account limits to recover, or adjust the next run's per-call timeout. No retry happens automatically.           |
| Port 5173 is occupied                           | Stop the other MAGI server, or use `PORT=5180 npm start`.                                                                |
| The public trial will not accept a new question | Check the shared/per-IP quota and availability. Recorded playback is separate. See [Free cloud trial](./CLOUD_TRIAL.md). |

`npm run doctor` checks CLI/auth/capabilities without making a model call. The [official authentication guide](https://learn.chatgpt.com/docs/auth) covers browser and device login.

## Change accounts

Finish the current deliberation and stop the server first, then run:

```sh
npx --no-install codex logout
npm run login
npm start
```

Logging out of Codex can affect other Codex tools under the same OS account. Old MAGI records are not deleted when the account changes. Never share or upload Codex auth files or your `.magi/` folder.

## Optional configuration

macOS/Linux/WSL examples, applied on the next server start:

```sh
PORT=5180 npm start
MAGI_DATA_DIR='/absolute/path/to/private-magi-data' npm start
MAGI_CODEX_BIN='/absolute/path/to/compatible/codex' npm start
```

- `PORT`: local port, default **5173**.
- `MAGI_DATA_DIR`: settings/record directory, default the project's `.magi/`.
- `MAGI_CODEX_BIN`: an explicit compatible CLI path; otherwise the pinned project Codex takes priority.

Data stored outside the repository is outside its `.gitignore` protection. The server binds to loopback and validates Host/Origin. It is a personal local app; hosting a shared multi-user AI backend needs separate authentication, authorization and account isolation.
