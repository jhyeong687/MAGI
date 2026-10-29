import { TrialError } from './policy.ts';

// A temporary 429 (capacity) is not a daily-budget failure. Do not waste the rest
// of the free day by latching every 429 closed. No branch performs a retry.
export function providerFailure(error: unknown): TrialError {
  const value = error as {
    message?: string;
    code?: number | string;
    status?: number;
    statusCode?: number;
    name?: string;
  };
  const message = typeof value?.message === 'string' ? value.message : '';
  if (
    String(value?.code) === '3036' ||
    /\b3036\b|daily free allocation|(?:daily|free).{0,40}neuron|neuron.{0,40}(?:quota|limit|exhaust|exceed)/i.test(
      message,
    )
  )
    return new TrialError('provider_limit', 429);
  if (
    String(value?.code) === '3040' ||
    /\b3040\b|capacity temporarily|out of capacity/i.test(message) ||
    value?.status === 429 ||
    value?.statusCode === 429
  )
    return new TrialError('provider_busy', 503);
  if (String(value?.code) === '3007' || /\b3007\b|timed? ?out/i.test(message))
    return new TrialError('timeout');
  if (value?.name === 'AbortError') return new TrialError('disconnected');
  return new TrialError('model_error');
}
