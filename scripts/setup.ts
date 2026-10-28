import { login } from './login.ts';
import { build, start } from './start.ts';
try {
  await login();
  await build();
  await start();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
