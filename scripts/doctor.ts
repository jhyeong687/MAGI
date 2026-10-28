import { detectEnvironment } from '../server/codex.ts';
const env = await detectEnvironment(true);
console.log(JSON.stringify(env, null, 2));
process.exitCode = env.ready ? 0 : 1;
