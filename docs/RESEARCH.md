# MAGI 공개 구현 조사 및 통합 결정

2026-10-28에 지정된 다섯 저장소를 직접 shallow clone하고 README, 디렉터리, 실행 코드, 라이선스를 확인했다. 복제본은 `.research/repos/`에 보관하며 앱 번들에 포함하지 않는다. 원본 앱은 설치·실행하지 않았고, 실행 가능성은 의존성과 코드 분석 기준이다. 아래 기능은 광고 문구와 실제 코드 확인을 구분했다.

| 저장소 / 확인 커밋                                                                         | 구조·UI·애니메이션                                                                                                                         | AI·통신·판정                                                                                                                                                                                                                                                                          | 라이선스 / 이 환경의 실행 조건                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ws752499660/MAGI-decision](https://github.com/ws752499660/MAGI-decision) `6acac155`       | `frontend/`: Vite/vanilla JS, CSS clip-path 삼각 배치, CRT, flicker, 다국어, localStorage 기록. `worker/`: Cloudflare Workers              | Worker가 API로 세 요청을 병렬 실행. 서버는 찬성 2표로 승인하지만 `main.js:84`의 화면 종합 상태는 반대가 하나라도 있으면 거부하여 불일치. 실제 교차 토론은 없음. 근거는 투표 후 별도 요청                                                                                              | LICENSE 없음, GitHub license null. **직접 복사하지 않음**. Cloudflare/KV와 별도 LLM API 자격 증명이 필요하므로 그대로는 요청에 부적합                                    |
| [Adrian-Sandwich/magi-council](https://github.com/Adrian-Sandwich/magi-council) `bb99526e` | Python 3.14+, Postgres, `debate-mcp/`, `memory-graph/`, vanilla web UI와 CSS, 상태 API. 다수의 테스트                                      | `heads.py`에서 인격과 제공자 분리. `heads.example.json`은 `codex exec` 실행, `cli_output.py`는 `--json` 이벤트와 사용량 추출. relay는 좌석별 in-flight 잠금, 프로세스 그룹 종료, 타임아웃. `decision.py`는 모든 좌석 응답 후 다수결/소수 의견/재판정. 자동 코드 실행·병합 기능도 있음 | MIT, Adrian Medina 2026. 구조는 참고하되 Postgres/자동 병합은 도입하지 않음. Python 3.14와 Postgres 추가 준비 필요; 원본 미실행                                          |
| [fshiori/magi](https://github.com/fshiori/magi) `5daa5f87`                                 | Python, LiteLLM, FastAPI/WebSocket, `core/`, `protocols/`, `web/static/`. NERV 대시보드와 실시간 노드 이벤트                               | `critique.py`: 초기 병렬 응답 → 다른 의견 비판/수정 반복. 단어 Jaccard로 합의 추정. `vote.py`: POSITION 추출 후 다수결, 실패 시 degraded 결과. 합의 유사도를 실제 표와 혼동할 가능성 있어 채택하지 않음                                                                               | `pyproject.toml`에 MIT 선언은 있으나 LICENSE/저작권 고지 파일 없음, GitHub license null. 조건 불명확하므로 **코드 복사하지 않음**. LiteLLM 모델 제공자 필요; 원본 미실행 |
| [TomaszRewak/MAGI](https://github.com/TomaszRewak/MAGI) `98a4d018`                         | Python Dash 2.9 + React 컴포넌트. `assets/style.css`: 특징적 다각형 3개, 대각 연결선, amber/cyan/green/red, CSS flicker. 클릭 시 응답 모달 | `ai.py`: legacy OpenAI 0.27 API, GPT-4. 인격별 응답 후 yes/no/conditional 분류, 실제 교차 토론 없음. 사용자 질문/API 키 입력                                                                                                                                                          | MIT, Tomasz Rewak 2023. **다각형 좌표와 상태 색상을 일부 재사용**, 고지를 THIRD_PARTY_NOTICES에 보존. 오래된 API와 별도 키 필요하여 백엔드는 교체                        |
| [float1122/magi-system](https://github.com/float1122/magi-system) `74d11176`               | 실행 앱이 아닌 Claude Code Markdown skill과 ASCII 배너. `magi/SKILL.md`, `references/magi-protocol.md`, SECURITY                           | 세 관점에 판단 노드 배정, 병렬 subagents, 일반 2/3, 위험 작업은 만장일치/거부권. 검증 실패 노드 제외 및 재시도 한도. Codex 코드가 있는 것은 아님                                                                                                                                      | MIT, jangfolk 2026. 인격 분리와 명시적 한도만 개념 참고. Claude 전용 명령을 가정하지 않고 검증된 Codex CLI로 새로 구현. 원본 미실행                                      |

## 채택 구조

React + TypeScript + Vite / Node + Express / SSE. 초기 버전은 MIT 원본 D의 기하학 일부를 사용했다. 현재 SVG는 TV판 캡처의 두 장면을 측정해 새로 그렸으며 초기 재사용에 대한 MIT 고지는 유지한다. Tailwind 없이 CSS로 도형, CRT, 상태 전환과 reduced-motion을 관리한다. 로컬 사용에는 Postgres 없이 원자적 JSON 저장으로 충분하다. 서버가 판정/기록의 단일 원천이며 SSE 스냅샷을 통해 재접속도 복원한다.

공식 [`codex exec`](https://developers.openai.com/codex/noninteractive)의 JSONL, JSON Schema와 [`exec resume`](https://developers.openai.com/codex/cli/reference)를 사용한다. 인격별 실제 thread ID를 유지하고 같은 라운드의 의견을 모두 수집한 뒤 다음 라운드에 공유한다. 특정 인격의 빠른 응답이 같은 라운드 다른 인격의 입력에 유출되지 않는다. 모델 내부 reasoning 이벤트는 저장·전송하지 않는다. 공개용 최종 메시지의 구조화된 근거만 표시한다.

일반 표결은 APPROVE 2표 이상 → APPROVED, DENY 2표 이상 → DENIED, 나머지 → INCONCLUSIVE. 기권은 찬반 어느 쪽에도 더하지 않는다. 분모는 항상 3이며 실패한 인격의 표를 조작하지 않는다. 평가 중 오류·중지는 표를 합성하지 않는다. 세 실제 표가 완성된 뒤에는 별도 보고 컨텍스트의 Codex 1회가 질문에 대한 종합 답변을 작성한다. 보고자는 네 번째 표를 행사하지 않고 고정된 표결을 바꿀 수 없다. 보고 단계만 실패·중지되면 기존 표를 보존하고 답변만 재시도한다.

## 실행 검증과 배포

초기 개발은 macOS arm64에서 정상 동작하는 앱 번들 CLI로 검증했다. 공개 배포판은 프로젝트 의존성에 고정된 공식 `@openai/codex`를 우선 사용한다. 호환되지 않는 전역 CLI는 필요한 격리 옵션을 점검해 제외한다.

- 공식 `exec --json --output-schema`와 `exec resume`을 사용한다. 사용자 설정과 MCP를 불러오지 않고 read-only, shell/subagent/web-search 비활성 조건으로 실행한다.
- 로그인은 각자의 컴퓨터에서 공식 Codex로 수행한다. 저장된 인증을 재사용하며 계정 한도가 적용된다. 앱은 인증 파일이나 비공개 과금 API를 직접 읽지 않는다.
- 기본 토론 1회 = 초기 분석 3 + 반박 3 + 재검토 3 + 최종 투표 3 + 종합 답변 1 = **13회**. 토론 반복 2/3회는 19/25회다.
- 과거 심의에 답변을 추가하거나 수동 재시도할 때는 보고서 1회다. 자동 재시도하지 않는다.

개인 실행 기록과 인증 정보는 공개 저장소에서 제외한다. 재현 가능한 검증 방법은 [VERIFICATION.md](./VERIFICATION.md)에 기록한다.
