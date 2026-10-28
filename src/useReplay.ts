import { useEffect, useMemo, useRef, useState } from 'react';
import type { Run } from '../shared/domain.ts';
import { frameAt, playbackTimeline } from './process.ts';

export function useReplay(run: Run | null) {
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const positionRef = useRef(0);
  const events = useMemo(() => (run ? playbackTimeline(run) : []), [run]);
  const duration = Math.max(1, events.at(-1)?.offset || 0);
  useEffect(() => {
    setEnabled(false);
    setPlaying(false);
    setPosition(0);
    positionRef.current = 0;
  }, [run?.id]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      positionRef.current = Math.min(duration, positionRef.current + (now - last) * speed);
      last = now;
      setPosition(positionRef.current);
      if (positionRef.current >= duration) setPlaying(false);
    }, 50);
    return () => clearInterval(timer);
  }, [playing, speed, duration]);
  const current = (events.findLast((frame) => frame.offset <= position) || events[0])?.event;
  return {
    view: enabled && run && current ? frameAt(run, current) : run,
    enabled,
    playing,
    position,
    duration,
    speed,
    setSpeed,
    play: () => {
      if (!run || run.status === 'running') return;
      positionRef.current = 0;
      setPosition(0);
      setEnabled(true);
      setPlaying(true);
    },
    toggle: () => {
      if (positionRef.current >= duration) {
        positionRef.current = 0;
        setPosition(0);
      }
      setPlaying((value) => !value);
    },
    stop: () => {
      setEnabled(false);
      setPlaying(false);
    },
    seek: (ms: number) => {
      positionRef.current = Math.max(0, Math.min(duration, ms));
      setPosition(positionRef.current);
    },
  };
}
