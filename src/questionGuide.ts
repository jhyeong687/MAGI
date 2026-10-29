import type { Locale } from '../shared/domain.ts';
import { experienceCopies } from './experienceCopy.ts';

export type QuestionDraft = { context: string; decision: string; criteria: string };
export type QuestionTopic = 'project' | 'career' | 'daily';
export const questionTopics: QuestionTopic[] = ['project', 'career', 'daily'];
export const emptyQuestionDraft = (): QuestionDraft => ({
  context: '',
  decision: '',
  criteria: '',
});
const templates: Record<Locale, Record<QuestionTopic, QuestionDraft>> = {
  en: {
    project: {
      context:
        'Our app works and the demo is in two days. A new feature would take about six hours.',
      decision: 'Should we add the feature before the demo?',
      criteria: 'Preserve time for testing, rehearsal and sleep. The feature can wait.',
    },
    career: {
      context: 'I have one semester left and can choose one additional commitment.',
      decision: 'Should I accept a part-time internship this semester?',
      criteria:
        'Protect graduation requirements and a manageable weekly workload. The internship should support my career goals.',
    },
    daily: {
      context:
        'Our group is considering changing its weekly meeting day, but only a few members have replied.',
      decision: 'Should we change the meeting day now?',
      criteria:
        'Preserve access for existing members and check the whole group’s availability first.',
    },
  },
  ja: {
    project: {
      context: 'アプリは動いている。デモまで二日で、新機能には約六時間かかる。',
      decision: 'デモ前に新機能を追加すべきか。',
      criteria: '検証・リハーサル・睡眠の時間を守る。機能追加は後日に回せる。',
    },
    career: {
      context: '卒業まで一学期。追加で引き受けられる活動は一つだけ。',
      decision: '今学期、パートタイムのインターンを引き受けるべきか。',
      criteria: '卒業要件と無理のない週間負担を守り、希望する進路につながる経験を選びたい。',
    },
    daily: {
      context: 'グループの定例会の曜日を変える案があるが、回答したメンバーは少ない。',
      decision: '今すぐ定例会の曜日を変えるべきか。',
      criteria: '既存メンバーの参加機会を守り、全員の予定を先に確認したい。',
    },
  },
  ko: {
    project: {
      context: '앱은 작동한다. 시연까지 이틀이고 새 기능에는 약 6시간이 걸린다.',
      decision: '시연 전에 새 기능을 추가하는 게 좋을까?',
      criteria: '검증·리허설·수면 시간을 지켜야 한다. 기능 추가는 시연 이후로 미룰 수 있다.',
    },
    career: {
      context: '졸업까지 한 학기가 남았고 활동을 하나만 더 맡을 수 있다.',
      decision: '이번 학기에 파트타임 인턴을 수락하는 게 좋을까?',
      criteria:
        '졸업 요건과 감당할 수 있는 주간 부담을 지키면서 희망 진로에 도움이 되는 경험을 얻고 싶다.',
    },
    daily: {
      context: '모임의 정기 회의 요일을 바꾸자는 의견이 나왔지만 답한 사람은 몇 명뿐이다.',
      decision: '지금 바로 정기 회의 요일을 바꾸는 게 좋을까?',
      criteria: '기존 구성원의 참여 기회를 지키고 전체 인원의 가능한 시간을 먼저 확인하고 싶다.',
    },
  },
  zh: {
    project: {
      context: '应用已能运行，距离演示还有两天，新功能约需六小时。',
      decision: '是否应在演示前添加新功能？',
      criteria: '保留验证、排练和睡眠时间。新功能可以推迟到演示后。',
    },
    career: {
      context: '距离毕业还有一个学期，只能再承担一项额外活动。',
      decision: '这学期是否应接受兼职实习？',
      criteria: '确保毕业要求与可承受的每周负担，并获得有助于职业目标的经验。',
    },
    daily: {
      context: '小组提议更改每周会议日，但只有少数成员回复。',
      decision: '是否应立即更改会议日？',
      criteria: '保留现有成员的参与机会，先确认全体成员可参加的时间。',
    },
  },
};
export function questionTemplate(locale: Locale, topic: QuestionTopic): QuestionDraft {
  return { ...templates[locale][topic] };
}
export function composeQuestion(draft: QuestionDraft, locale: Locale) {
  const t = experienceCopies[locale];
  return (['decision', 'context', 'criteria'] as const)
    .filter((key) => draft[key].trim())
    .map((key) => `${t[key]}: ${draft[key].trim()}`)
    .join('\n\n');
}
// Update only a block inserted by this helper. Preserve an operator's unrelated text.
export function mergeQuestion(current: string, block: string, previous = '') {
  if (!block || current.includes(block)) return current;
  if (previous && current.endsWith(previous)) return current.slice(0, -previous.length) + block;
  return current.trim() ? `${current}\n\n${block}` : block;
}
