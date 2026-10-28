import { spawn, execFile } from 'node:child_process';
import { accessSync, constants, mkdirSync, writeFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  assessmentSchema,
  type Assessment,
  type Environment,
  type Usage,
} from '../shared/domain.ts';

const exec = promisify(execFile);
export function childEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
  for (const key of [
    'OPENAI_API_KEY',
    'CODEX_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_ORG_ID',
    'OPENAI_PROJECT_ID',
    'CODEX_THREAD_ID',
  ])
    delete env[key];
  return env;
}
export function cleanError(value: unknown): string {
  return String(value instanceof Error ? value.message : value)
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[\w-]+/g, '[REDACTED]')
    .slice(0, 1800);
}
let cachedEnvironment: Environment | undefined;
export async function detectEnvironment(refresh = false): Promise<Environment> {
  if (
    !refresh &&
    cachedEnvironment &&
    Date.now() - Date.parse(cachedEnvironment.checkedAt) < 30_000
  )
    return cachedEnvironment;
  const issues: string[] = [];
  const candidates = process.env.MAGI_CODEX_BIN
    ? [process.env.MAGI_CODEX_BIN]
    : [
        resolve('node_modules/.bin/codex'),
        ...(process.env.PATH || '').split(delimiter).map((p) => resolve(p, 'codex')),
        '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex',
        '/Applications/Codex.app/Contents/Resources/codex',
      ];
  const result: Environment = {
    ready: false,
    auth: 'missing',
    checkedAt: new Date().toISOString(),
    issues,
    capabilities: [],
    usageNotice:
      'Uses your existing Codex plan allowance. Not unlimited; usage limits apply. No separate API key.',
  };
  for (const binary of [...new Set(candidates)]) {
    try {
      accessSync(binary, constants.X_OK);
    } catch {
      continue;
    }
    try {
      const options = { timeout: 8000, maxBuffer: 1024 * 1024, env: childEnvironment() };
      const version = await exec(binary, ['--version'], options);
      const help = await exec(binary, ['exec', '--help'], options);
      const required = ['--json', '--output-schema', '--ignore-user-config', '--ignore-rules'];
      if (!required.every((flag) => help.stdout.includes(flag))) {
        issues.push(`${binary}: CLI upgrade required (missing supported isolation flags).`);
        continue;
      }
      let authText = '';
      try {
        const auth = await exec(binary, ['login', 'status'], options);
        authText = auth.stdout + auth.stderr;
      } catch {
        authText = '';
      }
      result.binary = binary;
      result.version = version.stdout.trim();
      result.auth = /using ChatGPT/i.test(authText)
        ? 'chatgpt'
        : /api key/i.test(authText)
          ? 'api-key'
          : 'missing';
      result.ready = result.auth === 'chatgpt';
      result.capabilities = ['exec', 'resume', 'jsonl', 'json-schema', 'read-only'];
      if (!result.ready)
        issues.push(
          result.auth === 'api-key'
            ? 'API-key authentication is disabled for MAGI. Run codex login with ChatGPT.'
            : 'ChatGPT login is required. Run codex login in a terminal.',
        );
      cachedEnvironment = result;
      return result;
    } catch (err) {
      issues.push(`${binary}: ${cleanError(err).split('\n')[0]}`);
    }
  }
  issues.push(
    'No compatible Codex CLI found. Install/update the official Codex CLI or set MAGI_CODEX_BIN.',
  );
  cachedEnvironment = result;
  return result;
}

export interface Invocation {
  binary: string;
  directory: string;
  prompt: string;
  personaPrompt: string;
  threadId?: string;
  timeoutMs: number;
  signal: AbortSignal;
  onThread: (id: string) => void;
}
export interface InvocationResult {
  assessment: Assessment;
  usage: Usage;
  durationMs: number;
}
export type Runner = (request: Invocation) => Promise<InvocationResult>;

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    vote: { type: 'string', enum: ['APPROVE', 'DENY', 'ABSTAIN'] },
    summary: { type: 'string' },
    rationale: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    responseToOthers: { type: 'string' },
    confidence: { type: 'integer' },
  },
  required: ['vote', 'summary', 'rationale', 'risks', 'responseToOthers', 'confidence'],
};

export function buildArguments(request: Invocation, schemaPath: string): string[] {
  const args = ['exec'];
  if (request.threadId) args.push('resume');
  args.push(
    '--ignore-user-config',
    '--ignore-rules',
    '--skip-git-repo-check',
    '--json',
    '--output-schema',
    schemaPath,
    '-c',
    'sandbox_mode="read-only"',
    '-c',
    'approval_policy="never"',
    '-c',
    'forced_login_method="chatgpt"',
    '-c',
    'web_search="disabled"',
    '--disable',
    'shell_tool',
    '--disable',
    'multi_agent',
    '-c',
    `developer_instructions=${JSON.stringify(request.personaPrompt)}`,
  );
  if (!request.threadId) args.push('--sandbox', 'read-only');
  if (request.threadId) args.push(request.threadId);
  args.push('-');
  return args;
}

export async function runStructuredCodex<T>(
  request: Invocation,
  schema: object,
  parse: (value: unknown) => T,
): Promise<{ value: T; usage: Usage; durationMs: number }> {
  if (request.signal.aborted) throw new Error('Cancelled by operator.');
  mkdirSync(request.directory, { recursive: true });
  const schemaPath = resolve(request.directory, 'output.schema.json');
  writeFileSync(schemaPath, JSON.stringify(schema));
  return new Promise((resolveResult, reject) => {
    const start = Date.now();
    const child = spawn(request.binary, buildArguments(request, schemaPath), {
      cwd: request.directory,
      env: childEnvironment(),
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '',
      stderr = '',
      lastMessage = '',
      failure = '',
      completed = false,
      bytes = 0,
      settled = false,
      stopping = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const usage: Usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
    const stop = (reason: string) => {
      if (stopping) return;
      stopping = true;
      failure ||= reason;
      const kill = (signal: NodeJS.Signals) => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {
          /* exited */
        }
      };
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 1200);
      killTimer.unref();
    };
    const cancel = () => stop('Cancelled by operator.');
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    const timer = setTimeout(
      () => stop(`Codex timed out after ${request.timeoutMs / 1000}s.`),
      request.timeoutMs,
    );
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Keep an outstanding SIGKILL timer when cancelling a whole process group.
      if (!failure && killTimer) clearTimeout(killTimer);
      request.signal.removeEventListener('abort', cancel);
      if (err) {
        reject(new Error(cleanError(err)));
        return;
      }
      try {
        if (!completed) throw new Error('Codex did not report a completed turn.');
        const value = parse(JSON.parse(lastMessage));
        resolveResult({ value, usage, durationMs: Date.now() - start });
      } catch (error) {
        reject(new Error(`Invalid Codex result: ${cleanError(error)}`));
      }
    };
    const line = (raw: string) => {
      if (!raw.trim()) return;
      try {
        const event = JSON.parse(raw);
        if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
          if (request.threadId && event.thread_id !== request.threadId) {
            stop('Codex resumed an unexpected session.');
            return;
          }
          request.onThread(event.thread_id);
        }
        // Deliberately ignore reasoning and tool items. Only public final messages are consumed.
        if (event.type === 'item.completed' && event.item?.type === 'agent_message')
          lastMessage = event.item.text;
        if (event.type === 'turn.completed') {
          completed = true;
          usage.inputTokens += event.usage?.input_tokens || 0;
          usage.outputTokens += event.usage?.output_tokens || 0;
          usage.cachedTokens += event.usage?.cached_input_tokens || 0;
        }
        if (event.type === 'turn.failed' || event.type === 'error')
          failure ||= cleanError(event.error?.message || event.message || 'Codex turn failed.');
      } catch {
        stop('Malformed JSONL from Codex.');
      }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data: string) => {
      bytes += Buffer.byteLength(data);
      if (bytes > 2 * 1024 * 1024) {
        stop('Codex output exceeded 2 MiB.');
        return;
      }
      buffer += data;
      let index: number;
      while ((index = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
    });
    child.stderr.on('data', (data) => {
      stderr = (stderr + data.toString()).slice(-6000);
    });
    child.stdin.on('error', () => {
      /* close/error handler reports failure */
    });
    child.on('error', finish);
    child.on('close', (code) => {
      if (buffer.trim()) line(buffer);
      finish(failure || (code !== 0 ? `Codex exited ${code}: ${cleanError(stderr)}` : undefined));
    });
    child.stdin.end(request.prompt);
  });
}

export const runCodex: Runner = async (request) => {
  const { value, ...metadata } = await runStructuredCodex(request, outputSchema, (value) =>
    assessmentSchema.parse(value),
  );
  return { assessment: value, ...metadata };
};
