import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.MAGI_URL || 'http://127.0.0.1:5173';
const question =
  process.env.MAGI_TEST_QUESTION ||
  '일주일 뒤 연구 발표가 있습니다. 성능이 더 좋지만 안정성 검증이 덜 된 새 로봇 제어 알고리즘을 시뮬레이션 데모에 넣을까요? 실제 로봇은 사용하지 않으며 기존 알고리즘과 녹화 영상을 예비 수단으로 준비할 수 있습니다.';
const started = await fetch(`${base}/api/runs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question }),
});
if (!started.ok) throw new Error(await started.text());
let run = await started.json();
console.log('LIVE SESSION', run.id);
let version = 0;
const deadline = Date.now() + 20 * 60_000;
while (run.status === 'running') {
  if (Date.now() > deadline) {
    await fetch(`${base}/api/runs/${run.id}/cancel`, { method: 'POST' });
    throw new Error('Live verification exceeded 20 minutes.');
  }
  await new Promise((r) => setTimeout(r, 1500));
  run = await (await fetch(`${base}/api/runs/${run.id}`)).json();
  if (run.version !== version) {
    version = run.version;
    console.log(
      run.phase,
      `${run.records.length} assessments`,
      Object.entries(run.cores)
        .map(([p, c]) => `${p}:${(c as { state: string }).state}`)
        .join(' / '),
    );
  }
}
mkdirSync('docs/evidence', { recursive: true });
writeFileSync(
  process.env.MAGI_EVIDENCE_FILE || 'docs/evidence/live-run.json',
  JSON.stringify(run, null, 2),
);
if (run.status !== 'completed') throw new Error(run.error || run.status);
const threads = Object.values(run.cores).map((core) => (core as { threadId: string }).threadId);
if (
  new Set(threads).size !== 3 ||
  run.records.length !== 6 + 6 * run.settings.discussionRounds ||
  run.answer?.status !== 'completed'
)
  throw new Error('Session isolation or phase coverage failed.');
console.log('VERIFIED', JSON.stringify(run.verdict), threads);
console.log('RECORDED SERVER EVENTS', run.events?.length || 0);
console.log('FINAL ANSWER', run.answer.content.answer);
