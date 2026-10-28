# 공유 자료와 소개글

- 저장소: https://github.com/jhyeong687/MAGI
- 움직이는 처리 예시: [processing.gif](./screenshots/processing.gif)
- 1200×630 공유 카드: [social-preview.png](./social-preview.png)
- 상세 화면: [INTERFACE.md](./INTERFACE.md)
- 한글 설명: [README.ko.md](../README.ko.md)

아래 글은 복사해 쓸 수 있는 **초안**이다. 자동 게시하거나 다른 계정에 메시지를 보내는 기능은 없다. 게시하는 커뮤니티의 자기 홍보·팬 프로젝트 규칙을 확인하고, GIF는 예시 데이터로 촬영했다는 점을 유지하라.

## 짧은 영문 소개

> I built a working Evangelion-style MAGI terminal. Three Codex personas independently analyze a question, debate, vote, then deliver one final answer. Runs locally with your own ChatGPT login. Open source. Interface demo uses example data. https://github.com/jhyeong687/MAGI

## 짧은 한국어 소개

> 에반게리온 MAGI를 실제로 돌아가게 만들어봤다. 세 인격이 독립 분석 → 반론 → 재검토 → 투표하고, 최종 답변까지 내린다. 각자 ChatGPT로 로그인해서 로컬에서 사용. 코드·설치법 공개. GIF는 화면 예시다. https://github.com/jhyeong687/MAGI

## Reddit / 커뮤니티용

**Title:** I built an Evangelion-style MAGI terminal with three debating Codex personas

I wanted the MAGI display to do something beyond showing three colored panels, so I built a local app that runs three separate Codex threads. Each analyzes a question independently, challenges the other public assessments, reconsiders and votes. A separate synthesis step answers the original question while preserving the vote and minority concerns.

The UI includes a front-facing 4:3 console, irregular processing lights, inspectable assessments, replay and a final answer on the main screen. The three perspectives follow Naoko's scientist, mother and personal-self aspects, with app-specific dialogue.

It uses your own ChatGPT/Codex account and its allowance. Default deliberation is 13 calls, so it isn't an unlimited free API. The attached GIF uses authored example data to show the interface. Unofficial fan project, open-source software.

Code, installation and screenshots: https://github.com/jhyeong687/MAGI

## Show HN용

**Title:** Show HN: MAGI – a local three-persona debate console using your own ChatGPT login

MAGI is a TypeScript/React local app inspired by Evangelion's decision terminal. Three isolated Codex sessions perform independent analysis, cross-examination, reconsideration and final voting; a deterministic majority rule and one synthesis call produce a direct answer with conditions and dissent.

The interesting part for me was keeping the execution honest: completed-round snapshots, thread isolation, explicit abstention, cancellation that cannot turn into approval, replay that hides future responses, and report-only retries that preserve all votes. Credentials stay with the official Codex CLI on each user's computer.

Default: 13 calls against the user's own allowance. Screenshots/GIF are authored interface examples. Repository: https://github.com/jhyeong687/MAGI

## GitHub 저장소 소개

**Description:** A working Evangelion MAGI terminal. Three Codex personas debate, vote and answer — powered by your own ChatGPT login.

소셜 미리보기 이미지는 저장소 Settings → General → Social preview에 `docs/social-preview.png`를 업로드해 사용할 수 있다. 그림은 로컬 자산으로 재생성한다.

```sh
npm run social-preview
```
