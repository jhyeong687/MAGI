import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const productionSettings = resolve('.magi/settings.json');
const fingerprint = () =>
  existsSync(productionSettings)
    ? createHash('sha256').update(readFileSync(productionSettings)).digest('hex')
    : null;
const before = fingerprint();
const child = spawn(
  process.execPath,
  [resolve('node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)],
  { stdio: 'inherit', shell: false },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('close', (code) => {
  const after = fingerprint();
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    'test-results/production-isolation.json',
    JSON.stringify(
      {
        testPort: 5187,
        reuseProductionServer: false,
        realModelCalls: false,
        productionSettingsUnchanged: before === after,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  if (before !== after)
    console.error(
      'Production settings changed during the test window; inspect independent user changes. Tests only addressed port 5187.',
    );
  process.exitCode = code ?? 1;
});
