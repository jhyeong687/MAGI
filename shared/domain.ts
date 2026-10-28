import { z } from 'zod';

import { PERSONAS, defaultPrompts, type Persona, type Locale } from './personas.ts';
export {
  PERSONAS,
  personaInfo,
  defaultPrompts,
  personaProfiles,
  PERSONA_REVISION,
} from './personas.ts';
export type { Persona, Locale } from './personas.ts';

export const settingsSchema = z.object({
  discussionRounds: z.number().int().min(1).max(3),
  timeoutSeconds: z.number().int().min(15).max(300),
  locale: z.enum(['en', 'ko', 'ja', 'zh']),
  animations: z.boolean(),
  sound: z.boolean().default(false),
  prompts: z.object({
    melchior: z.string().trim().min(20).max(6000),
    balthasar: z.string().trim().min(20).max(6000),
    casper: z.string().trim().min(20).max(6000),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  discussionRounds: 1,
  timeoutSeconds: 120,
  locale: 'en',
  animations: true,
  sound: false,
  prompts: defaultPrompts,
};

export const assessmentSchema = z
  .object({
    vote: z.enum(['APPROVE', 'DENY', 'ABSTAIN']),
    summary: z.string().trim().min(1).max(600),
    rationale: z.array(z.string().trim().min(1).max(800)).min(1).max(5),
    risks: z.array(z.string().trim().min(1).max(800)).max(5),
    responseToOthers: z.string().max(1600),
    confidence: z.number().int().min(0).max(100),
  })
  .strict();
export type Assessment = z.infer<typeof assessmentSchema>;
export type Vote = Assessment['vote'];
export const finalAnswerSchema = z
  .object({
    answer: z.string().trim().min(1).max(4000),
    keyReasons: z.array(z.string().trim().min(1).max(800)).min(1).max(5),
    conditions: z.array(z.string().trim().min(1).max(800)).max(5),
    disagreements: z.array(z.string().trim().min(1).max(800)).max(5),
  })
  .strict();
export type FinalAnswer = z.infer<typeof finalAnswerSchema>;
export const ANSWER_REVISION = 'command-voice-v1';
export interface AnswerGeneration {
  status: 'generating' | 'completed' | 'error' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  content?: FinalAnswer;
  previousContent?: FinalAnswer;
  revision?: string;
  error?: string;
  threadId?: string;
  usage: Usage;
  durationMs?: number;
}
export const personaCallCount = (rounds: number) => 6 + rounds * 6;
export const modelCallCount = (rounds: number) => personaCallCount(rounds) + 1;
export type Phase =
  'independent' | 'cross-examination' | 'reconsideration' | 'final-vote' | 'report';
export type CoreState =
  'STANDBY' | 'ANALYZING' | 'DELIBERATING' | 'VOTING' | 'APPROVED' | 'DENIED' | 'ABSTAIN' | 'ERROR';
export type RunStatus = 'running' | 'completed' | 'cancelled' | 'error';
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}
export interface RecordEntry {
  persona: Persona;
  phase: Phase;
  round: number;
  assessment: Assessment;
  at: string;
  durationMs: number;
}
export interface Core {
  state: CoreState;
  threadId?: string;
  error?: string;
  latest?: Assessment;
  finalVote?: Vote;
  usage: Usage;
}
export interface Verdict {
  result: 'APPROVED' | 'DENIED' | 'INCONCLUSIVE';
  approve: number;
  deny: number;
  abstain: number;
  ratio: number;
  total: 3;
}
export interface ProcessEvent {
  at: string;
  version: number;
  phase: Phase;
  round: number;
  status: RunStatus;
  recordCount: number;
  error?: string;
  answer?: AnswerGeneration;
  cores: Record<Persona, { state: CoreState; usage: Usage; error?: string; threadId?: string }>;
}
export interface CatalogSnapshot {
  runs: RunSummary[];
  settings: Settings;
  current?: Run;
}
export interface Run {
  id: string;
  personaRevision?: string;
  question: string;
  status: RunStatus;
  phase: Phase;
  round: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  settings: Settings;
  cores: Record<Persona, Core>;
  records: RecordEntry[];
  verdict?: Verdict;
  answer?: AnswerGeneration;
  error?: string;
  events?: ProcessEvent[];
}
export interface RunSummary {
  id: string;
  question: string;
  status: RunStatus;
  createdAt: string;
  result?: Verdict['result'];
  ratio?: number;
  version: number;
}
export interface Environment {
  ready: boolean;
  version?: string;
  binary?: string;
  auth: 'chatgpt' | 'api-key' | 'missing' | 'unknown';
  checkedAt: string;
  issues: string[];
  capabilities: string[];
  usageNotice: string;
}
export interface LoginState {
  status: 'idle' | 'pending' | 'completed' | 'error';
  error?: string;
}
export function decide(votes: Vote[]): Verdict {
  if (votes.length !== 3) throw new Error('All three final votes are required.');
  const approve = votes.filter((v) => v === 'APPROVE').length;
  const deny = votes.filter((v) => v === 'DENY').length;
  const abstain = votes.filter((v) => v === 'ABSTAIN').length;
  if (approve + deny + abstain !== 3) throw new Error('Invalid vote.');
  const result = approve >= 2 ? 'APPROVED' : deny >= 2 ? 'DENIED' : 'INCONCLUSIVE';
  return { result, approve, deny, abstain, ratio: result === 'DENIED' ? deny : approve, total: 3 };
}
export function summarize(run: Run): RunSummary {
  return {
    id: run.id,
    question: run.question,
    status: run.status,
    createdAt: run.createdAt,
    result: run.verdict?.result,
    ratio: run.verdict?.ratio,
    version: run.version,
  };
}
