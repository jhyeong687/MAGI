import {
  PERSONAS,
  defaultSettings,
  decide,
  type Assessment,
  type Core,
  type Persona,
  type Phase,
  type ProcessEvent,
  type Run,
  type Vote,
} from '../../shared/domain.ts';

export const fixtureIds = {
  approved: '10000000-0000-4000-8000-000000000001',
  denied: '10000000-0000-4000-8000-000000000002',
  inconclusive: '10000000-0000-4000-8000-000000000003',
  error: '10000000-0000-4000-8000-000000000004',
  cancelled: '10000000-0000-4000-8000-000000000005',
  legacy: '10000000-0000-4000-8000-000000000006',
  answerError: '10000000-0000-4000-8000-000000000007',
} as const;
export function fixtureAssessment(persona: Persona, vote: Vote, phase: Phase): Assessment {
  return {
    vote,
    summary: `테스트 전용 ${persona} ${phase} 공개 응답`,
    rationale: ['자동 검증을 위한 고정 응답이며 제품 실행에 포함되지 않습니다.'],
    risks: ['테스트 조건'],
    responseToOthers:
      phase === 'independent' ? '' : `다른 인격의 공개 주장에 대한 ${persona}의 검증용 반론`,
    confidence: 70,
  };
}
export function createScenario(kind: keyof typeof fixtureIds): Run {
  const base = Date.parse('2026-10-01T00:00:00Z') + (kind === 'approved' ? 10 : 0) * 60_000;
  const now = (ms: number) => new Date(base + ms).toISOString();
  const fresh = (): Core => ({
    state: 'STANDBY',
    usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
  });
  const run: Run = {
    id: fixtureIds[kind],
    question: `[TEST FIXTURE ${kind.toUpperCase()}] 테스트 전용 심의`,
    createdAt: now(0),
    updatedAt: now(0),
    version: 0,
    status: 'running',
    phase: 'independent',
    round: 0,
    settings: structuredClone(defaultSettings),
    cores: { melchior: fresh(), balthasar: fresh(), casper: fresh() },
    records: [],
    events: [],
  };
  const event = (time: number) => {
    run.updatedAt = now(time);
    run.version++;
    run.events!.push({
      at: run.updatedAt,
      version: run.version,
      phase: run.phase,
      round: run.round,
      status: run.status,
      recordCount: run.records.length,
      error: run.error,
      answer: run.answer ? structuredClone(run.answer) : undefined,
      cores: Object.fromEntries(
        PERSONAS.map((persona) => [
          persona,
          {
            state: run.cores[persona].state,
            usage: { ...run.cores[persona].usage },
            error: run.cores[persona].error,
            threadId: run.cores[persona].threadId,
          },
        ]),
      ) as ProcessEvent['cores'],
    });
  };
  event(0);
  const phases: Phase[] = ['independent', 'cross-examination', 'reconsideration', 'final-vote'];
  phases.forEach((phase, stage) => {
    if (run.status !== 'running') return;
    run.phase = phase;
    run.round = stage ? 1 : 0;
    for (const persona of PERSONAS)
      run.cores[persona].state =
        stage === 0 ? 'ANALYZING' : stage === 3 ? 'VOTING' : 'DELIBERATING';
    event(stage * 1000 + 50);
    if (kind === 'cancelled' && stage === 1) {
      run.status = 'cancelled';
      for (const persona of PERSONAS) run.cores[persona].state = 'STANDBY';
      event(1400);
      return;
    }
    if (kind === 'error' && stage === 3) {
      run.status = 'error';
      run.error = 'TERMINAL ERROR AFTER RECONSIDERATION';
      for (const persona of PERSONAS) {
        run.cores[persona].state = 'ERROR';
        run.cores[persona].error = `TERMINAL ${persona} ERROR`;
      }
      event(3400);
      return;
    }
    PERSONAS.forEach((persona, index) => {
      const vote: Vote =
        kind === 'denied'
          ? persona === 'casper'
            ? 'APPROVE'
            : 'DENY'
          : kind === 'inconclusive'
            ? persona === 'melchior'
              ? 'APPROVE'
              : persona === 'balthasar'
                ? 'DENY'
                : 'ABSTAIN'
            : persona === 'balthasar'
              ? 'DENY'
              : 'APPROVE';
      const assessment = fixtureAssessment(persona, vote, phase);
      const core = run.cores[persona];
      core.threadId = `20000000-0000-4000-8000-00000000000${index + 1}`;
      core.latest = assessment;
      core.usage.inputTokens += 10;
      core.usage.outputTokens += 5;
      if (stage === 3) {
        core.finalVote = vote;
        core.state = vote === 'APPROVE' ? 'APPROVED' : vote === 'DENY' ? 'DENIED' : 'ABSTAIN';
      }
      const time = stage * 1000 + 450 + index * 150;
      run.records.push({
        persona,
        phase,
        round: run.round,
        assessment,
        at: now(time),
        durationMs: 400 + index * 150,
      });
      event(time);
    });
  });
  if (run.status === 'running') {
    run.status = 'completed';
    run.phase = 'report';
    run.verdict = decide(PERSONAS.map((persona) => run.cores[persona].finalVote!));
    if (kind !== 'legacy')
      run.answer = {
        status: kind === 'answerError' ? 'error' : 'completed',
        startedAt: now(3800),
        completedAt: now(4000),
        usage: { inputTokens: 20, outputTokens: 10, cachedTokens: 0 },
        ...(kind === 'answerError'
          ? { error: 'Recorded synthesis error' }
          : {
              content: {
                answer: `테스트 전용 종합 답변: ${run.verdict.result}. 조건을 먼저 확인하세요.`,
                keyReasons: ['세 인격의 검증용 공통 근거'],
                conditions: ['검증용 실행 조건'],
                disagreements: ['BALTHASAR-2의 반대 의견을 함께 고려하세요.'],
              },
            }),
      };
    event(4000);
  }
  run.completedAt = run.updatedAt;
  return run;
}
