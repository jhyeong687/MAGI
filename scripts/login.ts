import { spawn } from 'node:child_process';
import { detectEnvironment, childEnvironment } from '../server/codex.ts';

export async function login() {
  const env = await detectEnvironment(true);
  if (env.ready) {
    console.log('ChatGPT is already connected.');
    return;
  }
  if (!env.binary) throw new Error('Codex is missing. Run npm ci first, then npm run login.');
  const args = ['login'];
  if (process.argv.includes('--device')) args.push('--device-auth');
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(env.binary!, args, {
      stdio: 'inherit',
      shell: false,
      env: childEnvironment(),
    });
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (code !== 0 || !(await detectEnvironment(true)).ready)
    throw new Error('ChatGPT sign-in did not complete.');
  console.log('ChatGPT connected. Your own account allowance applies.');
}
if (process.argv[1]?.endsWith('/login.ts') || process.argv[1]?.endsWith('\\login.ts')) {
  login().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
