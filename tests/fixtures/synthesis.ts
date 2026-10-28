// Test-only synthesis transport. Never loaded by the product server.
import type { AnswerRunner } from '../../server/synthesis.ts';
export const fixtureSynthesis: AnswerRunner = async (request) => {
  const evidence = JSON.parse(
    request.prompt.split('<council_evidence_json>\n')[1].split('\n</council_evidence_json>')[0],
  );
  request.onThread('30000000-0000-4000-8000-000000000001');
  const result = evidence.verdict.result;
  return {
    content: {
      answer: `테스트 전용 종합 답변: ${result}. 세 최종 의견을 검토한 결과에 맞춰 조건을 확인하세요.`,
      keyReasons: ['검증용 공통 근거'],
      conditions:
        result === 'INCONCLUSIVE'
          ? ['부족한 정보를 먼저 확보하세요.']
          : ['검증용 실행 조건을 먼저 확인하세요.'],
      disagreements:
        evidence.verdict.deny && evidence.verdict.approve
          ? ['BALTHASAR-2와 다른 인격의 판단이 다릅니다.']
          : [],
    },
    usage: { inputTokens: 20, outputTokens: 10, cachedTokens: 0 },
    durationMs: 5,
  };
};
