import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { checkFreePlan } from '../cloudflare/billing.ts';

const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const billing = process.env.MAGI_BILLING_READ_TOKEN || '';
if (!process.env.CLOUDFLARE_API_TOKEN || !(await checkFreePlan(account, billing))) {
  console.error(
    'Deployment refused: authenticated Workers Free verification is required. No resources changed.',
  );
  process.exit(1);
}
function wrangler(args: string[], input?: string) {
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
    env: process.env,
    encoding: 'utf8',
    input,
    stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
// Deploy disabled first. Activation follows only after private bindings are present.
wrangler(['deploy', '--var', `CF_ACCOUNT_ID:${account}`, '--var', 'TRIAL_ENABLED:false']);
const listed = spawnSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'secret', 'list', '--format', 'json'],
  { env: process.env, encoding: 'utf8' },
);
if (listed.status !== 0) {
  console.error('Cannot inspect existing secret names. Worker remains disabled.');
  process.exit(1);
}
let names: { name: string }[];
try {
  names = JSON.parse(listed.stdout);
} catch {
  console.error('Cannot parse secret names. Worker remains disabled.');
  process.exit(1);
}
const secrets: Record<string, string> = { CF_BILLING_READ_TOKEN: billing };
if (!names.some((item) => item.name === 'IP_SALT'))
  secrets.IP_SALT = randomBytes(32).toString('hex');
wrangler(['secret', 'bulk'], JSON.stringify(secrets));
if (!(await checkFreePlan(account, billing))) {
  console.error('Activation refused: free plan could not be reverified. Worker remains disabled.');
  process.exit(1);
}
wrangler(['deploy', '--var', `CF_ACCOUNT_ID:${account}`, '--var', 'TRIAL_ENABLED:true']);
console.log(
  'Free-only trial deployed. Set its workers.dev origin in public/trial-config.json, then publish Pages. Never upgrade this account to Workers Paid.',
);
