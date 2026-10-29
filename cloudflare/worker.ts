import { DurableObject } from 'cloudflare:workers';
import { checkFreePlan } from './billing.ts';
import {
  TRIAL_POLICY,
  TrialError,
  emptyQuota,
  quotaStatus,
  reserve,
  utcDay,
  nextReset,
  validQuestion,
  type QuotaState,
} from './policy.ts';
import { cloudInput, createTrialRun, deliberate, type Model } from './protocol.ts';
import type { Locale } from '../shared/personas.ts';

export interface Env {
  AI: Ai;
  QUOTA: DurableObjectNamespace<DailyTrial>;
  TRIAL_ENABLED: string;
  ALLOWED_ORIGIN: string;
  CF_ACCOUNT_ID: string;
  CF_BILLING_READ_TOKEN: string;
  IP_SALT: string;
}
function configured(env: Env) {
  return (
    env.TRIAL_ENABLED === 'true' &&
    Boolean(env.CF_ACCOUNT_ID && env.CF_BILLING_READ_TOKEN && env.IP_SALT?.length >= 32)
  );
}
function errorResponse(code: string, status: number) {
  return Response.json({ code }, { status });
}
async function boundedBody(request: Request) {
  if (!request.body) throw new TrialError('invalid_question', 400);
  const reader = request.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 6000) {
        await reader.cancel();
        throw new TrialError('invalid_question', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as {
      question?: unknown;
      locale?: unknown;
      attempt?: unknown;
    };
  } catch (error) {
    if (error instanceof TrialError) throw error;
    throw new TrialError('invalid_question', 400);
  }
}
async function clientKey(request: Request, salt: string) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) throw new TrialError('unavailable');
  const secret = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const hash = await crypto.subtle.sign(
    'HMAC',
    secret,
    new TextEncoder().encode(`${utcDay()}:${ip}`),
  );
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (origin !== env.ALLOWED_ORIGIN) return errorResponse('unavailable', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    let response: Response;
    if (
      !['/status', '/run'].includes(url.pathname) ||
      !['GET', 'POST'].includes(request.method) ||
      (url.pathname === '/run') !== (request.method === 'POST')
    )
      response = errorResponse('unavailable', 404);
    else if (!configured(env)) response = errorResponse('unavailable', 503);
    else {
      try {
        // Each UTC day has one authoritative SQLite object; counters cannot split by region.
        const stub = env.QUOTA.get(env.QUOTA.idFromName(`magi-trial-${utcDay()}`));
        response = await stub.fetch(request);
      } catch {
        response = errorResponse('unavailable', 503);
      }
    }
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;

export class DailyTrial extends DurableObject<Env> {
  private async state(): Promise<QuotaState> {
    return (await this.ctx.storage.get<QuotaState>('quota')) || emptyQuota();
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const client = await clientKey(request, this.env.IP_SALT);
      if (request.method === 'GET') {
        if (!(await checkFreePlan(this.env.CF_ACCOUNT_ID, this.env.CF_BILLING_READ_TOKEN)))
          throw new TrialError('unavailable');
        return Response.json(quotaStatus(await this.state(), client));
      }
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
        throw new TrialError('invalid_question', 415);
      const body = await boundedBody(request);
      if (
        !validQuestion(body.question) ||
        !['ja', 'en', 'ko', 'zh'].includes(String(body.locale)) ||
        typeof body.attempt !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(body.attempt)
      )
        throw new TrialError('invalid_question', 400);
      // On a paid account Cloudflare can charge overage: refuse it, even when our cap is low.
      if (!(await checkFreePlan(this.env.CF_ACCOUNT_ID, this.env.CF_BILLING_READ_TOKEN)))
        throw new TrialError('unavailable');
      const attempt = body.attempt;
      await this.ctx.blockConcurrencyWhile(async () => {
        const state = await this.state();
        reserve(state, client, attempt);
        await this.ctx.storage.put('quota', state);
        if (!(await this.ctx.storage.getAlarm()))
          await this.ctx.storage.setAlarm(nextReset() + 86400000);
      });
      const run = createTrialRun(body.question.trim(), body.locale as Locale);
      const controller = new AbortController();
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      let chain = Promise.resolve();
      const emit = (value: unknown) => {
        if (controller.signal.aborted) return;
        chain = chain
          .then(() => writer.write(encoder.encode(JSON.stringify(value) + '\n')))
          .catch(() => {
            controller.abort();
          });
      };
      writer.closed.catch(() => controller.abort());
      request.signal.addEventListener('abort', () => controller.abort(), { once: true });
      let providerClosed = false;
      const model: Model = async (input, signal) => {
        if (signal.aborted) throw new TrialError('disconnected');
        try {
          // Fixed free-eligible model and native binding only: no Gateway / credits / API keys.
          return await this.env.AI.run(
            TRIAL_POLICY.model as Parameters<Ai['run']>[0],
            cloudInput(input) as never,
            { signal },
          );
        } catch (error) {
          const value = error as { message?: string; status?: number; statusCode?: number };
          if (
            /neuron|quota|daily.*limit|allocation|10007/i.test(value.message || '') ||
            value.status === 429 ||
            value.statusCode === 429
          ) {
            providerClosed = true;
            throw new TrialError('provider_limit', 429);
          }
          throw new TrialError('model_error');
        }
      };
      // The response remains streaming for the whole run. No detached background inference.
      void (async () => {
        try {
          await deliberate(
            run,
            model,
            (snapshot) => emit({ type: 'run', run: snapshot }),
            controller.signal,
          );
        } finally {
          await this.ctx.blockConcurrencyWhile(async () => {
            const state = await this.state();
            delete state.active[attempt];
            if (providerClosed) state.closed = true;
            await this.ctx.storage.put('quota', state);
            emit({ type: 'status', status: quotaStatus(state, client) });
          });
          await chain;
          await writer.close().catch(() => {});
        }
      })().catch(() => {
        controller.abort();
        void writer.abort().catch(() => {});
      });
      return new Response(readable, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      return errorResponse(
        error instanceof TrialError ? error.code : 'unavailable',
        error instanceof TrialError ? error.httpStatus : 503,
      );
    }
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
