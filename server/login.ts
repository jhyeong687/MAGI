import { spawn, type ChildProcess } from 'node:child_process';
import type { Environment, LoginState } from '../shared/domain.ts';
import { childEnvironment } from './codex.ts';

// Codex owns OAuth, the callback and credential storage. MAGI never handles tokens.
export class LoginManager {
  private state: LoginState = { status: 'idle' };
  private child?: ChildProcess;
  private timer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  constructor(
    private environment: (refresh?: boolean) => Promise<Environment>,
    private launch: (binary: string) => ChildProcess = (binary) =>
      spawn(binary, ['login'], {
        env: childEnvironment(),
        shell: false,
        stdio: ['ignore', 'ignore', 'ignore'],
      }),
  ) {}
  snapshot(): LoginState {
    return { ...this.state };
  }
  async start(): Promise<LoginState> {
    if (this.state.status === 'pending') return this.snapshot();
    const attempt = ++this.attempt;
    this.state = { status: 'pending' };
    try {
      const env = await this.environment(true);
      if (attempt !== this.attempt) return this.snapshot();
      if (env.ready) {
        this.state = { status: 'completed' };
        return this.snapshot();
      }
      if (!env.binary) throw new Error('CLI missing');
      const child = this.launch(env.binary);
      this.child = child;
      const finish = async (code: number | null) => {
        if (this.child !== child) return;
        this.child = undefined;
        clearTimeout(this.timer);
        const next = code === 0 ? await this.environment(true).catch(() => null) : null;
        if (attempt !== this.attempt) return;
        this.state = next?.ready
          ? { status: 'completed' }
          : {
              status: 'error',
              error: 'ChatGPT sign-in did not finish. Run npm run login in a terminal.',
            };
      };
      child.once('error', () => void finish(null));
      child.once('close', (code) => void finish(code));
      this.timer = setTimeout(() => {
        this.cancel();
        this.state = {
          status: 'error',
          error: 'Sign-in timed out. Try again or run npm run login.',
        };
      }, 5 * 60_000);
      this.timer.unref();
    } catch {
      if (attempt !== this.attempt) return this.snapshot();
      this.state = {
        status: 'error',
        error: 'Install dependencies with npm ci, then run npm run login.',
      };
    }
    return this.snapshot();
  }
  cancel(): LoginState {
    this.attempt++;
    clearTimeout(this.timer);
    const child = this.child;
    this.child = undefined;
    child?.kill('SIGTERM');
    if (this.state.status === 'pending') this.state = { status: 'idle' };
    return this.snapshot();
  }
}
