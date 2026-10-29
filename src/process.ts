import {
  PERSONAS,
  type CoreState,
  type Persona,
  type Phase,
  type ProcessEvent,
  type Run,
} from '../shared/domain.ts';

export const screenPhases: Record<Phase, { japanese: string; english: string }> = {
  independent: { japanese: '個別解析', english: 'INDEPENDENT ANALYSIS' },
  'cross-examination': { japanese: '相互検証', english: 'CROSS EXAMINATION' },
  reconsideration: { japanese: '再審議', english: 'RECONSIDERATION' },
  'final-vote': { japanese: '決議投票', english: 'FINAL VOTE' },
  report: { japanese: '決議終了', english: 'DELIBERATION COMPLETE' },
};

// Use only responses visible in the current snapshot, never future replay events.
export function phaseProgress(run: Run) {
  const phase = run.phase === 'report' ? 'final-vote' : run.phase;
  const received = new Set(
    run.records
      .filter((record) => record.phase === phase && record.round === run.round)
      .map((record) => record.persona),
  );
  return {
    received: received.size,
    waiting: PERSONAS.filter((persona) => !received.has(persona)),
    latestAt: Math.max(
      0,
      ...run.records.map((record) => Date.parse(record.at)).filter(Number.isFinite),
    ),
  };
}

export function corePresentation(run: Run | null, persona: Persona) {
  const core = run?.cores[persona];
  if (!run) return { pending: false, tone: 'standby', label: 'STANDBY', japanese: '待機' };
  if (run.status === 'running' && core?.state === 'STANDBY')
    return { pending: false, tone: 'standby', label: 'QUEUED', japanese: '待機' };
  if (run.status === 'cancelled')
    return {
      pending: false,
      tone: 'aborted',
      label: core?.finalVote || 'ABORTED',
      japanese: '中止',
    };
  if (core?.state === 'ERROR' || run.status === 'error')
    return { pending: false, tone: 'error', label: 'ERROR', japanese: '障害' };
  if (core?.finalVote)
    return {
      pending: false,
      tone:
        core.finalVote === 'DENY'
          ? 'denied'
          : core.finalVote === 'APPROVE'
            ? 'approved'
            : 'abstain',
      label: core.finalVote,
      japanese: core.finalVote === 'DENY' ? '否定' : core.finalVote === 'APPROVE' ? '承認' : '棄権',
    };
  const received = run.records.some(
    (record) =>
      record.persona === persona && record.phase === run.phase && record.round === run.round,
  );
  return {
    pending: run.status === 'running' && !received,
    tone: 'standby',
    label: received
      ? 'RESPONSE RECEIVED'
      : run.phase === 'final-vote'
        ? 'VOTING'
        : run.phase === 'independent'
          ? 'ANALYZING'
          : 'DELIBERATING',
    japanese: received ? '応答済' : run.phase === 'final-vote' ? '投票中' : '処理中',
  };
}

export function resolution(run: Run | null) {
  if (run?.status === 'cancelled') return { text: '中止', tone: 'aborted' };
  if (run?.status === 'error') return { text: '障害', tone: 'error' };
  if ((run?.status === 'completed' || run?.phase === 'report') && run.verdict)
    return {
      text:
        run.verdict.result === 'APPROVED'
          ? '可決'
          : run.verdict.result === 'DENIED'
            ? '否決'
            : '保留',
      tone: run.verdict.result.toLowerCase(),
    };
  return { text: run?.status === 'running' ? '審議中' : '待機', tone: 'pending' };
}

// New decisions store exact server transitions. Older records reconstruct phase boundaries
// from each real response's timestamp and duration, never from invented model messages.
export function processTimeline(run: Run): ProcessEvent[] {
  if (run.events?.length) {
    if (run.status === 'running' || run.events.at(-1)!.status === run.status) return run.events;
    return [
      ...run.events,
      {
        at: run.completedAt || run.updatedAt,
        version: run.version + 1,
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
              usage: run.cores[persona].usage,
              error: run.cores[persona].error,
              threadId: run.cores[persona].threadId,
            },
          ]),
        ) as ProcessEvent['cores'],
      },
    ];
  }
  const output: ProcessEvent[] = [];
  let states = Object.fromEntries(PERSONAS.map((persona) => [persona, 'STANDBY'])) as Record<
    Persona,
    CoreState
  >;
  const append = (
    at: string,
    phase: Phase,
    round: number,
    recordCount: number,
    status: Run['status'],
  ) =>
    output.push({
      at,
      phase,
      round,
      recordCount,
      status,
      version: output.length + 1,
      cores: Object.fromEntries(
        PERSONAS.map((persona) => [
          persona,
          { state: states[persona], usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 } },
        ]),
      ) as ProcessEvent['cores'],
    });
  append(run.createdAt, 'independent', 0, 0, 'running');
  let previousGroup = '';
  run.records.forEach((record, index) => {
    const group = `${record.phase}:${record.round}`;
    if (group !== previousGroup) {
      const groupRecords = run.records.filter(
        (r) => r.phase === record.phase && r.round === record.round,
      );
      const measuredStart = Math.min(...groupRecords.map((r) => Date.parse(r.at) - r.durationMs));
      const start = Math.max(Date.parse(output.at(-1)!.at), measuredStart);
      const state =
        record.phase === 'independent'
          ? 'ANALYZING'
          : record.phase === 'final-vote'
            ? 'VOTING'
            : 'DELIBERATING';
      states = Object.fromEntries(PERSONAS.map((persona) => [persona, state])) as Record<
        Persona,
        CoreState
      >;
      append(new Date(start).toISOString(), record.phase, record.round, index, 'running');
      previousGroup = group;
    }
    if (record.phase === 'final-vote')
      states[record.persona] =
        record.assessment.vote === 'APPROVE'
          ? 'APPROVED'
          : record.assessment.vote === 'DENY'
            ? 'DENIED'
            : 'ABSTAIN';
    append(record.at, record.phase, record.round, index + 1, 'running');
  });
  if (run.status !== 'running') {
    states = Object.fromEntries(
      PERSONAS.map((persona) => [persona, run.cores[persona].state]),
    ) as Record<Persona, CoreState>;
    append(run.completedAt || run.updatedAt, run.phase, run.round, run.records.length, run.status);
    // Legacy records have no per-response usage. Only restore totals at the terminal frame.
    const terminal = output.at(-1)!;
    terminal.error = run.error;
    terminal.answer = run.answer ? structuredClone(run.answer) : undefined;
    for (const persona of PERSONAS)
      terminal.cores[persona] = {
        state: run.cores[persona].state,
        usage: { ...run.cores[persona].usage },
        error: run.cores[persona].error,
        threadId: run.cores[persona].threadId,
      };
  }
  return output;
}

export function frameAt(run: Run, event: ProcessEvent): Run {
  const records = run.records.slice(0, event.recordCount);
  return {
    ...run,
    status: event.status,
    phase: event.phase,
    round: event.round,
    records,
    updatedAt: event.at,
    completedAt: event.status === 'running' ? undefined : event.at,
    verdict: event.phase === 'report' || event.status === 'completed' ? run.verdict : undefined,
    answer: event.answer ? structuredClone(event.answer) : undefined,
    error: event.error ?? (event.status === 'error' ? run.error : undefined),
    cores: Object.fromEntries(
      PERSONAS.map((persona) => {
        const own = records.filter((record) => record.persona === persona);
        return [
          persona,
          {
            ...event.cores[persona],
            usage: { ...event.cores[persona].usage },
            error:
              event.cores[persona].error ??
              (event.cores[persona].state === 'ERROR' ? run.cores[persona].error : undefined),
            threadId:
              event.cores[persona].threadId ??
              (own.length ? run.cores[persona].threadId : undefined),
            latest: own.at(-1)?.assessment,
            finalVote: own.findLast((record) => record.phase === 'final-vote')?.assessment.vote,
          },
        ];
      }),
    ) as Run['cores'],
  };
}

// When an older decision is given an answer later, skip the intervening idle time.
// Active stage durations and the recorded event order remain unchanged.
export function playbackTimeline(run: Run) {
  const events = processTimeline(run);
  let offset = 0;
  return events.map((event, index) => {
    const previous = events[index - 1];
    const idle =
      previous &&
      previous.status !== 'running' &&
      event.status === 'running' &&
      event.phase === 'report';
    if (!idle)
      offset += Math.max(0, Date.parse(event.at) - Date.parse(previous?.at || run.createdAt));
    return { event, offset };
  });
}
