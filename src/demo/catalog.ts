import {
  defaultSettings,
  PERSONAS,
  ANSWER_REVISION,
  decide,
  type Locale,
  type Run,
  type Phase,
  type Vote,
} from '../../shared/domain.ts';

export const exampleIds = ['club', 'feature', 'meeting'] as const;
export type ExampleId = (typeof exampleIds)[number];
type ExampleText = {
  title: string;
  question: string;
  opinions: [string, string, string];
  replies: [string, string, string];
  answer: string;
  conditions: string[];
  dissent: string;
};
const texts: Record<Locale, Record<ExampleId, ExampleText>> = {
  ja: {
    club: {
      title: '入会面接をなくすべきか',
      question: '一学期だけ、サークルの入会面接をなくして希望者全員を受け入れるべきか。',
      opinions: [
        '条件付きで賛成する。参加の障壁が下がるか、実際の参加率と運営負担で検証せよ。',
        '現状では反対する。新入生を支える担当と代替要員が決まっていない。',
        '私は参加の機会を開く。入る自由と同時に、去る自由や追加の役割を断る自由も守れ。',
      ],
      replies: [
        'BALTHASARの懸念は妥当だ。人員が確保できなければ試行の条件は成立しない。',
        'CASPERの自由を認める。ただし既存会員が追加作業を断れなければ、一方だけの自由になる。',
        'MELCHIORの検証には同意する。参加率を理由に退会を妨げてはならない。',
      ],
      answer:
        '一学期の試行を条件付きで承認する。活動場所、定員、担当者と代替要員を確保してから実施せよ。賛成二票でも、支援責任に対する反対意見は解消されていない。',
      conditions: [
        '募集前に活動場所と支援担当者を確保せよ。',
        '退会と追加業務を断る自由を守れ。',
        '学期末に参加実態と負担を評価せよ。',
      ],
      dissent: 'BALTHASAR-2は、支援責任が未確定であることを理由に反対した。',
    },
    feature: {
      title: '締切前に機能を追加すべきか',
      question: 'デモまで二日。動いているアプリに、未検証で六時間かかる新機能を追加すべきか。',
      opinions: [
        '反対する。未検証の変更は、安定しているデモを壊す危険が大きい。',
        '反対する。協力者の睡眠や既存の約束まで、追加機能の費用に含めよ。',
        '私は試してみたい。ただし本体から切り離し、いつでも捨てられる試作に限る。',
      ],
      replies: [
        'CASPERの試作案は分離できる場合のみ成立する。現提案の安定性は未確認だ。',
        'MELCHIORの技術上の危険に加え、誰が徹夜の負担を負うかを見落としてはならない。',
        'BALTHASARの指摘は受け入れる。協力を義務に変えるなら、この選択はしない。',
      ],
      answer:
        '今回のデモへの追加は否決する。動作している版を保持し、試作は締切後か、完全に分離した環境で行え。好奇心を認めることは、他者の休息を使う許可にはならない。',
      conditions: ['安定版を固定せよ。', '試作のために他者の休息を削るな。'],
      dissent: 'CASPER-3は、捨てられる独立試作に限って賛成した。',
    },
    meeting: {
      title: '少ない情報で曜日を変えるべきか',
      question: '二人から金曜がよいと言われた。全員の予定を調べず、定例会を金曜に変更すべきか。',
      opinions: [
        '棄権する。二人の意見だけでは、全体への効果を判定できない。',
        '反対する。今の曜日を頼りに参加している人への影響が不明だ。',
        '私は任意参加の金曜回を試したい。全員の義務にしないことが条件だ。',
      ],
      replies: [
        'CASPERの任意試行は追加情報を得られるが、全体の変更を承認する根拠にはまだならない。',
        'MELCHIORの情報不足という判断に同意する。参加できなくなる人の声も集めよ。',
        'BALTHASARの懸念を認める。既存の会を残して、選べる回を増やす形を望む。',
      ],
      answer:
        '全体の曜日変更は保留する。賛成・反対・棄権が一票ずつで、決定に必要な二票がない。全員の都合を確認し、既存の会を守った任意試行を検討せよ。',
      conditions: ['全員の参加可能日を確認せよ。', '任意試行と全体変更を分けて判断せよ。'],
      dissent: '三人格は、情報の不足、参加者への責任、選べる機会を異なる重さで評価した。',
    },
  },
  en: {
    club: {
      title: 'Open club membership',
      question: 'Should our club accept all applicants without interviews for one semester?',
      opinions: [
        'Approve with conditions. Test actual participation and workload, not sign-ups alone.',
        'Reject the current proposal. Guides and backup staff have not been assigned.',
        'I choose to open the opportunity. Protect the freedom to leave and refuse extra duties too.',
      ],
      replies: [
        'BALTHASAR identifies a valid condition. Without staffing, the trial is not ready.',
        'CASPER defends choice, but existing members must be free to refuse extra work as well.',
        'MELCHIOR can measure participation. Those metrics must never become pressure to stay.',
      ],
      answer:
        'Approve a one-semester trial with conditions. Confirm capacity, willing guides and backups before recruitment. Two approvals do not resolve the objection about who carries the support burden.',
      conditions: [
        'Confirm space and willing support staff.',
        'Protect the freedom to leave or refuse extra work.',
        'Review actual participation and workload at semester end.',
      ],
      dissent: 'BALTHASAR-2 rejected the proposal because support responsibilities remain unclear.',
    },
    feature: {
      title: 'Add a feature before the deadline',
      question:
        'The demo is in two days. Should we add an untested feature that takes six hours to an app that already works?',
      opinions: [
        'Reject. An untested change puts the stable demo at risk.',
        'Reject. Count a teammate’s sleep and existing commitments in the cost.',
        'I want to try it, but only as a disposable prototype separated from the working app.',
      ],
      replies: [
        'CASPER’s prototype works as an alternative only if it is truly isolated.',
        'MELCHIOR identifies technical risk. We must also ask who absorbs the late-night work.',
        'I accept BALTHASAR’s objection. If helping becomes an obligation, I withdraw that condition.',
      ],
      answer:
        'Reject adding this feature to the upcoming demo. Preserve the working version. Explore it after the deadline or in an isolated prototype that does not consume someone else’s rest.',
      conditions: [
        'Freeze the stable demo.',
        'Do not turn a volunteer’s rest into a project resource.',
      ],
      dissent: 'CASPER-3 supported only a separate, disposable experiment.',
    },
    meeting: {
      title: 'Change a meeting with little evidence',
      question:
        'Two members prefer Friday. Should we move the whole weekly meeting without checking everyone’s schedule?',
      opinions: [
        'Abstain. Two messages cannot establish the effect on the whole group.',
        'Reject. We have not heard from people who depend on the current schedule.',
        'I support trying an optional Friday session, without making it everyone’s obligation.',
      ],
      replies: [
        'CASPER’s trial can gather evidence, but it does not yet justify moving the entire meeting.',
        'I agree with MELCHIOR about missing information. Ask those who could lose access.',
        'BALTHASAR’s concern matters. Keep the existing meeting and offer another choice.',
      ],
      answer:
        'Hold the group-wide schedule change. One approval, one denial and one abstention do not form a majority. Ask everyone’s availability and assess an optional trial separately.',
      conditions: [
        'Collect availability from the whole group.',
        'Separate an optional trial from a mandatory move.',
      ],
      dissent: 'The personas weigh evidence, responsibility and individual choice differently.',
    },
  },
  ko: {
    club: {
      title: '동아리 면접을 없앨까',
      question: '한 학기 동안 동아리 면접을 없애고 희망자 전원을 받아야 할까?',
      opinions: [
        '조건부로 찬성한다. 가입자 수보다 실제 참여와 운영 부담을 검증하라.',
        '현 제안에 반대한다. 신입을 안내할 담당자와 대체 인력이 정해지지 않았다.',
        '나는 참여의 기회를 연다. 떠날 자유와 추가 역할을 거절할 자유도 함께 지켜라.',
      ],
      replies: [
        'BALTHASAR의 우려는 유효하다. 인력이 없으면 실험의 조건도 성립하지 않는다.',
        'CASPER의 자유는 인정한다. 기존 회원도 추가 업무를 거절할 수 있어야 한다.',
        'MELCHIOR의 측정에 동의한다. 참여율을 이유로 떠나는 사람을 압박해서는 안 된다.',
      ],
      answer:
        '한 학기 시도를 조건부 승인한다. 공간과 수용 인원, 자발적인 안내 담당자와 대체 인력을 먼저 확보하라. 찬성 두 표가 돌봄 부담에 대한 반대를 해소하지는 않는다.',
      conditions: [
        '모집 전에 공간과 안내 담당자를 확보하라.',
        '탈퇴와 추가 업무 거절의 자유를 지켜라.',
        '학기 말 실제 참여와 운영 부담을 평가하라.',
      ],
      dissent: 'BALTHASAR-2는 안내 책임이 정해지지 않았다는 이유로 반대했다.',
    },
    feature: {
      title: '마감 전에 새 기능을 넣을까',
      question:
        '시연까지 이틀이다. 이미 작동하는 앱에 검증되지 않은 6시간짜리 새 기능을 추가해야 할까?',
      opinions: [
        '반대한다. 검증되지 않은 변경은 안정된 시연을 망칠 위험이 크다.',
        '반대한다. 동료의 수면과 이미 한 약속도 비용에 포함하라.',
        '나는 시도하고 싶다. 다만 기존 앱과 분리되어 언제든 버릴 수 있는 시제품이어야 한다.',
      ],
      replies: [
        'CASPER의 시제품은 실제로 분리될 때만 대안이 된다.',
        'MELCHIOR의 기술적 위험에 더해, 누가 밤샘 부담을 떠안을지도 따져야 한다.',
        'BALTHASAR의 지적을 받아들인다. 협조가 의무로 바뀐다면 이 선택을 하지 않는다.',
      ],
      answer:
        '이번 시연에 기능을 추가하는 안은 거부한다. 작동하는 버전을 유지하라. 탐색은 마감 뒤에 하거나 타인의 휴식을 쓰지 않는 별도 환경에서 수행하라.',
      conditions: [
        '안정된 시연 버전을 고정하라.',
        '자발적인 도움을 휴식을 빼앗는 의무로 만들지 마라.',
      ],
      dissent: 'CASPER-3는 버릴 수 있는 독립 실험에 한해 찬성했다.',
    },
    meeting: {
      title: '정보 없이 모임 날짜를 바꿀까',
      question:
        '두 명이 금요일을 선호한다. 전원의 일정을 확인하지 않고 정기 모임을 금요일로 옮겨야 할까?',
      opinions: [
        '기권한다. 두 사람의 의견으로 전체 영향을 판정할 수 없다.',
        '반대한다. 현재 일정에 의존하는 회원의 의견이 빠져 있다.',
        '나는 자율적인 금요일 모임을 시도하고 싶다. 전원의 의무로 만들지 않는 것이 조건이다.',
      ],
      replies: [
        'CASPER의 실험은 정보를 늘릴 수 있지만 전체 일정 변경의 근거는 아직 아니다.',
        'MELCHIOR의 정보 부족 판단에 동의한다. 참여 기회를 잃는 사람에게도 물어라.',
        'BALTHASAR의 우려를 인정한다. 기존 모임을 유지하며 선택지를 늘리는 방식이 좋다.',
      ],
      answer:
        '전체 일정 변경은 유보한다. 찬성·반대·기권이 한 표씩으로 과반이 없다. 전원의 가능 시간을 확인하고 자율 모임의 시험 운영을 별도로 검토하라.',
      conditions: ['전원의 참여 가능 시간을 확인하라.', '자율 실험과 전체 변경을 구분해 판단하라.'],
      dissent: '세 인격은 근거의 부족, 참여자에 대한 책임, 개인의 선택에 다른 비중을 뒀다.',
    },
  },
  zh: {
    club: {
      title: '取消社团入会面试',
      question: '是否应在一个学期内取消社团面试，接纳所有申请者？',
      opinions: [
        '有条件赞成。应检验实际参与和工作负担，而非仅看报名人数。',
        '反对当前提案。尚未指定引导新人及替补的人员。',
        '我选择开放机会。同时保障退出和拒绝额外职责的自由。',
      ],
      replies: [
        'BALTHASAR指出了有效条件。人员不足时，试行尚不具备基础。',
        '认可CASPER强调的选择，但现有成员也必须能够拒绝额外工作。',
        '同意MELCHIOR的评估，但不能以参与率为由阻止成员退出。',
      ],
      answer:
        '有条件批准一个学期的试行。招募前确认场地、容量、自愿的引导人员及替补。两票赞成并不能消除支援责任不明的异议。',
      conditions: [
        '招募前确认场地和自愿的支援人员。',
        '保障退出或拒绝额外工作的自由。',
        '学期末评估实际参与和工作负担。',
      ],
      dissent: 'BALTHASAR-2因支援责任尚不明确而反对。',
    },
    feature: {
      title: '截止前增加新功能',
      question: '距离演示仅有两天，是否应为已正常工作的应用增加一个尚未测试、需六小时的新功能？',
      opinions: [
        '反对。未经验证的修改会危及稳定的演示。',
        '反对。应将同伴的睡眠和已有承诺计入成本。',
        '我想尝试，但仅限与现有应用隔离、可随时放弃的原型。',
      ],
      replies: [
        'CASPER的原型只有真正隔离时才是可行替代方案。',
        '除了MELCHIOR指出的技术风险，还必须确认谁承担熬夜的代价。',
        '接受BALTHASAR的异议。若协助变成义务，我不作此选择。',
      ],
      answer:
        '否决在本次演示中加入该功能。保留可用版本。探索应留在截止之后，或在不占用他人休息的隔离环境中进行。',
      conditions: ['冻结稳定的演示版本。', '不要把自愿协助变成牺牲休息的义务。'],
      dissent: 'CASPER-3只支持独立、可放弃的试验。',
    },
    meeting: {
      title: '依据少量信息更改例会',
      question: '两名成员更喜欢周五。是否应在未确认所有人时间的情况下，把整个例会改到周五？',
      opinions: [
        '弃权。两条意见不足以判断对整个群体的影响。',
        '反对。尚未听取依赖当前时间安排者的意见。',
        '我支持尝试自愿参加的周五场次，但不能强迫所有人。',
      ],
      replies: [
        'CASPER的试行能收集证据，但尚不足以支持整体改期。',
        '同意MELCHIOR的信息不足判断。应询问可能失去参与机会者。',
        '认可BALTHASAR的担忧。保留现有例会，再提供另一种选择。',
      ],
      answer:
        '暂缓整体改期。一票赞成、一票反对、一票弃权未形成多数。先确认所有人的时间，并单独评估自愿参加的试行。',
      conditions: ['收集整个群体的可参与时间。', '区分自愿试行与强制改期。'],
      dissent: '三个人格对证据、责任和个人选择赋予了不同权重。',
    },
  },
};
const votes: Record<ExampleId, Vote[]> = {
  club: ['APPROVE', 'DENY', 'APPROVE'],
  feature: ['DENY', 'DENY', 'APPROVE'],
  meeting: ['ABSTAIN', 'DENY', 'APPROVE'],
};
export function exampleTitle(id: ExampleId, locale: Locale) {
  return texts[locale][id].title;
}
export function createExample(id: ExampleId, locale: Locale): Run {
  const text = texts[locale][id],
    base = Date.parse('2026-10-28T00:00:00Z');
  const at = (offset: number) => new Date(base + offset).toISOString();
  const zero = () => ({ inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
  const run: Run = {
    id: `demo-${id}-${locale}`,
    question: text.question,
    status: 'running',
    phase: 'independent',
    round: 0,
    version: 0,
    createdAt: at(0),
    updatedAt: at(0),
    settings: { ...structuredClone(defaultSettings), locale },
    cores: Object.fromEntries(
      PERSONAS.map((p) => [p, { state: 'STANDBY', usage: zero() }]),
    ) as Run['cores'],
    records: [],
    events: [],
  };
  const event = (offset: number) => {
    run.updatedAt = at(offset);
    run.version++;
    run.events!.push({
      at: run.updatedAt,
      version: run.version,
      phase: run.phase,
      round: run.round,
      status: run.status,
      recordCount: run.records.length,
      answer: run.answer ? structuredClone(run.answer) : undefined,
      cores: Object.fromEntries(
        PERSONAS.map((p) => [p, { state: run.cores[p].state, usage: zero() }]),
      ) as NonNullable<Run['events']>[number]['cores'],
    });
  };
  const phases: Phase[] = ['independent', 'cross-examination', 'reconsideration', 'final-vote'];
  phases.forEach((phase, stage) => {
    run.phase = phase;
    run.round = stage ? 1 : 0;
    for (const p of PERSONAS)
      run.cores[p].state = stage === 0 ? 'ANALYZING' : stage === 3 ? 'VOTING' : 'DELIBERATING';
    event(stage * 4000);
    PERSONAS.forEach((p, index) => {
      const assessment = {
        vote: votes[id][index],
        summary: text.opinions[index],
        rationale: [text.opinions[index]],
        risks: [],
        responseToOthers: stage ? text.replies[index] : '',
        confidence: 70,
      };
      run.records.push({
        persona: p,
        phase,
        round: run.round,
        assessment,
        at: at(stage * 4000 + 1200 + index * 600),
        durationMs: 1200 + index * 600,
      });
      run.cores[p].latest = assessment;
      if (stage === 3) {
        run.cores[p].finalVote = votes[id][index];
        run.cores[p].state =
          votes[id][index] === 'APPROVE'
            ? 'APPROVED'
            : votes[id][index] === 'DENY'
              ? 'DENIED'
              : 'ABSTAIN';
      }
      event(stage * 4000 + 1200 + index * 600);
    });
  });
  run.phase = 'report';
  run.verdict = decide(votes[id]);
  run.answer = {
    status: 'generating',
    startedAt: at(16000),
    usage: zero(),
    revision: ANSWER_REVISION,
  };
  event(16000);
  run.status = 'completed';
  run.completedAt = at(19500);
  run.answer = {
    ...run.answer,
    status: 'completed',
    completedAt: at(19500),
    content: {
      answer: text.answer,
      keyReasons: PERSONAS.map((p, i) => `${p.toUpperCase()}: ${text.opinions[i]}`),
      conditions: text.conditions,
      disagreements: [text.dissent],
    },
  };
  event(19500);
  return run;
}
