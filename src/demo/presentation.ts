import type { Locale, Run } from '../../shared/domain.ts';
import type { PublicExample, SharePresentation } from '../sharePresentation.ts';
import { cardExcerpt } from '../sharePresentation.ts';

// Faithful editorial titles/summaries of the public recording. The original English
// question, all assessments and the final report remain unchanged and inspectable.
const recording: Record<Locale, { title: string; summary: string; context: string }> = {
  en: {
    title: 'A demo in two days. Should we add one more feature?',
    summary:
      'Defer the feature until after the demo. Testing, recovery time and an agreement that protects both people’s rest are not established.',
    context:
      'The existing app works. The new feature needs about six hours, has no tests and can be disabled. A teammate offered to help, but also needs sleep.',
  },
  ja: {
    title: 'デモまであと二日。新機能を追加すべきか。',
    summary: '新機能はデモ終了後に回せ。検証・復旧の時間と、二人の休息を守る合意が整っていない。',
    context:
      '既存のアプリは動く。新機能は約六時間、未検証だが無効化できる。協力者もいるが、睡眠は必要だ。',
  },
  ko: {
    title: '시연까지 이틀. 새 기능을 하나 더 넣어도 될까?',
    summary:
      '새 기능은 시연 이후로 미뤄라. 검증·복구 시간과 두 사람의 휴식을 지킬 합의가 마련되지 않았다.',
    context:
      '기존 앱은 작동한다. 새 기능은 약 6시간이 걸리고 테스트는 없지만 끌 수 있다. 도와줄 동료도 잠은 자야 한다.',
  },
  zh: {
    title: '距离演示还有两天，要再加一个新功能吗？',
    summary: '将新功能推迟到演示之后。验证、恢复所需的时间，以及保护两人休息的安排尚未确定。',
    context:
      '现有应用可以正常演示。新功能约需六小时，尚未测试，但可以禁用。同伴愿意帮忙，也需要睡眠。',
  },
};
export function demoPresentation(
  run: Run,
  locale: Locale,
  example: PublicExample,
): SharePresentation {
  return example === 'recording'
    ? { ...recording[locale], example }
    : {
        title: run.question,
        summary: cardExcerpt(run.answer?.content?.answer || '', 240),
        example,
      };
}
export function recordingContext(locale: Locale) {
  return recording[locale].context;
}
