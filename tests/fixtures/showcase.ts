// Documentation-only examples. Never imported by the production server.
import { ANSWER_REVISION, PERSONAS, type Persona } from '../../shared/domain.ts';
import { createScenario } from './scenarios.ts';
export const showcaseId = '30000000-0000-4000-8000-000000000001';
export function createShowcase() {
  const run = createScenario('approved');
  run.id = showcaseId;
  run.settings.locale = 'en';
  run.question =
    '[INTERFACE EXAMPLE] Should our club accept all applicants without interviews for one semester?';
  const opinions: Record<
    Persona,
    { summary: string; rationale: string[]; risks: string[]; response: string }
  > = {
    melchior: {
      summary:
        'Approve a one-semester trial with conditions. Measure active participation and operational burden, not sign-ups alone.',
      rationale: [
        'Test whether interviews are a barrier to participation.',
        'Confirm capacity and staffing, then define the comparison criteria.',
      ],
      risks: ['More applicants do not guarantee more active members.'],
      response:
        'BALTHASAR identifies a valid burden. Without confirmed staffing and capacity, the trial conditions do not hold.',
    },
    balthasar: {
      summary:
        'Reject the current proposal. Responsibility for guiding newcomers and covering existing members has not been assigned.',
      rationale: [
        'Opening membership differs from supporting meaningful participation.',
        'Assign support to willing guides and backups explicitly.',
      ],
      risks: ['A few members may end up carrying the support burden.'],
      response:
        'I respect the freedom CASPER defends. If existing members cannot refuse extra work, that freedom belongs to only one side.',
    },
    casper: {
      summary:
        'I choose to open the opportunity. Protect the freedom to stay, leave and refuse additional duties as well as the freedom to join.',
      rationale: [
        'Interest and attachment can grow through participation rather than interviews.',
        'Membership targets must not pressure individual choices.',
      ],
      risks: ['Reversing the policy cannot erase exhaustion or exclusion.'],
      response:
        'I accept the comparison MELCHIOR proposes. Participation metrics must not become a reason to pressure someone into staying.',
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
      'Approve a one-semester trial with conditions. The vote is two approvals and one denial. Confirm space, activity capacity, willing guides and backup staff before recruitment. Do not accept everyone until these prerequisites are met.',
    keyReasons: [
      'MELCHIOR-1 recognizes the value of testing a lower participation barrier.',
      'CASPER-3 prioritizes the chance to choose participation after real experience.',
    ],
    conditions: [
      'Confirm activity capacity and available staff time before recruitment.',
      'Protect newcomers who leave and members who refuse extra work.',
      'Evaluate participation, reasons for leaving and the workload at semester end.',
    ],
    disagreements: [
      'BALTHASAR-2 rejected the proposal because support responsibilities and backups were unclear. A majority vote does not resolve that concern.',
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
