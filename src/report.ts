import { PERSONAS, personaInfo, type Run, type Locale } from '../shared/domain.ts';
import type { Copy } from './i18n.ts';
import { experienceCopies } from './experienceCopy.ts';
import { answerBrief } from './answerBrief.ts';

// Export only the selected public record, including the fixed vote and its conditions.
export function reportText(run: Run, t: Copy, locale: Locale = run.settings.locale) {
  const answer = run.answer?.content || run.answer?.previousContent;
  const brief = answer ? answerBrief(answer, run.settings.locale) : undefined;
  const ux = experienceCopies[locale];
  const section = (title: string, points: string[]) =>
    points.length ? `\n\n## ${title}\n${points.map((point) => `- ${point}`).join('\n')}` : '';
  return [
    '# MAGI / FINAL REPORT',
    run.question,
    `${t.report}: ${run.verdict?.result ?? run.status.toUpperCase()} · ${run.verdict?.ratio ?? 0} / 3`,
    `${t.approve}: ${run.verdict?.approve ?? 0} / ${t.deny}: ${run.verdict?.deny ?? 0} / ${t.abstain}: ${run.verdict?.abstain ?? 0}`,
    brief
      ? `## ${ux.conclusion}\n${brief.conclusion}${section(ux.nextSteps, brief.nextSteps)}${section(ux.objection, brief.keyObjection ? [brief.keyObjection] : [])}`
      : '',
    answer
      ? `## ${t.finalAnswer}\n${answer.answer}${section(t.answerReasons, answer.keyReasons)}${section(t.answerConditions, answer.conditions)}${section(t.answerDisagreements, answer.disagreements)}`
      : t.answerMissing,
    `## ${t.answerSources}\n${PERSONAS.flatMap((persona) => {
      const final = run.records.findLast(
        (record) => record.persona === persona && record.phase === 'final-vote',
      );
      return final
        ? [
            `### ${personaInfo[persona].name} · ${final.assessment.vote}\n${final.assessment.summary}`,
          ]
        : [];
    }).join('\n\n')}`,
    `RECORD: ${run.id}\n${run.completedAt || run.updatedAt}`,
  ].join('\n\n');
}
