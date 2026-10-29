import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { checkFreePlan } from '../cloudflare/billing.ts';

const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
// An update may verify billing with a temporary deploy token that also has Billing
// Read. That temporary credential is NEVER installed as the runtime guard secret.
const runtimeBilling = process.env.MAGI_BILLING_READ_TOKEN || '';
const verificationToken = runtimeBilling || process.env.CLOUDFLARE_API_TOKEN || '';
if (!process.env.CLOUDFLARE_API_TOKEN || !(await checkFreePlan(account, verificationToken))) {
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
const listed = spawnSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'secret', 'list', '--format', 'json'],
  { env: process.env, encoding: 'utf8' },
);
if (listed.status !== 0) {
  console.error('Cannot inspect existing secret names. No resources changed.');
  process.exit(1);
}
let names: { name: string }[];
try {
  names = JSON.parse(listed.stdout);
} catch {
  console.error('Cannot parse secret names. No resources changed.');
  process.exit(1);
}
if (!runtimeBilling && !names.some((item) => item.name === 'CF_BILLING_READ_TOKEN')) {
  console.error(
    'Initial setup requires a separate runtime Billing Read token. No resources changed.',
  );
  process.exit(1);
}
const secrets: Record<string, string> = {};
if (runtimeBilling) secrets.CF_BILLING_READ_TOKEN = runtimeBilling;
if (!names.some((item) => item.name === 'IP_SALT'))
  secrets.IP_SALT = randomBytes(32).toString('hex');
// Existing guard and salt stay private and survive updates; counters are retained.
wrangler(['deploy', '--var', `CF_ACCOUNT_ID:${account}`, '--var', 'TRIAL_ENABLED:false']);
if (Object.keys(secrets).length) wrangler(['secret', 'bulk'], JSON.stringify(secrets));
if (!(await checkFreePlan(account, verificationToken))) {
  console.error('Activation refused: free plan could not be reverified. Worker remains disabled.');
  process.exit(1);
}
wrangler(['deploy', '--var', `CF_ACCOUNT_ID:${account}`, '--var', 'TRIAL_ENABLED:true']);
console.log(
  'Free-only trial deployed. Publish the frontend and revoke temporary deploy access. Never upgrade this account to Workers Paid.',
);
