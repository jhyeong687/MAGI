// These are ceilings for this trial, never a promise of completed decisions.
export const TRIAL_POLICY = {
  model: '@cf/qwen/qwen3-30b-a3b-fp8',
  dailyRuns: 20,
  dailyRunsPerIp: 2,
  concurrentRuns: 2,
  questionCharacters: 800,
  questionBytes: 2400,
  promptBytes: 14000,
  assessmentTokens: 640,
  reportTokens: 1000,
  callTimeoutMs: 60000,
  runTimeoutMs: 240000,
  callsPerRun: 13,
} as const;
export type TrialCode =
  | 'unavailable'
  | 'daily_limit'
  | 'client_limit'
  | 'busy'
  | 'duplicate'
  | 'invalid_question'
  | 'provider_limit'
  | 'model_error'
  | 'timeout'
  | 'disconnected';
export class TrialError extends Error {
  constructor(
    readonly code: TrialCode,
    readonly httpStatus = 503,
  ) {
    super(code);
  }
}
export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}
export function nextReset(now = Date.now()) {
  return new Date(`${utcDay(now)}T00:00:00Z`).getTime() + 86400000;
}
export function validQuestion(question: unknown): question is string {
  return (
    typeof question === 'string' &&
    question.trim().length > 0 &&
    Array.from(question).length <= TRIAL_POLICY.questionCharacters &&
    new TextEncoder().encode(question).length <= TRIAL_POLICY.questionBytes
  );
}
export interface TrialStatus {
  available: boolean;
  code?: TrialCode;
  remainingStarts: number;
  remainingForIp: number;
  active: number;
  resetsAt: string;
  dailyLimit: number;
  perIpLimit: number;
  model: string;
}
export interface QuotaState {
  used: number;
  clients: Record<string, number>;
  attempts: string[];
  active: Record<string, number>;
  closed?: boolean;
}
export const emptyQuota = (): QuotaState => ({ used: 0, clients: {}, attempts: [], active: {} });
export function quotaStatus(state: QuotaState, client: string, now = Date.now()): TrialStatus {
  const active = Object.values(state.active).filter((expiry) => expiry > now).length;
  const remainingStarts = Math.max(0, TRIAL_POLICY.dailyRuns - state.used);
  const remainingForIp = Math.max(0, TRIAL_POLICY.dailyRunsPerIp - (state.clients[client] || 0));
  const code = state.closed
    ? 'provider_limit'
    : !remainingStarts
      ? 'daily_limit'
      : !remainingForIp
        ? 'client_limit'
        : active >= TRIAL_POLICY.concurrentRuns
          ? 'busy'
          : undefined;
  return {
    available: !code,
    code,
    remainingStarts,
    remainingForIp,
    active,
    resetsAt: new Date(nextReset(now)).toISOString(),
    dailyLimit: TRIAL_POLICY.dailyRuns,
    perIpLimit: TRIAL_POLICY.dailyRunsPerIp,
    model: TRIAL_POLICY.model,
  };
}
// Called inside a Durable Object input gate. The full run is reserved before any inference.
export function reserve(state: QuotaState, client: string, attempt: string, now = Date.now()) {
  if (state.attempts.includes(attempt)) throw new TrialError('duplicate', 409);
  const status = quotaStatus(state, client, now);
  if (!status.available) throw new TrialError(status.code!, status.code === 'busy' ? 503 : 429);
  state.used++;
  state.clients[client] = (state.clients[client] || 0) + 1;
  state.attempts.push(attempt);
  state.active[attempt] = now + TRIAL_POLICY.runTimeoutMs + TRIAL_POLICY.callTimeoutMs;
  // Failed / cancelled reservations are deliberately never refunded.
}
