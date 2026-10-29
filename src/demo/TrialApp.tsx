import { useEffect, useRef, useState } from 'react';
import {
  PERSONAS,
  personaInfo,
  personaProfiles,
  type Locale,
  type Persona,
  type Run,
} from '../../shared/domain.ts';
import type { TrialStatus, TrialCode } from '../../cloudflare/policy.ts';
import { validQuestion, TRIAL_POLICY } from '../../cloudflare/policy.ts';
import MagiScreen from '../MagiScreen.tsx';
import DeliberationStatus from '../DeliberationStatus.tsx';
import FinalAnswer from '../FinalAnswer.tsx';
import { copies, phaseLabels } from '../i18n.ts';
import { localeNames } from '../displayCopy.ts';
import { screenCopy } from '../screenCopy.ts';
import { repoUrl } from '../shareCopy.ts';
import { demoCopies } from './copy.ts';
import { trialCopies } from './trialCopy.ts';
import { trialEndpoint, trialRun, trialStatus, TrialClientError } from './trialClient.ts';
import './trial.css';
const phases = [
  'independent',
  'cross-examination',
  'reconsideration',
  'final-vote',
  'report',
] as const;
export default function TrialApp({
  locale,
  onLocale,
  onBack,
}: {
  locale: Locale;
  onLocale: (value: Locale) => void;
  onBack: () => void;
}) {
  const t = trialCopies[locale],
    copy = copies[locale];
  const [api, setApi] = useState(''),
    [checking, setChecking] = useState(true),
    [status, setStatus] = useState<TrialStatus | null>(null);
  const [question, setQuestion] = useState(() => {
    try {
      return sessionStorage.getItem('magi-trial-question') || '';
    } catch {
      return '';
    }
  });
  const [run, setRun] = useState<Run | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<TrialCode | ''>('');
  const [persona, setPersona] = useState<Persona>('melchior'),
    [now, setNow] = useState(Date.now());
  const [animations, setAnimations] = useState(
    () => localStorage.getItem('magi-demo-animations') !== 'off',
  );
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const controller = useRef<AbortController | null>(null),
    locked = useRef(false),
    answerTarget = useRef<HTMLElement>(null);
  const opinionTarget = useRef<HTMLDivElement>(null);
  const motion = animations && !reduced;
  useEffect(() => {
    const abort = new AbortController();
    fetch('./trial-config.json', { cache: 'no-store', signal: abort.signal })
      .then((r) => r.json())
      .then(async (value) => {
        const endpoint = trialEndpoint(value.apiUrl);
        setApi(endpoint);
        if (endpoint) setStatus(await trialStatus(endpoint, abort.signal));
      })
      .catch(() => {
        if (!abort.signal.aborted) setError('unavailable');
      })
      .finally(() => {
        if (!abort.signal.aborted) setChecking(false);
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    localStorage.setItem('magi-demo-animations', animations ? 'on' : 'off');
  }, [animations]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (run?.answer?.status === 'completed') {
      answerTarget.current?.focus({ preventScroll: true });
      answerTarget.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [run?.answer?.status]);
  async function refresh() {
    if (!api) return;
    setChecking(true);
    setError('');
    try {
      setStatus(await trialStatus(api));
    } catch {
      setError('unavailable');
    } finally {
      setChecking(false);
    }
  }
  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current || !api || !validQuestion(question) || !status?.available) return;
    locked.current = true;
    setBusy(true);
    setRun(null);
    setError('');
    setNow(Date.now());
    const abort = new AbortController();
    controller.current = abort;
    try {
      await trialRun(api, question.trim(), locale, abort.signal, setRun, setStatus);
    } catch (reason) {
      const code = abort.signal.aborted
        ? 'disconnected'
        : reason instanceof TrialClientError
          ? reason.code
          : 'disconnected';
      setError(abort.signal.aborted ? '' : code);
      setRun((previous) => {
        if (!previous || previous.status !== 'running') return previous;
        const ended = structuredClone(previous);
        ended.completedAt = new Date().toISOString();
        if (ended.verdict && ended.answer) {
          ended.status = 'completed';
          ended.answer.status = 'cancelled';
        } else {
          ended.status = abort.signal.aborted ? 'cancelled' : 'error';
          ended.error = code;
          for (const p of PERSONAS) if (!ended.cores[p].finalVote) ended.cores[p].state = 'ERROR';
        }
        return ended;
      });
    } finally {
      locked.current = false;
      setBusy(false);
      controller.current = null;
      try {
        setStatus(await trialStatus(api));
      } catch {
        setStatus(null);
      }
    }
  }
  const record = run?.records.findLast((entry) => entry.persona === persona);
  const failure = error || run?.error || run?.answer?.error || status?.code;
  const errorText =
    failure && Object.hasOwn(t.errors, failure) ? t.errors[failure as TrialCode] : '';
  return (
    <div
      className={`demo-shell anime-terminal trial-shell ${!motion ? 'motion-off' : ''}`}
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
            GitHub ↗
          </a>
          <button onClick={onBack} disabled={busy}>
            {t.back}
          </button>
          <button
            aria-pressed={motion}
            disabled={reduced}
            onClick={() => setAnimations((value) => !value)}
          >
            {copy.animations} {motion ? 'ON' : 'OFF'}
          </button>
          <label className="language-control">
            {demoCopies[locale].language}
            <select
              data-testid="trial-locale"
              aria-label={demoCopies[locale].language}
              value={locale}
              disabled={busy}
              onChange={(e) => onLocale(e.target.value as Locale)}
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
      <div className="demo-notice trial-notice">
        <strong>{t.badge}</strong>
        <span>{t.intro}</span>
      </div>
      <section className="trial-entry">
        <h1>{t.title}</h1>
        <form onSubmit={start} data-testid="trial-form">
          <label htmlFor="trial-question">{t.question}</label>
          <textarea
            id="trial-question"
            data-testid="trial-question"
            value={question}
            disabled={busy}
            rows={4}
            placeholder={t.placeholder}
            onChange={(e) => {
              setQuestion(e.target.value);
              try {
                sessionStorage.setItem('magi-trial-question', e.target.value);
              } catch {}
            }}
          />
          <div className="trial-form-meta">
            <span className={!validQuestion(question) && question ? 'error-text' : ''}>
              {Array.from(question).length} / {TRIAL_POLICY.questionCharacters} {t.character} ·{' '}
              {new TextEncoder().encode(question).length} / 2,400 bytes
            </span>
            <div>
              <button
                type="submit"
                className="primary"
                data-testid="trial-start"
                disabled={
                  busy || checking || !api || !status?.available || !validQuestion(question)
                }
              >
                {t.start}
              </button>
              {busy && (
                <button
                  type="button"
                  data-testid="trial-stop"
                  onClick={() => controller.current?.abort()}
                >
                  {t.stop}
                </button>
              )}
            </div>
          </div>
        </form>
        {checking ? (
          <p role="status">{t.loading}</p>
        ) : !api ? (
          <p role="status" data-testid="trial-setup">
            {t.setup}
          </p>
        ) : (
          <div className="trial-quota" data-testid="trial-quota">
            <span>
              {t.started}: <b>{status?.startedToday ?? '—'}</b>
            </span>
            <span>
              {t.personal}: <b>{status?.remainingForIp ?? '—'}</b> {t.slots}
            </span>
            {status && (
              <span>
                {t.reset}:{' '}
                <time dateTime={status.resetsAt}>
                  {new Date(status.resetsAt).toLocaleString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                    month: 'short',
                    day: 'numeric',
                    timeZoneName: 'short',
                  })}
                </time>
              </span>
            )}
            <button onClick={refresh} disabled={busy || checking}>
              {t.refresh}
            </button>
          </div>
        )}
        {errorText && (
          <p role="alert" className="error-text" data-testid="trial-error">
            {errorText}
          </p>
        )}
        <p className="trial-small">
          {t.limits} {t.quotaNote}
        </p>
        <p className="trial-small">{t.provider}</p>
        <p className="trial-privacy">
          {t.privacy}{' '}
          <a
            href="https://developers.cloudflare.com/workers-ai/platform/data-usage/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare ↗
          </a>
        </p>
      </section>
      <main className="demo-main">
        <section className="demo-stage">
          <MagiScreen
            run={run}
            locale={locale}
            motion={motion}
            replay={false}
            onSelect={(p) => {
              setPersona(p);
              opinionTarget.current?.focus({ preventScroll: true });
              opinionTarget.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
            }}
          />
          <ol className="sequence-strip">
            {phases.map((phase, i) => (
              <li key={phase} aria-current={run?.phase === phase ? 'step' : undefined}>
                <small>0{i + 1}</small>
                <span>{phaseLabels[locale][phase]}</span>
              </li>
            ))}
          </ol>
          <DeliberationStatus
            run={run}
            locale={locale}
            now={now}
            elapsedSeconds={
              run
                ? (Date.parse(run.completedAt || new Date(now).toISOString()) -
                    Date.parse(run.createdAt)) /
                  1000
                : 0
            }
          />
        </section>
        <aside className="demo-sidebar">
          <div
            className="demo-inspector"
            tabIndex={-1}
            ref={opinionTarget}
            role="region"
            aria-label={t.transcript}
          >
            <h2>{personaInfo[persona].name}</h2>
            <div className="demo-personas">
              {PERSONAS.map((p) => (
                <button key={p} aria-pressed={p === persona} onClick={() => setPersona(p)}>
                  {personaInfo[p].name}
                </button>
              ))}
            </div>
            <small>
              {personaProfiles[persona].labels[locale].aspect} ·{' '}
              {personaProfiles[persona].labels[locale].lens}
            </small>
            <p data-testid="trial-opinion">{record?.assessment.summary || t.empty}</p>
            {record?.assessment.responseToOthers && (
              <p className="demo-reply">{record.assessment.responseToOthers}</p>
            )}
          </div>
        </aside>
      </main>
      {run?.verdict && (
        <section
          className={`demo-result ${run.verdict.result.toLowerCase()}`}
          data-testid="trial-verdict"
          ref={answerTarget}
          tabIndex={-1}
          role="region"
          aria-label={t.result}
        >
          <b>{run.verdict.result}</b>
          <div className="demo-vote-tally">
            <span>
              {copy.votes}: {run.verdict.ratio} / 3
            </span>
            <small>
              {run.verdict.approve} {copy.approve} / {run.verdict.deny} {copy.deny} /{' '}
              {run.verdict.abstain} {copy.abstain}
            </small>
          </div>
        </section>
      )}
      {run?.verdict && (
        <div className="demo-answer">
          <FinalAnswer
            run={run}
            t={copy}
            locale={locale}
            onGenerate={() => {}}
            disabled
            replay={false}
          />
        </div>
      )}
      <details className="demo-transcript" data-testid="trial-transcript">
        <summary>
          {t.transcript} · {run?.records.length || 0} / 12
        </summary>
        {run?.records.map((entry, index) => (
          <article key={index}>
            <header>
              <b>{personaInfo[entry.persona].name}</b>
              <small>{phaseLabels[locale][entry.phase]}</small>
              <span>{entry.assessment.vote}</span>
            </header>
            <p>{entry.assessment.summary}</p>
            {entry.assessment.rationale.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            {entry.assessment.responseToOthers && <p>{entry.assessment.responseToOthers}</p>}
          </article>
        ))}
      </details>
      <footer className="demo-footer">
        <button onClick={onBack} disabled={busy}>
          {t.useDemo}
        </button>
        <a href={`${repoUrl}/blob/main/docs/CLOUD_TRIAL.md`}>FREE TRIAL / LIMITS</a>
        <span>UNOFFICIAL FAN PROJECT</span>
      </footer>
    </div>
  );
}
