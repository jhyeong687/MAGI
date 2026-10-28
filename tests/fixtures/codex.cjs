#!/usr/bin/env node
// Test-only subprocess: never imported by the application.
let prompt = '';
process.stdin.on('data', (chunk) => (prompt += chunk));
process.stdin.on('end', () => {
  if (prompt.includes('HANG')) {
    setTimeout(() => {}, 30000);
    return;
  }
  if (prompt.includes('MALFORMED')) {
    console.log('not JSONL');
    return;
  }
  if (prompt.includes('RATE_LIMIT')) {
    console.log(JSON.stringify({ type: 'turn.failed', error: { message: 'Rate limit reached' } }));
    return;
  }
  const message = prompt.includes('SYNTHESIS')
    ? {
        answer: '공개 종합 답변입니다.',
        keyReasons: ['공통 근거'],
        conditions: ['실행 전 확인'],
        disagreements: [],
      }
    : {
        vote: prompt.includes('INVALID') ? 'MAYBE' : 'APPROVE',
        summary: '한국어 응답이 손상되지 않아야 합니다.',
        rationale: ['공개 근거'],
        risks: [],
        responseToOthers: '',
        confidence: 75,
      };
  const output = Buffer.from(
    [
      { type: 'thread.started', thread_id: '11111111-1111-1111-1111-111111111111' },
      { type: 'item.completed', item: { type: 'reasoning', text: 'SECRET_INTERNAL' } },
      { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(message) } },
      {
        type: 'turn.completed',
        usage: { input_tokens: 10, output_tokens: 20, cached_input_tokens: 3 },
      },
    ]
      .map((e) => JSON.stringify(e))
      .join('\n') + '\n',
  );
  const cut = output.indexOf(Buffer.from('한국어')) + 1;
  process.stdout.write(output.subarray(0, cut));
  setTimeout(() => process.stdout.write(output.subarray(cut)), 10);
});
