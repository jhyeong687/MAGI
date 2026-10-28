import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

export async function build() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Use npm run setup or npm start.');
  const code = await new Promise<number | null>((done, reject) => {
    const child = spawn(process.execPath, [npmCli, 'run', 'build'], {
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', reject);
    child.once('close', done);
  });
  if (code !== 0) throw new Error('Build failed. See the output above.');
}
export async function start() {
  if (!existsSync(resolve('dist/index.html'))) await build();
  process.env.NODE_ENV = 'production';
  await import('../server/index.ts');
}
if (process.argv[1]?.endsWith('/start.ts') || process.argv[1]?.endsWith('\\start.ts')) {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
