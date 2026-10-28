import { useCallback, useEffect, useRef } from 'react';
import type { Run } from '../shared/domain.ts';

// Original synthesized motifs. No samples from the television soundtrack.
export function useSound(enabled: boolean, view: Run | null, audible: boolean) {
  const context = useRef<AudioContext | null>(null);
  const previous = useRef<string | null>(null);
  const unlock = useCallback(() => {
    if (!context.current) context.current = new AudioContext();
    void context.current.resume().catch(() => {});
  }, []);
  useEffect(() => {
    if (!enabled) {
      void context.current?.suspend();
      return;
    }
    const activate = () => {
      if (document.visibilityState === 'visible') unlock();
    };
    document.addEventListener('pointerdown', activate);
    document.addEventListener('keydown', activate);
    return () => {
      document.removeEventListener('pointerdown', activate);
      document.removeEventListener('keydown', activate);
    };
  }, [enabled, unlock]);
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  const key = view
    ? `${view.id}:${view.phase}:${view.round}:${view.records.length}:${view.status}`
    : null;
  useEffect(() => {
    const before = previous.current;
    previous.current = key;
    const ctx = context.current;
    if (
      !key ||
      !before ||
      key === before ||
      !enabled ||
      !audible ||
      !ctx ||
      ctx.state !== 'running' ||
      document.visibilityState !== 'visible'
    )
      return;
    const old = before.split(':');
    // Seeking backwards is silent. A later live/replayed event may produce its cue.
    if (old[0] === view!.id && Number(old[3]) > view!.records.length) return;
    const notes =
      view!.status === 'completed'
        ? view!.verdict?.result === 'APPROVED'
          ? [523, 659, 784]
          : [330, 247, 165]
        : view!.status === 'error' || view!.status === 'cancelled'
          ? [180, 130]
          : old[1] !== view!.phase
            ? [440, 660]
            : [880];
    notes.forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.09;
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.018, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.08);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }, [key, enabled, audible, view]);
  return unlock;
}
