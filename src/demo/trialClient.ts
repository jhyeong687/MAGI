import type { Locale, Run } from '../../shared/domain.ts';
import type { TrialStatus, TrialCode } from '../../cloudflare/policy.ts';
export class TrialClientError extends Error {
  constructor(readonly code: TrialCode) {
    super(code);
  }
}
export function trialEndpoint(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      /^[a-z0-9.-]+\.workers\.dev$/.test(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/'
      ? url.origin
      : '';
  } catch {
    return '';
  }
}
export async function trialStatus(api: string, signal?: AbortSignal): Promise<TrialStatus> {
  const response = await fetch(`${api}/status`, { credentials: 'omit', cache: 'no-store', signal });
  if (!response.ok) throw new TrialClientError('unavailable');
  return response.json();
}
export async function trialRun(
  api: string,
  question: string,
  locale: Locale,
  signal: AbortSignal,
  onRun: (run: Run) => void,
  onStatus: (status: TrialStatus) => void,
) {
  const response = await fetch(`${api}/run`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, locale, attempt: crypto.randomUUID() }),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new TrialClientError(error.code || 'unavailable');
  }
  if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson'))
    throw new TrialClientError('unavailable');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    terminal = false;
  function message(line: string) {
    if (!line.trim()) return;
    const value = JSON.parse(line);
    if (value.type === 'run' && value.run?.id && Array.isArray(value.run.records)) {
      onRun(value.run);
      terminal = value.run.status !== 'running';
    } else if (value.type === 'status') onStatus(value.status);
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 500000) throw new TrialClientError('model_error');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) message(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) message(buffer);
    if (!terminal) throw new TrialClientError('disconnected');
  } finally {
    reader.releaseLock();
  }
}
