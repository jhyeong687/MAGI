// Explicit, quota-consuming recording for the public demo. Never invoked by build or CI.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultSettings, PERSONAS, type Run } from '../shared/domain.ts';
import { detectEnvironment } from '../server/codex.ts';
import { Orchestrator } from '../server/orchestrator.ts';
import { Store } from '../server/store.ts';

if (!process.argv.includes('--record'))
  throw new Error('Use --record to authorize 13 real Codex calls.');
const directory = resolve('.research/public-recording');
const store = new Store(directory);
const environment = await detectEnvironment();
if (!environment.ready || !environment.binary)
  throw new Error('Sign in with official Codex first.');
const orchestrator = new Orchestrator(store);
const run = orchestrator.create(
  'Public demonstration scenario: We are building a hobby app with a demo due in two days. Should we add one exciting new feature now? The existing demo works. The feature would take about six hours, has no tests yet, and can be disabled behind a feature flag. A teammate has volunteered to help but also needs sleep. Judge the proposal; do not perform any action.',
  { ...structuredClone(defaultSettings), locale: 'en' },
  environment.binary,
);
let lastPhase = '';
try {
  await new Promise<void>((done, reject) => {
    const timeout = setTimeout(() => {
      orchestrator.cancel(run.id);
      reject(new Error('Recording timed out.'));
    }, 15 * 60_000);
    orchestrator.on(run.id, (next: Run) => {
      if (next.phase !== lastPhase) {
        lastPhase = next.phase;
        console.log(next.phase);
      }
      if (next.status === 'running') return;
      clearTimeout(timeout);
      if (next.status !== 'completed' || next.answer?.status !== 'completed') {
        reject(new Error('Recording did not complete. Private raw output preserved.'));
        return;
      }
      const zero = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
      const cleanAnswer = (answer: Run['answer']) =>
        answer
          ? {
              status: answer.status,
              startedAt: answer.startedAt,
              completedAt: answer.completedAt,
              revision: answer.revision,
              content: answer.content,
              usage: zero,
            }
          : undefined;
      // Explicit allowlist: never publish original IDs, account usage, paths, auth or sessions.
      const clean: Run = {
        id: '40000000-0000-4000-8000-000000000001',
        question: next.question,
        status: next.status,
        phase: next.phase,
        round: next.round,
        version: next.version,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
        completedAt: next.completedAt,
        settings: { ...structuredClone(defaultSettings), locale: 'en' },
        cores: Object.fromEntries(
          PERSONAS.map((persona) => [
            persona,
            {
              state: next.cores[persona].state,
              latest: next.cores[persona].latest,
              finalVote: next.cores[persona].finalVote,
              usage: zero,
            },
          ]),
        ) as Run['cores'],
        records: next.records.map(({ persona, phase, round, assessment, at, durationMs }) => ({
          persona,
          phase,
          round,
          assessment,
          at,
          durationMs,
        })),
        verdict: next.verdict,
        answer: cleanAnswer(next.answer),
        events: next.events?.map(
          ({ at, version, phase, round, status, recordCount, answer, cores }) => ({
            at,
            version,
            phase,
            round,
            status,
            recordCount,
            answer: cleanAnswer(answer),
            cores: Object.fromEntries(
              PERSONAS.map((persona) => [persona, { state: cores[persona].state, usage: zero }]),
            ) as NonNullable<Run['events']>[number]['cores'],
          }),
        ),
      };
      mkdirSync('demo/recordings', { recursive: true });
      writeFileSync('demo/recordings/public-run.json', JSON.stringify(clean, null, 2));
      console.log(
        `Recorded ${clean.records.length} public assessments and final answer. Session identifiers removed.`,
      );
      done();
    });
  });
} finally {
  orchestrator.shutdown();
}
