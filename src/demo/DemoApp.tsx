import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PERSONAS,
  personaInfo,
  personaProfiles,
  type Locale,
  type Persona,
  type Phase,
} from '../../shared/domain.ts';
import MagiScreen from '../MagiScreen.tsx';
import FinalAnswer from '../FinalAnswer.tsx';
import { useReplay } from '../useReplay.ts';
import { copies, phaseLabels } from '../i18n.ts';
import { localeNames } from '../displayCopy.ts';
import { screenCopy } from '../screenCopy.ts';
import { repoUrl } from '../shareCopy.ts';
import { demoCopies } from './copy.ts';
import { recordedRun } from './recording.ts';
import { createExample, exampleIds, exampleTitle, type ExampleId } from './catalog.ts';
import { demoPresentation, recordingContext } from './presentation.ts';

const phases: Phase[] = [
  'independent',
  'cross-examination',
  'reconsideration',
  'final-vote',
  'report',
];
function initialLocale(): Locale {
  const value =
    new URLSearchParams(location.search).get('lang') || localStorage.getItem('magi-demo-locale');
  return value && Object.hasOwn(localeNames, value) ? (value as Locale) : 'ja';
}
export default function DemoApp() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [selected, setSelected] = useState<ExampleId | 'recording'>(() => {
    const id = new URLSearchParams(location.search).get('example');
    if (id === 'recording') return id;
    return exampleIds.includes(id as ExampleId) ? (id as ExampleId) : 'recording';
  });
  const [started, setStarted] = useState(false),
    [persona, setPersona] = useState<Persona>('melchior');
  const recorded = selected === 'recording';
  const run = useMemo(
    () => (selected === 'recording' ? recordedRun() : createExample(selected, locale)),
    [selected, locale],
  );
  const replay = useReplay(run);
  const view = started ? replay.view : null;
  const t = demoCopies[locale],
    copy = copies[locale];
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [animations, setAnimations] = useState(
    () => localStorage.getItem('magi-demo-animations') !== 'off',
  );
  const motion = animations && !reduced;
  const [reveal, setReveal] = useState<'idle' | 'showing' | 'done'>('idle');
  const [answerRequested, setAnswerRequested] = useState(false);
  const answerTarget = useRef<HTMLDivElement>(null);
  const inspectorTarget = useRef<HTMLDivElement>(null);
  const sharedEntry = useRef(new URLSearchParams(location.search).get('view') === 'result');
  const revealed = useRef(false);
  const film = new URLSearchParams(location.search).has('film');
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    localStorage.setItem('magi-demo-animations', animations ? 'on' : 'off');
  }, [animations]);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
    localStorage.setItem('magi-demo-locale', locale);
    const url = new URL(location.href);
    url.searchParams.set('lang', locale);
    url.searchParams.set('example', selected);
    if (started && view?.answer?.status === 'completed') url.searchParams.set('view', 'result');
    else url.searchParams.delete('view');
    history.replaceState(null, '', url);
  }, [locale, selected, started, view?.answer?.status]);
  useEffect(() => {
    if (!started || !view?.verdict) {
      revealed.current = false;
      setReveal('idle');
      return;
    }
    if (!motion) {
      revealed.current = true;
      setReveal('done');
      return;
    }
    if (revealed.current) return;
    revealed.current = true;
    setReveal('showing');
    const timer = setTimeout(() => setReveal('done'), 1500);
    return () => clearTimeout(timer);
  }, [Boolean(view?.verdict), started, motion]);
  useEffect(() => {
    replay.setSpeed(recorded ? 4 : 1);
  }, [selected]);
  useEffect(() => {
    if (!sharedEntry.current) return;
    setStarted(true);
    replay.play();
    replay.seek(replay.duration);
  }, []);
  const completed =
    started && view?.answer?.status === 'completed' && replay.position >= replay.duration;
  useEffect(() => {
    if (completed) setAnswerRequested(true);
  }, [completed]);
  useEffect(() => {
    if (!answerRequested || !completed || reveal !== 'done') return;
    const target = answerTarget.current;
    if (target?.getClientRects().length) {
      target.focus({ preventScroll: true });
      // The reveal supplies the motion. An immediate handoff also remains reliable
      // when an operator clicks the result control again during a previous scroll.
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    setAnswerRequested(false);
  }, [answerRequested, completed, reveal]);
  function inspectCore(value: Persona) {
    setPersona(value);
    const target = inspectorTarget.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: 'instant', block: 'center' });
  }
  function start() {
    if (!started) replay.setSpeed(recorded ? 4 : 1);
    setStarted(true);
    setAnswerRequested(false);
    revealed.current = false;
    setReveal('idle');
    replay.play();
  }
  function changeLocale(value: Locale) {
    setStarted(false);
    setAnswerRequested(false);
    replay.stop();
    setLocale(value);
  }
  function changeExample(value: ExampleId | 'recording') {
    setStarted(false);
    setAnswerRequested(false);
    replay.stop();
    setSelected(value);
  }
  const presentation = demoPresentation(run, locale, selected);
  const record = view?.records.findLast((item) => item.persona === persona);
  const resultLabel =
    view?.verdict?.result === 'APPROVED'
      ? t.approved
      : view?.verdict?.result === 'DENIED'
        ? t.denied
        : t.noMajority;
  return (
    <div
      className={`demo-shell anime-terminal ${film ? 'film-mode' : ''} ${!motion ? 'motion-off' : ''} ${started && !replay.playing ? 'motion-paused' : ''}`}
      data-locale={locale}
    >
      <header className="demo-header">
        <div className="command-masthead">
          <span className="nerv-mark">
            <img src="./assets/nerv-mark.svg" alt="NERV" width="64" height="73" />
          </span>
          <div>
            <strong>MAGI</strong>
            <span lang="ja">{screenCopy.system}</span>
          </div>
        </div>
        <div className="demo-links">
          <a href={repoUrl} target="_blank" rel="noreferrer">
            {t.source} ↗
          </a>
          <button
            className="demo-effects"
            data-testid="demo-effects"
            aria-label={copy.animations}
            aria-pressed={motion}
            disabled={reduced}
            title={reduced ? t.reducedMotion : undefined}
            onClick={() => setAnimations((value) => !value)}
          >
            {t.effects} {motion ? 'ON' : 'OFF'}
          </button>
          <label className="language-control">
            {t.language}
            <select
              data-testid="locale-select"
              aria-label={t.language}
              value={locale}
              onChange={(event) => changeLocale(event.target.value as Locale)}
            >
              {Object.entries(localeNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div className="demo-notice" data-testid="demo-disclosure">
        <strong>{recorded ? t.recordedBadge : t.badge}</strong>
        <span>{recorded ? t.recordedDisclosure : t.disclosure}</span>
      </div>
      <section className="demo-entry" aria-labelledby="demo-question-title">
        <div>
          <small>{recorded ? t.featured : t.example}</small>
          <h1 id="demo-question-title">{presentation.title}</h1>
          {recorded && <p>{recordingContext(locale)}</p>}
        </div>
        <div className="demo-entry-actions">
          <button className="primary" data-testid="demo-start" onClick={start}>
            ▶ {started ? t.restart : recorded ? t.recordedStart : t.start}
          </button>
          {started && (
            <button
              data-testid="demo-finish"
              onClick={() => {
                setAnswerRequested(true);
                replay.seek(replay.duration);
              }}
            >
              {t.finish} ↓
            </button>
          )}
          <small>{recorded ? t.replayNote : t.disclosure}</small>
          <a href="#install">{t.own} ↓</a>
        </div>
      </section>
      <main className="demo-main">
        <section className="demo-stage">
          <MagiScreen
            run={view}
            locale={locale}
            replay={started}
            position={started ? replay.position : undefined}
            motion={motion}
            onSelect={inspectCore}
          />
          <ol className="sequence-strip">
            {phases.map((phase, index) => (
              <li key={phase} aria-current={view?.phase === phase ? 'step' : undefined}>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <span>{phaseLabels[locale][phase]}</span>
              </li>
            ))}
          </ol>
          <div className="demo-playback">
            <button
              data-testid="demo-play"
              aria-label={
                !started
                  ? recorded
                    ? t.recordedStart
                    : t.start
                  : replay.playing
                    ? t.pause
                    : t.resume
              }
              onClick={() => {
                if (!started) start();
                else replay.toggle();
              }}
            >
              {!started ? '▶' : replay.playing ? 'Ⅱ' : '▶'}{' '}
              <span>{!started ? t.resume : replay.playing ? t.pause : t.resume}</span>
            </button>
            <input
              type="range"
              data-testid="demo-seek"
              aria-label={t.seek}
              min="0"
              max={replay.duration}
              value={started ? replay.position : 0}
              disabled={!started}
              onChange={(event) => replay.seek(Number(event.target.value))}
            />
            <time>
              {Math.floor(started ? replay.position / 1000 : 0)} /{' '}
              {Math.ceil(replay.duration / 1000)}s
            </time>
            <select
              aria-label={t.speed}
              value={replay.speed}
              onChange={(event) => replay.setSpeed(Number(event.target.value))}
            >
              {[0.5, 1, 2, 4].map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </div>
          <p className="demo-fixed">{t.fixed}</p>
        </section>
        <aside className="demo-sidebar">
          <p className="demo-kicker">{t.choose}</p>
          <div className="demo-examples">
            <button
              className="demo-featured"
              data-testid="example-recording"
              aria-pressed={recorded}
              onClick={() => changeExample('recording')}
            >
              <small>01</small>
              {t.recordedTitle}
            </button>
            <small className="demo-example-label">{t.illustrative}</small>
            {exampleIds.map((id, index) => (
              <button
                key={id}
                data-testid={`example-${id}`}
                aria-pressed={selected === id}
                onClick={() => changeExample(id)}
              >
                <small>0{index + 2}</small>
                {exampleTitle(id, locale)}
              </button>
            ))}
          </div>
          <div className="demo-proposal">
            <p>{t.intro}</p>
            {recorded && (
              <>
                <p>{t.questionSummary}</p>
                <details data-testid="original-proposal">
                  <summary>{t.originalQuestion}</summary>
                  <p lang="en">{run.question}</p>
                </details>
              </>
            )}
          </div>
          <div
            className="demo-inspector"
            data-testid="demo-inspector"
            ref={inspectorTarget}
            tabIndex={-1}
            role="region"
            aria-labelledby="demo-opinion-title"
          >
            <h2 id="demo-opinion-title">{personaInfo[persona].name}</h2>
            <div className="demo-personas">
              {PERSONAS.map((p) => (
                <button key={p} aria-pressed={persona === p} onClick={() => setPersona(p)}>
                  {personaInfo[p].name}
                </button>
              ))}
            </div>
            <small>
              {personaProfiles[persona].labels[locale].aspect} ·{' '}
              {personaProfiles[persona].labels[locale].lens}
            </small>
            <p data-testid="demo-opinion">{record?.assessment.summary || t.waiting}</p>
            {record?.assessment.responseToOthers && (
              <p className="demo-reply">{record.assessment.responseToOthers}</p>
            )}
          </div>
          <a className="demo-install-link" href="#install">
            {t.own} ↗
          </a>
          <p className="demo-local-note">{t.localRequired}</p>
        </aside>
      </main>
      {view?.verdict && (
        <section
          className={`demo-result ${view.verdict.result.toLowerCase()}`}
          data-testid="demo-result"
          aria-label={copy.report}
        >
          <b>
            {resultLabel}
            {resultLabel !== view.verdict.result && <em>{view.verdict.result}</em>}
          </b>
          <div className="demo-vote-tally">
            <span>
              {copy.votes}: {view.verdict.ratio} / 3
            </span>
            <small data-testid="demo-vote-counts">
              {view.verdict.approve} {copy.approve} / {view.verdict.deny} {copy.deny} /{' '}
              {view.verdict.abstain} {copy.abstain}
            </small>
          </div>
        </section>
      )}
      {view?.verdict && (
        <div
          className="demo-answer"
          ref={answerTarget}
          tabIndex={-1}
          data-testid="demo-answer-target"
        >
          <FinalAnswer
            run={view}
            t={copy}
            locale={locale}
            disabled
            replay
            onGenerate={() => {}}
            example={!recorded}
            recorded={recorded}
            presentation={presentation}
          />
        </div>
      )}
      <details className="demo-transcript">
        <summary>
          {t.transcript} · {view?.records.length || 0} / 12
        </summary>
        {view?.records.length ? (
          view.records.map((entry, index) => (
            <article key={index}>
              <header>
                <b>{personaInfo[entry.persona].name}</b>
                <small>{phaseLabels[locale][entry.phase]}</small>
                <span>{entry.assessment.vote}</span>
              </header>
              <p>{entry.assessment.summary}</p>
              {entry.assessment.responseToOthers && <p>{entry.assessment.responseToOthers}</p>}
            </article>
          ))
        ) : (
          <p>{t.empty}</p>
        )}
      </details>
      <section className="demo-video" aria-labelledby="demo-video-title">
        <h2 id="demo-video-title">{t.watch}</h2>
        <p>{t.videoNote}</p>
        <video
          controls
          playsInline
          preload="none"
          poster="./magi-demo-poster.png"
          src="./magi-demo.mp4"
          aria-label={t.watch}
        />
        <div>
          <a href="./magi-demo.mp4" download>
            {t.landscape} ↓
          </a>
          <a href="./magi-demo-vertical.mp4" download>
            {t.vertical} ↓
          </a>
        </div>
      </section>
      <section id="install" className="demo-install">
        <span>MAGI / LOCAL EXECUTION</span>
        <h2>{t.own}</h2>
        <p>{t.install}</p>
        <p>{t.localRequired}</p>
        <pre>
          git clone https://github.com/jhyeong687/MAGI.git{'\n'}cd MAGI{'\n'}npm ci{'\n'}npm run
          setup
        </pre>
        <p>{t.usage}</p>
        <a href={`${repoUrl}#quick-start`} target="_blank" rel="noreferrer">
          {t.source} ↗
        </a>
        <a
          href={`${repoUrl}/blob/main/docs/INSTALLATION${locale === 'ko' ? '.ko' : ''}.md`}
          target="_blank"
          rel="noreferrer"
        >
          {t.installGuide} ↗
        </a>
      </section>
      <footer className="demo-footer">
        <span>{t.privacy}</span>
        <a href={`${repoUrl}/blob/main/THIRD_PARTY_NOTICES.md`}>UNOFFICIAL FAN PROJECT / CREDITS</a>
      </footer>
      {reveal === 'showing' && view?.verdict && (
        <div className={`decision-reveal ${view.verdict.result.toLowerCase()}`} aria-hidden="true">
          <span>MAGI SYSTEM / 決議終了</span>
          <b lang="ja">
            {view.verdict.result === 'APPROVED'
              ? '可決'
              : view.verdict.result === 'DENIED'
                ? '否決'
                : '保留'}
          </b>
          <strong>{view.verdict.result}</strong>
        </div>
      )}
    </div>
  );
}
