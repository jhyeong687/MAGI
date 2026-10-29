# Free cloud trial

[Open the live trial](https://jhyeong687.github.io/MAGI/?lang=ja&mode=trial) · [Recorded demo](https://jhyeong687.github.io/MAGI/) · [Local Codex edition](./INSTALLATION.md)

The public trial accepts your own proposal without installation, login or an API key. It uses **Cloudflare Workers AI / `@cf/zai-org/glm-4.7-flash`**, a different model from the local ChatGPT/Codex edition. Japanese MAGI artwork, the front-facing 4:3 geometry and irregular processing lights remain fixed. Operator controls and new responses support Japanese, English, Korean and Simplified Chinese. Japanese is the first-visit default.

## How many visitors can try it?

| Limit                      | Public trial                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Shared daily compute       | **10,000 Neurons**, enforced by Cloudflare Workers Free                                          |
| Request-protection ceiling | 1,000 starts/day across all visitors; an abuse safeguard, **not** 1,000 free completed decisions |
| Daily starts per IP        | **10**; people sharing a network share this limit                                                |
| Simultaneous decisions     | **2**; extra requests receive a busy response, with no queue                                     |
| Question                   | 1–800 Unicode characters and at most 2,400 UTF-8 bytes                                           |
| Process                    | Independent ×3 → cross-examination ×3 → reconsideration ×3 → final vote ×3 → one report          |
| Calls                      | At most **13 per accepted run**; no automatic retries                                            |
| Output ceiling             | 640 tokens per assessment, 1,000 for the report                                                  |
| Time ceiling               | 60 seconds per call; 240 seconds per run                                                         |
| Daily reset                | **00:00 UTC / 09:00 Korea and Japan**                                                            |

The old 20-start cap has been removed. The trial stays open while Cloudflare's **account-wide free compute** remains. The number of people or completed decisions is not fixed: question length, output length, failed calls and other account usage all matter. Failed and cancelled starts count toward IP/request protection. People on a shared university or household network share the IP limit. Anonymous access cannot verify unique people.

Cloudflare includes **10,000 Neurons per day** on Workers Free. This is compute, not 10,000 questions. The fixed GLM-4.7-Flash model uses 5,500 Neurons per million input tokens and 36,400 per million output tokens. A decision using 10,000 input and 2,000 output tokens would consume about **128 Neurons**, equivalent to roughly 78 decisions from an otherwise unused daily allocation. This is an example calculation, not a guaranteed capacity. Long questions, longer outputs, failed calls and other account usage reduce the number. [Official pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

For the same short prototype/deadline scenario, one verification in each of the four languages used about **120–175 Neurons** by the published token rates. That corresponds arithmetically to roughly **57–83** such decisions from an otherwise unused allocation. Four samples are not a capacity benchmark: longer inputs, longer answers, failed calls and other account usage change the result.

The 1,000-start request ceiling protects storage and the service from loops of malformed or failed requests. Normal full deliberations will generally exhaust compute well before that ceiling; the service does not reserve a separate 1,000-call paid allowance. Per-IP limits and the two-run concurrency limit keep one visitor from taking every slot at once.

The screen shows **decisions started today** and the IP's remaining starts. It does not display the request-ceiling remainder as free AI credits, invent an exact provider balance or promise a completion ETA. A daily-allocation error (`3036`) closes new starts until reset. Temporary capacity exhaustion (`3040` / other transient 429 responses) ends that attempt with a busy message but **does not close the whole day**. There are no automatic retries or paid fallbacks. [Provider error definitions](https://developers.cloudflare.com/workers-ai/platform/errors/)

## Native-language answers

New deliberations receive writing guidance in the chosen language in the system instruction as well as persona-specific priorities. Korean uses complete, natural declarative sentences and restrained non-honorific authority. English avoids bureaucratic phrasing, Chinese avoids translated word order and stock official language, and Japanese uses clear plain form. Each aspect retains its own priorities; style does not force agreement, confidence or a vote.

The report schema binds the first sentence to the **actual deterministic verdict** in the chosen language. A response with a contradictory opening is rejected and the real votes remain visible. Historical discussion is labelled separately from current final positions, so an old opinion is not presented as a current dissent. Non-reasoning mode is selected explicitly to avoid spending the small output budget on private reasoning. No extra translation or polishing call is added: the maximum remains 13 model calls. Existing recordings and saved opinions remain verbatim.

## Zero-spend deployment design

- Deploy only on **Workers Free**. On Free, exceeding allocation fails rather than purchasing overage. Workers Paid charges overage and must not be enabled for this deployment. No paid upgrade, prepaid credit, paid model, AI Gateway billing, custom domain purchase or paid fallback is part of setup.
- Before deployment, activation, availability checks and each accepted run, query the account subscriptions using a **Billing Read** token. A Workers paid/unknown subscription, inaccessible billing API, malformed response or paginated/incomplete result refuses inference. Cloudflare's API may omit a Workers Free subscription; successful results without a Workers subscription are accepted as Free. The deployed account was also checked in its dashboard.
- The runtime gets only this read-only guard token and a random IP-hashing salt as Worker secrets. It receives **no OpenAI key, Codex credential, Cloudflare deployment token or billing write permission**.
- A single SQLite Durable Object for each UTC day serializes reservations **before** inference. Global, per-IP and active-run counters persist across requests and deployments. Duplicate attempt IDs cannot run twice. Cancellation/failure never refunds a start. The IP salt survives redeployment.
- Native Workers AI binding, one fixed free-eligible model, one bounded discussion cycle, no tools and no alternate provider. A confirmed daily-neuron quota response closes new starts for that day; temporary capacity errors do not. The Free plan also hard-stops Workers and Durable Object limits. [Durable Objects Free limits](https://developers.cloudflare.com/durable-objects/platform/pricing/) · [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

The guard checks the plan before each run; it is not an atomic lock on account billing settings. **Do not change this account's plan during active requests**, attach unified billing, or remove the provider's free-plan enforcement. Revoking the guard token or disabling the worker pauses the trial. No script upgrades plans or provisions a paid resource.

## Privacy and honest results

Starting sends the proposal and public assessments to Cloudflare. The server keeps the active question and transcript in memory for the connected response; it does **not** persist questions, answers, public histories or result URLs. Only counters, random attempt IDs, active-run expiry times and a day-specific HMAC of the connecting IP are stored. These counters are deleted by an alarm after the following day. Request logging is disabled in this Worker; Cloudflare still processes traffic under its own [data usage policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

Drafts use this tab's `sessionStorage`. Reloading loses the received result; copy/download the report first. A verdict card is generated locally and is shared only through your chosen download/share action. Links never include a private question, transcript or run ID; a private verdict's link opens the generic demo.

The three personas use separate public contexts of **the same GLM-4.7-Flash model**. They are not statistically independent models, and this trial is not the local edition's persistent Codex threads. Each stage receives a fixed completed-stage snapshot, and independent analysis sees no peer judgments. The model returns brief public assessments, not private chain of thought. Two approvals approve, two denials deny, otherwise the result is inconclusive. Missing or invalid votes are never fabricated. The report has no fourth vote. If reporting fails after voting, the actual verdict remains visible.

## Deploy your own Free-only instance

1. Use a Cloudflare account whose **Workers plan is Free**. Do not upgrade or add prepaid AI credits. Confirm the current provider terms and free eligibility of the fixed model.
2. Create a **Billing Read-only** token limited to that account. This permission can read the account's billing profile, subscriptions, usage and invoices; it cannot charge or change subscriptions. Keep it private.
3. Create a temporary account token with **Workers Scripts Write**, **Workers AI Read** and **Billing Read**, with a short expiry. Cloudflare scopes this to the account, not a single Worker; keep it private and revoke it after deployment. Do not add DNS, payment or Billing Edit permissions.
4. Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (temporary deploy token), and, on first setup, `MAGI_BILLING_READ_TOKEN` (the separate permanent read-only guard) in your private process environment. For updates, the temporary deployment token can verify Free using its Billing Read permission while the existing runtime guard secret is preserved. The temporary deployment token is never installed as the runtime guard. Never put tokens in a browser bundle, Git-tracked file, shell history or GitHub Pages config.
5. Run `npm ci`, `npm test`, `npm run check:cloud`, then **`npm run deploy:cloud`**. This verifies Free, checks the required guard secret, deploys disabled, installs any explicitly supplied missing secrets, verifies Free again, then activates. It neither makes an inference call nor upgrades a plan. Running plain `wrangler deploy` uses the checked-in **disabled** default.
6. Put only the deployed HTTPS `workers.dev` origin in `public/trial-config.json`. Change `ALLOWED_ORIGIN` in `wrangler.jsonc` if hosting your frontend elsewhere. Build/publish the static frontend with `npm run build:demo`. Never publish a token.
7. Verify CORS, a real bounded run, quota/cancellation behavior, and the Free plan again. Revoke the temporary deployment token. Do not run load tests against the live free allowance.

The existing GitHub Pages workflow builds only the frontend; it does not receive Cloudflare secrets or deploy backend changes. Backend updates need the explicit free-plan-checked deployment command. No GitHub Actions secret was added for automatic billing-capable access.

To pause inference, deploy the checked-in disabled config with the correct account selected, or set `TRIAL_ENABLED=false` in the Worker settings. Keep the recorded demo online. Do not delete other applications or account resources.

## 한국어 요약

[무료 웹 체험](https://jhyeong687.github.io/MAGI/?lang=ko&mode=trial)은 로그인 없이 자기 질문을 넣는 실제 GLM-4.7-Flash 심의다. **하루 20회 제한은 없앴다. 무료 연산량이 남아 있는 동안 이용할 수 있고**, 같은 IP는 **하루 10회**, 동시 심의는 **2건**이다. 반복 실패나 도배로 서비스가 망가지지 않도록 전체 요청 보호 상한 1,000회도 둔다. 1,000번의 완료를 보장하거나 별도 유료 할당을 쓰는 것이 아니다. 실패·중단도 이용 횟수에 포함된다. 한국 시간 **오전 9시**에 초기화된다. 대학·가정처럼 회선을 공유하면 IP별 열 회를 함께 쓴다.

Cloudflare의 **무료 10,000 Neurons/일**은 질문 수가 아니라 연산량이다. 화면에는 오늘 접수한 심의와 IP별 남은 횟수만 표시한다. 남은 AI 연산량을 추정해서 표시하지 않으며, 제공자 무료 한도가 먼저 소진되면 조기에 닫힌다. 유료 요금제이거나 요금제 확인에 실패해도 시작하지 않는다. 무료 요금제에서 초과 요청은 오류로 멈추며, 유료 전환이나 운영자의 OpenAI API·Codex로 대체하지 않는다.

질문·공개 의견은 Cloudflare로 전송된다. 서버에 질문·답변을 저장하거나 다른 방문자에게 공개하지 않는다. 탭 새로고침 전 결과를 복사하거나 내려받아라. 일본어 원작 콘솔·정면 4:3 비율·불규칙 점멸은 유지된다. 기존 로컬 Codex 앱과 녹화 데모도 계속 사용할 수 있다.

한국어는 완결된 문장과 자연스러운 반말을 우선하고, 영어·일본어·중국어도 각 언어의 문체 지침을 직접 적용한다. 번역이나 윤문을 위한 호출은 추가하지 않는다. 새 답변에만 적용하며 과거 기록과 영상의 원문을 바꾸지 않는다.
