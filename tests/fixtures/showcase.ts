// Documentation-only examples. Never imported by the production server.
import { ANSWER_REVISION, PERSONAS, type Persona } from '../../shared/domain.ts';
import { createScenario } from './scenarios.ts';
export const showcaseId = '30000000-0000-4000-8000-000000000001';
export function createShowcase() {
  const run = createScenario('approved');
  run.id = showcaseId;
  run.question =
    '[화면 예시] 동아리 신입 모집에서 한 학기 동안 면접을 없애고 희망자 전원을 받아도 될까?';
  const opinions: Record<
    Persona,
    { summary: string; rationale: string[]; risks: string[]; response: string }
  > = {
    melchior: {
      summary:
        '한 학기 실험을 조건부로 승인한다. 모집 인원보다 실제 활동 참여율과 운영 부담으로 효과를 검증해야 한다.',
      rationale: [
        '면접이 참여 장벽인지 검증할 가치가 있다.',
        '공간·활동 정원·담당 인력을 먼저 확인하고 비교 기준을 정하라.',
      ],
      risks: ['모집 증가가 실제 참여 증가를 보장하지 않는다.'],
      response:
        'BALTHASAR의 부담 지적은 타당하다. 담당 인력과 수용 정원이 확인되지 않았다면 실험 조건도 성립하지 않는다.',
    },
    balthasar: {
      summary:
        '현재 제안에는 반대한다. 신입을 누가 안내하고 기존 회원의 부담을 누가 대신할지 정해지지 않았다.',
      rationale: [
        '입회 기회를 여는 것과 실제로 함께 활동할 수 있게 돌보는 것은 다르다.',
        '지원 책임을 자원한 담당자와 대체 인력에게 명시적으로 배분해야 한다.',
      ],
      risks: ['안내 업무가 소수 회원의 희생으로 집중될 수 있다.'],
      response:
        'CASPER가 말한 참여의 자유는 존중한다. 다만 업무를 거절할 수 없는 기존 회원이 생기면 그 자유는 한쪽에만 주어진다.',
    },
    casper: {
      summary:
        '나는 참여할 기회를 먼저 여는 쪽을 택하겠다. 들어올 자유만큼 남거나 떠나고 추가 역할을 거절할 자유도 보장해야 한다.',
      rationale: [
        '면접에서 드러나지 않는 관심과 애착은 실제 활동에서 자랄 수 있다.',
        '회원 수를 늘리겠다는 목표가 개인의 선택을 압박해서는 안 된다.',
      ],
      risks: ['제도를 되돌려도 소진이나 소외의 경험까지 사라지지는 않는다.'],
      response:
        'MELCHIOR의 비교 실험에는 동의한다. 다만 참여율이라는 수치가 떠나려는 사람을 붙잡는 명분이 되어서는 안 된다.',
    },
  };
  for (const record of run.records) {
    const opinion = opinions[record.persona];
    record.assessment = {
      ...record.assessment,
      summary: opinion.summary,
      rationale: opinion.rationale,
      risks: opinion.risks,
      responseToOthers: record.phase === 'independent' ? '' : opinion.response,
    };
  }
  for (const persona of PERSONAS)
    run.cores[persona].latest = run.records.findLast(
      (record) => record.persona === persona,
    )!.assessment;
  run.answer!.revision = ANSWER_REVISION;
  run.answer!.content = {
    answer:
      '한 학기 시범 운영을 조건부로 승인한다. 표결은 찬성 2표, 반대 1표다. 모집 전에 공간과 활동 정원, 자발적인 안내 담당자 및 대체 인력을 확보하라. 이 조건을 충족하지 못하면 전원 수용을 시행하지 말라.',
    keyReasons: [
      'MELCHIOR-1은 참여 장벽을 낮추는 실험의 가치를 인정한다.',
      'CASPER-3는 실제 활동을 경험한 뒤 각자가 참여를 선택할 기회를 중시한다.',
    ],
    conditions: [
      '모집 전 활동별 수용 정원과 담당자의 가능한 시간을 확인하라.',
      '신입의 자유로운 이탈과 기존 회원의 추가 업무 거절을 보장하라.',
      '학기 말 참여율·이탈 이유·운영 부담을 평가하라.',
    ],
    disagreements: [
      'BALTHASAR-2는 지원 책임과 대체 인력이 불분명하다는 이유로 반대했다. 다수결 결과가 이 우려를 해소한 것은 아니다.',
    ],
  };
  // Stretch the illustrative timeline to make every UI phase readable in a gallery.
  const base = Date.parse(run.createdAt);
  const stretch = (at: string) => new Date(base + (Date.parse(at) - base) * 25).toISOString();
  for (const record of run.records) {
    record.at = stretch(record.at);
    record.durationMs *= 25;
  }
  for (const event of run.events!) {
    event.at = stretch(event.at);
    if (event.answer) event.answer = structuredClone(run.answer);
  }
  run.answer!.startedAt = stretch(run.answer!.startedAt);
  run.answer!.completedAt = stretch(run.answer!.completedAt!);
  run.updatedAt = stretch(run.updatedAt);
  run.completedAt = stretch(run.completedAt!);
  return run;
}
