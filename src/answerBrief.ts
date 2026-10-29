import type { FinalAnswer, Locale } from '../shared/domain.ts';

export function firstSentence(text: string, locale: Locale) {
  const clean = text.trim();
  return (
    [
      ...new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(clean),
    ][0]?.segment.trim() || clean
  );
}
// Historical answers are presented from saved text only. No generation or mutation.
export function answerBrief(content: FinalAnswer, locale: Locale) {
  return content.brief
    ? {
        ...content.brief,
        nextSteps: [...content.brief.nextSteps],
        keyObjection: content.brief.keyObjection || content.disagreements[0] || '',
        extracted: false,
      }
    : {
        conclusion: firstSentence(content.answer, locale),
        nextSteps: content.conditions.slice(0, 3),
        keyObjection: content.disagreements[0] || '',
        extracted: true,
      };
}
