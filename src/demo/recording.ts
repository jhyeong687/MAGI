import type { Run } from '../../shared/domain.ts';
import recording from '../../demo/recordings/public-run.json';
// A purpose-made public scenario. Sanitized by scripts/record-public-demo.ts.
export function recordedRun(): Run {
  return structuredClone(recording) as Run;
}
