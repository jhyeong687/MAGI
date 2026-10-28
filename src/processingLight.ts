// A deterministic irregular light sequence: live and recorded playback share it.
// Separate windows leave quiet gaps and allow at most two pulses per 2.8 seconds.
export function processingLight(milliseconds: number, seed: string): boolean {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const time = Math.max(0, milliseconds) + ((hash >>> 0) % 2800);
  const window = Math.floor(time / 2800);
  const phase = time % 2800;
  const random = (salt: number) => {
    let value = Math.imul(hash ^ window, 1597334677) ^ salt;
    value = Math.imul(value ^ (value >>> 16), 2246822507);
    return (value ^ (value >>> 13)) >>> 0;
  };
  const start = 120 + (random(1) % 380);
  const duration = 500 + (random(2) % 700);
  if (phase >= start && phase < start + duration) return true;
  const second = 1800 + (random(3) % 250);
  return random(4) % 3 !== 0 && phase >= second && phase < second + 300 + (random(5) % 200);
}
