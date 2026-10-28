import { useEffect, useId, useState } from 'react';
import { PERSONAS, personaInfo, type Persona, type Run, type Locale } from '../shared/domain.ts';
import { corePresentation, resolution } from './process.ts';
import { coreGeometry, diagnosticGeometry, pixelAspect, pointsText } from './screenGeometry.ts';
import { processingLight } from './processingLight.ts';
import { displayCopies, coreLabel, resolutionLabel } from './displayCopy.ts';

function useSceneClock(run: Run | null, position: number | undefined, motion: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!motion || position !== undefined || run?.status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(timer);
  }, [motion, position !== undefined, run?.status]);
  return !motion
    ? 0
    : (position ??
        (run
          ? Math.max(
              0,
              (run.completedAt ? Date.parse(run.completedAt) : now) - Date.parse(run.createdAt),
            )
          : 0));
}
export default function MagiScreen({
  run,
  onSelect,
  replay,
  position,
  motion,
  locale = 'en',
}: {
  run: Run | null;
  onSelect: (p: Persona) => void;
  replay: boolean;
  position?: number;
  motion: boolean;
  locale?: Locale;
}) {
  const stamp = resolution(run);
  const dc = displayCopies[locale];
  const stampText = resolutionLabel(run, stamp.tone, locale);
  const diagnostics = run?.status === 'running' && run.phase === 'independent';
  const clock = useSceneClock(run, position, motion);
  const id = useId().replaceAll(':', '');
  const scene = diagnostics ? 'diagnostics' : 'deliberation';
  return (
    <div
      className={`magi-screen ${run?.status === 'running' ? 'processing' : ''}`}
      data-scene={scene}
      data-motion-time={clock.toFixed(0)}
    >
      <h1 className="sr-only">MAGI SYSTEM</h1>
      <svg
        className="magi-display"
        viewBox="0 0 640 480"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="MAGI three persona decision screen"
      >
        <title>MAGI — {dc.system}</title>
        <rect className="screen-background" width="640" height="480" />
        <g
          transform={`scale(${pixelAspect} 1)`}
          className={`reference-plane scene-${scene}`}
          data-phase={run?.phase || 'standby'}
        >
          <g className="scene-chrome" key={scene}>
            <rect className="screen-border" x="38" y="38" width="628" height="411" />
            <g className="screen-header-rules">
              <path
                d={
                  diagnostics
                    ? 'M67 54H253M67 58H253M67 62H253M67 116H253M67 120H253M67 124H253M453 56H639M453 60H639M453 64H639M453 118H639M453 122H639M453 126H639'
                    : 'M67 54H223M67 58H223M67 62H223M67 116H223M67 120H223M67 124H223M481 54H637M481 58H637M481 62H637M481 116H637M481 120H637M481 124H637'
                }
              />
            </g>
            <g className="screen-kanji">
              <text
                x={diagnostics ? 81 : 76}
                y="108"
                textLength={diagnostics ? 158 : 138}
                lengthAdjust="spacingAndGlyphs"
                style={
                  locale === 'en'
                    ? { fontSize: 29, fontFamily: 'Arial, Helvetica, sans-serif' }
                    : undefined
                }
              >
                {dc.proposal}
              </text>
              <text
                x={diagnostics ? 469 : 489}
                y="108"
                textLength={diagnostics ? 155 : 138}
                lengthAdjust="spacingAndGlyphs"
                style={
                  locale === 'en'
                    ? { fontSize: 29, fontFamily: 'Arial, Helvetica, sans-serif' }
                    : undefined
                }
              >
                {dc.decision}
              </text>
            </g>
            <g className="screen-metadata">
              <text className="code" x="71" y="156">
                CODE:{diagnostics ? '132' : '239'}
              </text>
              <text x="72" y="181">
                FILE:MAGI_SYS
              </text>
              <text x="72" y="198">
                EXTENTION:{String(run?.records.length || 0).padStart(4, '0')}
              </text>
              <text x="72" y="215">
                EX_MODE:{diagnostics ? 'ON' : 'OFF'}
              </text>
              <text x="72" y="232">
                PRIORITY:{diagnostics ? 'A_' : 'AAA'}
              </text>
            </g>
            <g
              transform="translate(519 143)"
              className={`screen-stamp ${stamp.tone}`}
              role="status"
              aria-label={stampText}
              data-testid="resolution-stamp"
            >
              <rect width="115" height="44" />
              <rect x="4" y="4" width="107" height="36" />
              <text
                x="57.5"
                y={locale === 'en' ? 29 : 33}
                textAnchor="middle"
                textLength={locale === 'en' || stampText.length >= 3 ? 99 : 82}
                lengthAdjust="spacingAndGlyphs"
                style={
                  locale === 'en'
                    ? {
                        fontSize: stampText.length > 10 ? 17 : 21,
                        fontFamily: 'Arial, Helvetica, sans-serif',
                      }
                    : undefined
                }
              >
                {stampText}
              </text>
            </g>
            <g className="screen-connections">
              {diagnostics ? (
                <circle className="diagnostic-ring" cx="352" cy="257" r="147" />
              ) : (
                <path d="M273 265L254.5 283.5M431 265L449.5 283.5M302 368H402" />
              )}
            </g>
            {!diagnostics && run?.status === 'running' && run.phase !== 'final-vote' && motion && (
              <g className="signal-packets" aria-hidden="true">
                {[
                  [273, 265, 254.5, 283.5],
                  [431, 265, 449.5, 283.5],
                  [302, 368, 402, 368],
                ].map(([x1, y1, x2, y2], i) => {
                  const f = (clock / (run.phase === 'reconsideration' ? 1800 : 1100) + i / 3) % 1;
                  return <circle key={i} cx={x1 + (x2 - x1) * f} cy={y1 + (y2 - y1) * f} r="3" />;
                })}
              </g>
            )}
          </g>
          {PERSONAS.map((persona, index) => {
            const shape = coreGeometry[persona],
              square = diagnosticGeometry[persona],
              status = corePresentation(run, persona);
            const received = run?.records.some(
              (record) => record.persona === persona && record.phase === 'independent',
            );
            const angle = square.angle;
            const lit =
              !status.pending ||
              !motion ||
              processingLight(clock, `${run?.id}:${persona}:${run?.phase}:${run?.round}`);
            const [width, height] = square.size;
            return (
              <g
                key={persona}
                className={`anime-core ${persona} tone-${status.tone} ${diagnostics ? `diagnostic-core ${received ? 'diagnostic-complete' : 'diagnostic-pending'}` : ''} ${status.pending ? 'core-pending' : ''}`}
                data-testid={`core-${persona}`}
                data-state={status.label}
                data-lit={lit}
                role="button"
                tabIndex={0}
                aria-label={`${personaInfo[persona].name} ${coreLabel(status.label, locale)}`}
                onClick={() => onSelect(persona)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(persona);
                  }
                }}
              >
                <title>
                  {personaInfo[persona].name} · {coreLabel(status.label, locale)}
                </title>
                {diagnostics ? (
                  <g
                    className="diagnostic-rotor"
                    transform={`translate(${square.center.join(' ')}) rotate(${angle.toFixed(3)})`}
                  >
                    <polygon
                      points={`${-width / 2},${-height / 2} ${width / 2},${-height / 2} ${width / 2},${height / 2} ${-width / 2},${height / 2}`}
                    />
                    <text
                      className="diagnostic-name"
                      textAnchor="middle"
                      y="-27"
                      textLength="135"
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {persona.toUpperCase()}
                    </text>
                    <text className="diagnostic-number" textAnchor="middle" y="56">
                      {personaInfo[persona].numeral.slice(-1)}
                    </text>
                  </g>
                ) : (
                  <>
                    <defs>
                      <clipPath id={`${id}-${persona}`}>
                        <polygon points={pointsText(shape.points)} />
                      </clipPath>
                    </defs>
                    <polygon className="core-body" points={pointsText(shape.points)} />
                    {status.pending && motion && run?.phase === 'reconsideration' && (
                      <rect
                        className="core-scan"
                        clipPath={`url(#${id}-${persona})`}
                        x="0"
                        y={(clock / 12 + index * 110) % 480}
                        width="704"
                        height="3"
                      />
                    )}
                    <text
                      className="core-name"
                      transform={`translate(${shape.label.join(' ')})`}
                      textLength={shape.labelWidth}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {personaInfo[persona].name.replace('-', '·')}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <text
            className="screen-magi"
            transform={diagnostics ? 'translate(352 268)' : 'translate(352 336)'}
            textAnchor="middle"
            textLength={diagnostics ? 114 : 98}
            lengthAdjust="spacingAndGlyphs"
          >
            MAGI
          </text>
          {replay && (
            <text className="screen-replay" x="352" y="471" textAnchor="middle">
              {dc.recorded}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
