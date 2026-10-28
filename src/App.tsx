import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  PERSONAS,
  modelCallCount,
  personaCallCount,
  defaultPrompts,
  personaInfo,
  personaProfiles,
  type Run,
  type Settings,
  type Environment,
  type Persona,
  type Locale,
  type Assessment,
  type Phase,
} from '../shared/domain.ts';
import { copies, phaseLabels, type Copy } from './i18n.ts';
import MagiScreen from './MagiScreen.tsx';
import FinalAnswer from './FinalAnswer.tsx';
import AuthPanel from './AuthPanel.tsx';
import { corePresentation, playbackTimeline } from './process.ts';
import { useReplay } from './useReplay.ts';
import { useCouncil } from './useCouncil.ts';
import { request } from './api.ts';
import { useSound } from './useSound.ts';
import { serviceCopies } from './serviceCopy.ts';
import { displayCopies, localeNames, coreLabel } from './displayCopy.ts';
import { screenCopy } from './screenCopy.ts';

const phases: Phase[] = [
  'independent',
  'cross-examination',
  'reconsideration',
  'final-vote',
  'report',
];
const clockText = (at: string | number, _locale: Locale) =>
  new Date(at).toLocaleTimeString('en-GB', { hour12: false });
function Modal({
  title,
  onClose,
  children,
  wide = false,
  closeLabel = 'Close',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (
          e.target === ref.current &&
          rect &&
          (e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom)
        )
          onClose();
      }}
    >
      <div className="modal-heading">
        <span id={titleId}>{title}</span>
        <button className="icon-button" aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Boot({ close, skip, locale }: { close: () => void; skip: string; locale: Locale }) {
  const dc = displayCopies[locale];
  const lines = [
    `MAGI / ${dc.bootTitle}`,
    `MELCHIOR-1 · ${dc.bootPersonality}`,
    `BALTHASAR-2 · ${dc.bootPersonality}`,
    `CASPER-3 · ${dc.bootPersonality}`,
    dc.bootInterface,
    dc.bootReady,
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => s + 1), 230);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (step > lines.length + 1) close();
  }, [step, close]);
  return (
    <div className="boot-screen">
      <div className="boot-mark">
        MAGI<span>{dc.system}</span>
      </div>
      <div className="boot-terminal">
        <p>
          {dc.bootTitle}
          <span className="cursor">_</span>
        </p>
        {lines.slice(0, step).map((line, i) => (
          <div key={line}>
            <span>{String(i).padStart(2, '0')}</span> {line} <b>[ OK ]</b>
          </div>
        ))}
      </div>
      <button onClick={close}>{skip} ↗</button>
      <small>{dc.bootHint}</small>
    </div>
  );
}
function AssessmentView({ assessment, t }: { assessment: Assessment; t: Copy }) {
  return (
    <div className="assessment-content">
      <p className="assessment-summary">{assessment.summary}</p>
      <h4>{t.rationale}</h4>
      <ul>
        {assessment.rationale.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>
      {assessment.risks.length > 0 && (
        <>
          <h4>{t.risks}</h4>
          <ul>
            {assessment.risks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </>
      )}
      {assessment.responseToOthers && (
        <>
          <h4>{t.response}</h4>
          <p>{assessment.responseToOthers}</p>
        </>
      )}
      <div className="confidence">
        {t.confidence}
        <b>{assessment.confidence}%</b>
      </div>
    </div>
  );
}
function Configuration({
  settings,
  environment,
  t,
  onSave,
  onClose,
  onRecheck,
}: {
  settings: Settings;
  environment: Environment | null;
  t: Copy;
  onSave: (s: Settings) => Promise<void>;
  onClose: () => void;
  onRecheck: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(structuredClone(settings));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={`MAGI_SYS / ${t.settings}`} onClose={onClose} closeLabel={t.close} wide>
      <form onSubmit={save} className="config-form">
        <div className="config-grid">
          <label>
            {t.rounds}
            <select
              value={draft.discussionRounds}
              onChange={(e) => setDraft({ ...draft, discussionRounds: Number(e.target.value) })}
            >
              {[1, 2, 3].map((n) => (
                <option value={n} key={n}>
                  {n} · {modelCallCount(n)} {t.calls}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.timeout}
            <input
              type="number"
              min={15}
              max={300}
              required
              value={draft.timeoutSeconds}
              onChange={(e) => setDraft({ ...draft, timeoutSeconds: e.target.valueAsNumber })}
            />
          </label>
          <label>
            {t.language}
            <select
              value={draft.locale}
              onChange={(e) => setDraft({ ...draft, locale: e.target.value as Locale })}
            >
              {Object.entries(localeNames).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-label">
            <span>{t.animations}</span>
            <input
              type="checkbox"
              checked={draft.animations}
              onChange={(e) => setDraft({ ...draft, animations: e.target.checked })}
            />
            <b>{draft.animations ? 'ON' : 'OFF'}</b>
          </label>
          <label className="toggle-label">
            <span>{t.sound}</span>
            <input
              type="checkbox"
              checked={draft.sound}
              onChange={(e) => setDraft({ ...draft, sound: e.target.checked })}
            />
            <b>{draft.sound ? 'ON' : 'OFF'}</b>
          </label>
        </div>
        <p className="muted">{t.cycleHint}</p>
        <div className="section-heading">
          <h3>{t.prompts}</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => setDraft({ ...draft, prompts: { ...defaultPrompts } })}
          >
            {t.reset} ↺
          </button>
        </div>
        {PERSONAS.map((p) => (
          <label className="prompt-label" key={p}>
            <span>
              {personaInfo[p].name} <small>{personaInfo[p].role}</small>
            </span>
            <small className="persona-context">
              {personaProfiles[p].labels[draft.locale].aspect} ·{' '}
              {personaProfiles[p].labels[draft.locale].lens}
            </small>
            <textarea
              required
              minLength={20}
              maxLength={6000}
              rows={4}
              value={draft.prompts[p]}
              onChange={(e) =>
                setDraft({ ...draft, prompts: { ...draft.prompts, [p]: e.target.value } })
              }
            />
          </label>
        ))}
        <details className="environment-details">
          <summary>
            {t.environment}{' '}
            <span className={environment?.ready ? 'green' : 'red'}>
              {environment?.ready ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </summary>
          <p>{environment?.version || '—'}</p>
          <code>{environment?.binary || '—'}</code>
          <p>
            AUTH: {environment?.auth || '—'} / {environment?.capabilities.join(' · ')}
          </p>
          {environment?.issues.map((issue, i) => (
            <p className="muted" key={i}>
              {issue}
            </p>
          ))}
          <p>{t.usage}</p>
          <button
            disabled={checking}
            type="button"
            onClick={async () => {
              setChecking(true);
              try {
                await onRecheck();
              } catch (err) {
                setError(String(err));
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? '…' : t.recheck}
          </button>
        </details>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <small>{t.settingsNext}</small>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? '…' : t.save} ↗
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function App() {
  const {
    settings,
    setSettings,
    environment,
    setEnvironment,
    run,
    history,
    error,
    setError,
    connected: streamConnected,
    chooseRun,
    updateRun,
    clearRun,
    pinCurrent,
  } = useCouncil();
  const replay = useReplay(run);
  const view = replay.view;
  const [question, setQuestion] = useState(
    () => localStorage.getItem('magi-proposal-draft')?.slice(0, 6000) || '',
  );
  const [historyQuery, setHistoryQuery] = useState('');
  const [stopping, setStopping] = useState(false);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'command' | 'archive'>('command');
  const [showConfig, setShowConfig] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [cinema, setCinema] = useState(
    () => new URLSearchParams(location.search).get('cinema') === '1',
  );
  const [selected, setSelected] = useState<Persona | null>(null);
  const [sending, setSending] = useState(false);
  const [reveal, setReveal] = useState<'APPROVED' | 'DENIED' | 'INCONCLUSIVE' | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const motion = settings.animations && !reducedMotion;
  const unlockSound = useSound(settings.sound, view, !replay.enabled || replay.playing);
  const [boot, setBoot] = useState(
    () =>
      !sessionStorage.getItem('magi-booted') &&
      localStorage.getItem('magi-animation') !== 'off' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const logRef = useRef<HTMLDivElement>(null);
  const proposalRef = useRef<HTMLTextAreaElement>(null);
  const [followLog, setFollowLog] = useState(true);
  const locale = copies[settings.locale] ? settings.locale : 'ja';
  const t = copies[locale];
  const ui = serviceCopies[locale];
  const dc = displayCopies[locale];
  const filteredHistory = history.filter((item) =>
    item.question.toLocaleLowerCase(locale).includes(historyQuery.trim().toLocaleLowerCase(locale)),
  );
  const active = history.find((h) => h.status === 'running');
  const running = run?.status === 'running';
  const busy = Boolean(active) || running;
  const calls = modelCallCount(settings.discussionRounds);
  const ready = Boolean(environment?.ready && streamConnected);
  const result = view?.verdict;
  const answerGenerating = view?.answer?.status === 'generating';
  const currentPhase = view ? phases.indexOf(view.phase) : -1;
  const dismissBoot = () => {
    sessionStorage.setItem('magi-booted', '1');
    setBoot(false);
  };
  useEffect(() => {
    if (question) localStorage.setItem('magi-proposal-draft', question);
    else localStorage.removeItem('magi-proposal-draft');
  }, [question]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
    localStorage.setItem('magi-locale', locale);
    localStorage.setItem('magi-animation', settings.animations ? 'on' : 'off');
  }, [locale, settings.animations]);
  useEffect(() => {
    const url = new URL(location.href);
    if (cinema) url.searchParams.set('cinema', '1');
    else url.searchParams.delete('cinema');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [cinema]);
  useEffect(() => {
    if (followLog && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [view?.records.length, followLog, showTranscript]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!reveal) return;
    const timer = setTimeout(() => setReveal(null), 1800);
    return () => clearTimeout(timer);
  }, [reveal]);
  const previousView = useRef<{ id: string; status: string } | null>(null);
  useEffect(() => {
    if (
      view?.status === 'completed' &&
      view.verdict &&
      previousView.current?.id === view.id &&
      previousView.current.status === 'running'
    )
      setReveal(view.verdict.result);
    previousView.current = view ? { id: view.id, status: view.status } : null;
  }, [view?.id, view?.status]);
  useEffect(() => {
    const fullscreen = () => {
      if (!document.fullscreenElement) setCinema(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('dialog[open]')
      )
        setCinema(false);
    };
    document.addEventListener('fullscreenchange', fullscreen);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreen);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!question.trim() || busy || sending || !ready || switchingLocale) return;
    setSending(true);
    setError('');
    try {
      const value = await request<Run>('/api/runs', {
        method: 'POST',
        body: JSON.stringify({ question: question.trim() }),
      });
      updateRun(value);
      setQuestion('');
      setTab('command');
      setFollowLog(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }
  async function stop() {
    if (!run || stopping) return;
    setStopping(true);
    try {
      updateRun(await request<Run>(`/api/runs/${run.id}/cancel`, { method: 'POST', body: '{}' }));
    } catch (err) {
      setError(String(err));
    } finally {
      setStopping(false);
    }
  }
  async function openRun(id: string) {
    try {
      replay.stop();
      setError('');
      await chooseRun(id);
      setTab('command');
      setFollowLog(true);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(String(err));
    }
  }
  function newDecision() {
    if (busy) return;
    setReveal(null);
    replay.stop();
    clearRun();
    setError('');
    setTab('command');
    requestAnimationFrame(() => {
      proposalRef.current?.focus();
      proposalRef.current?.scrollIntoView({
        block: 'center',
        behavior: motion ? 'smooth' : 'auto',
      });
    });
  }
  async function saveSettings(value: Settings) {
    if (value.sound) unlockSound();
    const saved = await request<Settings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(value),
    });
    setSettings(saved);
    setNotice(copies[saved.locale].saved);
  }
  async function changeLocale(next: Locale) {
    if (switchingLocale || next === locale) return;
    setSwitchingLocale(true);
    try {
      await saveSettings({ ...settings, locale: next });
    } catch (err) {
      setError(String(err));
    } finally {
      setSwitchingLocale(false);
    }
  }
  function showFinalAnswer() {
    setCinema(false);
    requestAnimationFrame(() =>
      document
        .querySelector('[data-testid="final-report"]')
        ?.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'start' }),
    );
  }
  async function generateAnswer(refresh = false) {
    if (!run || busy || sending || replay.enabled || !ready) return;
    setSending(true);
    setError('');
    try {
      updateRun(
        await request<Run>(`/api/runs/${run.id}/answer`, {
          method: 'POST',
          body: JSON.stringify({ refresh }),
        }),
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  }
  async function recheck() {
    setEnvironment(await request<Environment>('/api/environment?refresh=1'));
  }
  const lastFrame = run ? playbackTimeline(run).at(-1) : undefined;
  const elapsed = Math.floor(
    (replay.enabled
      ? replay.position
      : lastFrame
        ? lastFrame.offset +
          (run?.status === 'running' ? Math.max(0, now - Date.parse(lastFrame.event.at)) : 0)
        : 0) / 1000,
  );
  const totalTokens = view
    ? (view.answer?.usage.inputTokens || 0) +
      (view.answer?.usage.outputTokens || 0) +
      PERSONAS.reduce(
        (sum, p) => sum + view.cores[p].usage.inputTokens + view.cores[p].usage.outputTokens,
        0,
      )
    : 0;

  return (
    <div
      className={`app-shell anime-terminal ${cinema ? 'cinema-mode' : ''} ${result ? 'has-final-answer' : ''} ${!motion ? 'motion-off' : ''} ${replay.enabled && !replay.playing ? 'motion-paused' : ''}`}
      data-sound={settings.sound ? 'on' : 'off'}
      data-locale={locale}
    >
      {cinema && (
        <nav className="cinema-dock" aria-label="Cinema controls">
          <span className="dock-phase">
            {answerGenerating ? t.answerPhase : view ? phaseLabels[locale][view.phase] : t.standby}{' '}
            · {view?.records.length || 0} {dc.responses}
          </span>
          {active && active.id !== run?.id && (
            <button onClick={() => void openRun(active.id)}>● {t.active}</button>
          )}
          {running && (
            <button onClick={() => void stop()}>{answerGenerating ? t.stopAnswer : t.stop}</button>
          )}
          {result && <button onClick={showFinalAnswer}>{t.finalAnswer} ↓</button>}
          {replay.enabled ? (
            <button data-testid="cinema-replay-toggle" onClick={replay.toggle}>
              {replay.playing ? 'Ⅱ' : '▶'} {t.replay}
            </button>
          ) : (
            run &&
            !running && (
              <button
                onClick={() => {
                  pinCurrent();
                  replay.play();
                }}
              >
                ▷ {t.replay}
              </button>
            )
          )}
          <button onClick={() => setShowTranscript(true)}>{t.stream}</button>
          <button onClick={() => setShowConfig(true)}>{t.settings}</button>
          <button
            className="sound-button"
            aria-label={t.sound}
            aria-pressed={settings.sound}
            onClick={() =>
              void saveSettings({ ...settings, sound: !settings.sound }).catch((err) =>
                setError(String(err)),
              )
            }
          >
            {settings.sound ? '♪ ON' : '♪ OFF'}
          </button>
          <button
            aria-label={t.close}
            onClick={() => {
              setCinema(false);
              if (document.fullscreenElement) void document.exitFullscreen();
            }}
          >
            ⛶ {t.close} / ESC
          </button>
        </nav>
      )}
      {motion && <div className="crt-overlay" aria-hidden="true" />}
      {motion && reveal && (
        <div className={`decision-reveal ${reveal.toLowerCase()}`} aria-hidden="true">
          <span lang="ja">MAGI SYSTEM / {screenCopy.completed}</span>
          <b lang="ja">
            {reveal === 'APPROVED'
              ? screenCopy.approved
              : reveal === 'DENIED'
                ? screenCopy.denied
                : screenCopy.inconclusive}
          </b>
          <strong>{reveal}</strong>
        </div>
      )}
      <header className="operator-toolbar">
        <div className="command-masthead">
          <span className="nerv-mark">
            <img src="/assets/nerv-mark.svg" alt="NERV" width="64" height="73" />
          </span>
          <div>
            <strong>MAGI</strong>
            <span lang="ja">{screenCopy.system}</span>
          </div>
          <p>
            OPERATIONS CONTROL
            <small>
              {ui.operations} / {t.local}
            </small>
          </p>
        </div>
        <div className="toolbar-side">
          <div className={`link-status ${ready ? 'connected' : ''}`} role="status">
            <i />
            <span>MAGI_SYS</span>
            <small>
              {environment
                ? !environment.ready
                  ? t.offline
                  : streamConnected
                    ? t.online
                    : t.linkError
                : t.checking}
            </small>
          </div>
          <label className="language-control" title={dc.languageHint}>
            <span>{dc.language}</span>
            <select
              data-testid="locale-select"
              aria-label={dc.language}
              value={locale}
              disabled={switchingLocale || sending}
              onChange={(event) => void changeLocale(event.target.value as Locale)}
            >
              {Object.entries(localeNames).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="tabs" aria-label="MAGI controls">
          {result && (
            <button data-testid="jump-answer" onClick={showFinalAnswer}>
              {t.finalAnswer} ↓
            </button>
          )}
          <button className="new-button" onClick={newDecision} disabled={busy}>
            ＋ {t.newDecision}
          </button>
          <button data-testid="open-transcript" onClick={() => setShowTranscript(true)}>
            {t.stream} <small>{String(view?.records.length || 0).padStart(2, '0')}</small>
          </button>
          <button data-testid="open-history" onClick={() => setTab('archive')}>
            {t.history}
          </button>
          <button data-testid="open-config" onClick={() => setShowConfig(true)}>
            {t.settings}
          </button>
          <button
            className="sound-button"
            aria-label={t.sound}
            aria-pressed={settings.sound}
            onClick={() =>
              void saveSettings({ ...settings, sound: !settings.sound }).catch((err) =>
                setError(String(err)),
              )
            }
          >
            {settings.sound ? '♪ ON' : '♪ OFF'}
          </button>
          <button
            className="fullscreen-button"
            title={t.fullscreen}
            aria-label={t.fullscreen}
            onClick={() => {
              setCinema(true);
            }}
          >
            ⛶
          </button>
        </nav>
      </header>
      {error && (
        <div className="alert" role="alert">
          <b>{dc.notice}</b>
          <span>{error}</span>
          <button className="icon-button" aria-label={t.close} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {active && active.id !== run?.id && (
        <button className="active-link" onClick={() => void openRun(active.id)}>
          ● {t.active} ↗
        </button>
      )}
      {environment && !environment.ready && (
        <AuthPanel environment={environment} locale={locale} onReady={setEnvironment} busy={busy} />
      )}
      {run && run.settings.locale !== locale && <p className="language-note">{dc.languageHint}</p>}
      <main className="operator-main">
        <section className="screen-stage" aria-label="MAGI display">
          <MagiScreen
            run={view}
            locale={locale}
            replay={replay.enabled}
            position={replay.enabled ? replay.position : undefined}
            motion={motion}
            onSelect={setSelected}
          />
          <div className="process-monitor" aria-live="polite" data-testid="process-monitor">
            <span>
              {replay.enabled ? dc.recorded : view?.status === 'running' ? t.live : 'MAGI 01'}
            </span>
            <strong>
              {view
                ? view.status === 'cancelled'
                  ? dc.stopped
                  : view.status === 'error'
                    ? dc.error
                    : answerGenerating
                      ? t.answerPhase
                      : phaseLabels[locale][view.phase]
                : t.standby}
            </strong>
            <span>
              {view
                ? `${view.records.length} / ${personaCallCount(view.settings.discussionRounds)}`
                : '0 / 0'}{' '}
              {dc.responses}
            </span>
          </div>
          <ol className="sequence-strip" aria-label={ui.steps}>
            {phases.map((phase, index) => (
              <li
                key={phase}
                aria-current={view && currentPhase === index ? 'step' : undefined}
                className={view && currentPhase > index ? 'stage-done' : ''}
              >
                <small>{String(index + 1).padStart(2, '0')}</small>
                <span>{phaseLabels[locale][phase]}</span>
              </li>
            ))}
          </ol>
          <div className="core-status-strip">
            {PERSONAS.map((persona) => {
              const status = corePresentation(view, persona);
              return (
                <button
                  key={persona}
                  onClick={() => setSelected(persona)}
                  className={status.pending ? 'core-working' : ''}
                >
                  <span>{personaInfo[persona].name}</span>
                  <b>{coreLabel(status.label, locale)}</b>
                </button>
              );
            })}
          </div>
          <p className="inspection-hint">{ui.selected}</p>
        </section>
        <section className="operator-console">
          {replay.enabled && (
            <div className="replay-controls" data-testid="replay-controls">
              <span>{t.replayLabel}</span>
              <button onClick={replay.toggle}>{replay.playing ? 'Ⅱ' : '▶'}</button>
              <input
                aria-label={t.replaySeek}
                type="range"
                min="0"
                max={replay.duration}
                value={replay.position}
                onChange={(event) => replay.seek(Number(event.target.value))}
              />
              <time>
                {Math.floor(replay.position / 1000)} / {Math.ceil(replay.duration / 1000)}s
              </time>
              <select
                aria-label={t.replaySpeed}
                value={replay.speed}
                onChange={(event) => replay.setSpeed(Number(event.target.value))}
              >
                {[0.5, 1, 2, 4].map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}×
                  </option>
                ))}
              </select>
              <button onClick={replay.stop}>{t.close}</button>
            </div>
          )}
          {run && run.status !== 'running' && !replay.enabled && (
            <div className="record-controls">
              <span title={run.question}>{run.question}</span>
              <button
                data-testid="replay-start"
                onClick={() => {
                  pinCurrent();
                  replay.play();
                }}
              >
                ▷ {t.replay}
              </button>
            </div>
          )}
          {result && (
            <div
              className={`vote-summary ${result.result.toLowerCase()}`}
              data-testid="final-report"
              aria-live="polite"
            >
              <b>
                <small>{t.report}</small>
                {
                  ui[
                    result.result === 'APPROVED'
                      ? 'approved'
                      : result.result === 'DENIED'
                        ? 'denied'
                        : 'inconclusive'
                  ]
                }
                <em>{result.result}</em>
              </b>
              <span>
                {t.votes}: <strong>{result.ratio} / 3</strong>
              </span>
              <small>
                {result.approve} {t.approve} / {result.deny} {t.deny} / {result.abstain} {t.abstain}
              </small>
            </div>
          )}
          {result && view && (
            <FinalAnswer
              run={view}
              t={t}
              locale={locale}
              onGenerate={(refresh) => void generateAnswer(refresh)}
              disabled={busy || sending || !ready}
              replay={replay.enabled}
            />
          )}
          {run?.status === 'cancelled' && !replay.enabled && (
            <div className="status-banner cancelled" role="status">
              <b>ABORTED</b>
              <span>{t.cancelled}</span>
            </div>
          )}
          {run?.status === 'error' && !replay.enabled && (
            <div className="status-banner failed" role="alert">
              <b>SYSTEM ERROR</b>
              <span>{run.error}</span>
              <button
                onClick={() => {
                  setQuestion(run.question);
                  clearRun();
                  proposalRef.current?.focus();
                }}
              >
                {ui.prepareRetry}
              </button>
            </div>
          )}
          <div className="proposal-heading">
            <span>INPUT / {ui.proposal}</span>
            <small>
              {running ? `${ui.round} ${run.round}` : question ? ui.draft : ui.shortcut}
            </small>
          </div>
          <form className="proposal-console" onSubmit={submit}>
            <label htmlFor="proposal">
              {t.question}
              <small>QUESTION:</small>
            </label>
            <textarea
              id="proposal"
              ref={proposalRef}
              maxLength={6000}
              rows={1}
              aria-describedby="proposal-help"
              placeholder={t.placeholder}
              value={running ? run.question : question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={Boolean(busy)}
              onKeyDown={(event) => {
                if (
                  (event.ctrlKey || event.metaKey) &&
                  event.key === 'Enter' &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            {running ? (
              <button
                type="button"
                className="abort-button"
                onClick={() => void stop()}
                title={t.stopHint}
                disabled={stopping}
              >
                ■ {stopping ? ui.stopping : answerGenerating ? t.stopAnswer : t.stop}
              </button>
            ) : (
              <button
                className="primary"
                type="submit"
                disabled={!question.trim() || !ready || busy || sending || switchingLocale}
              >
                {sending ? 'CONNECTING…' : t.execute} ↵
              </button>
            )}
          </form>
          <div className="proposal-help" id="proposal-help">
            <span>
              {ui.shortcut} · {(running ? run.question : question).length.toLocaleString()} / 6,000
            </span>
            {!busy && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(ui.sample);
                    proposalRef.current?.focus();
                  }}
                >
                  {ui.example}
                </button>
                {question && (
                  <button type="button" onClick={() => setQuestion('')}>
                    {ui.clear}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="console-footnote">
            <span>
              {calls} {t.calls} · {t.usage}
            </span>
            <span>
              {view
                ? `${currentPhase + 1}/5 · ${answerGenerating ? t.answerPhase : phaseLabels[locale][view.phase]}`
                : 'EX_MODE:OFF'}
            </span>
          </div>
          {!streamConnected && (
            <p role="status" className="connection-warning">
              {t.linkError}
            </p>
          )}
          {environment && !environment.ready && (
            <div className="offline-help">
              <span>{t.login}</span>
              <code>npm run doctor</code>
              <button onClick={() => setShowConfig(true)}>{t.environment} ↗</button>
            </div>
          )}
        </section>
      </main>
      {boot && <Boot close={dismissBoot} skip={t.bootSkip} locale={locale} />}
      {showConfig && (
        <Configuration
          settings={settings}
          environment={environment}
          t={t}
          onSave={saveSettings}
          onClose={() => setShowConfig(false)}
          onRecheck={recheck}
        />
      )}
      {tab === 'archive' && (
        <Modal
          title={`MAGI_SYS / ${t.history}`}
          onClose={() => setTab('command')}
          closeLabel={t.close}
          wide
        >
          <section className="archive-panel">
            <input
              className="archive-search"
              type="search"
              aria-label={ui.search}
              placeholder={ui.search}
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
            />
            {history.length === 0 ? (
              <p className="empty-state">{t.noRecords}</p>
            ) : filteredHistory.length === 0 ? (
              <p className="empty-state">{ui.noMatches}</p>
            ) : (
              <div className="archive-list">
                {filteredHistory.map((item) => (
                  <button key={item.id} onClick={() => void openRun(item.id)}>
                    <span>{String(history.length - history.indexOf(item)).padStart(3, '0')}</span>
                    <div>
                      <strong>{item.question}</strong>
                      <time>{new Date(item.createdAt).toLocaleString(locale)}</time>
                    </div>
                    <b className={item.result?.toLowerCase()}>
                      {item.result || item.status.toUpperCase()}
                      {item.ratio !== undefined && <small>{item.ratio} / 3</small>}
                    </b>
                  </button>
                ))}
              </div>
            )}
          </section>
        </Modal>
      )}
      {showTranscript && (
        <Modal
          title={`MAGI_SYS / ${t.stream}`}
          onClose={() => setShowTranscript(false)}
          closeLabel={t.close}
          wide
        >
          <div className="transcript-panel">
            <div className="transcript-meta">
              <span>{replay.enabled ? t.replayLabel : t.publicOnly}</span>
              <span>
                {view?.records.length || 0} {dc.entries}
              </span>
            </div>
            {view && (
              <div className="submitted-proposal">
                <small>{t.question}</small>
                <p>{view.question}</p>
              </div>
            )}
            <div
              className="transcript-scroll"
              ref={logRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                setFollowLog(element.scrollHeight - element.scrollTop - element.clientHeight < 60);
              }}
            >
              {!view?.records.length && (
                <p className="empty-state">
                  {view?.status === 'running' ? phaseLabels[locale][view.phase] : t.noLog}
                </p>
              )}
              {view?.records.map((record, index) => (
                <article
                  className={`transcript-entry ${record.persona}`}
                  key={`${view.id}-${index}`}
                >
                  <div className="entry-meta">
                    <b>{personaInfo[record.persona].name}</b>
                    <time>{clockText(record.at, locale)}</time>
                  </div>
                  <div className="entry-phase">
                    <span>
                      {phaseLabels[locale][record.phase]} {record.round > 0 && `/ ${record.round}`}
                    </span>
                    <span className={`vote-tag ${record.assessment.vote.toLowerCase()}`}>
                      {record.assessment.vote}
                    </span>
                  </div>
                  <p className="entry-perspective">
                    {personaProfiles[record.persona].labels[locale].aspect} ·{' '}
                    {personaProfiles[record.persona].labels[locale].lens}
                  </p>
                  <p>{record.assessment.summary}</p>
                  {record.assessment.responseToOthers && (
                    <blockquote>{record.assessment.responseToOthers}</blockquote>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setShowTranscript(false);
                      setSelected(record.persona);
                    }}
                  >
                    {t.rationale} ↗
                  </button>
                </article>
              ))}
            </div>
            <div className="transcript-footer">
              <span>{t.noHidden}</span>
              <span>
                {elapsed}s · {totalTokens.toLocaleString()} TOKENS
              </span>
            </div>
          </div>
        </Modal>
      )}
      {selected && (
        <Modal
          title={`${personaInfo[selected].name} / ${personaInfo[selected].role}`}
          onClose={() => setSelected(null)}
          closeLabel={t.close}
        >
          <div className="core-details">
            <p className="persona-context">
              {personaProfiles[selected].labels[locale].aspect} ·{' '}
              {personaProfiles[selected].labels[locale].lens}
            </p>
            <p className="muted">{t.noHidden}</p>
            {view?.cores[selected].error && (
              <p className="error-text">{view.cores[selected].error}</p>
            )}
            {view?.records.filter((record) => record.persona === selected).length ? (
              view.records
                .filter((record) => record.persona === selected)
                .map((record, index, list) => (
                  <details open={index === list.length - 1} key={index}>
                    <summary>
                      <span>
                        {phaseLabels[locale][record.phase]}{' '}
                        {record.round > 0 && `/ ${record.round}`}
                      </span>
                      <b className={`vote-${record.assessment.vote.toLowerCase()}`}>
                        {record.assessment.vote}
                      </b>
                    </summary>
                    <AssessmentView assessment={record.assessment} t={t} />
                  </details>
                ))
            ) : (
              <p className="empty-state">{t.noAssessment}</p>
            )}
            {view?.cores[selected].threadId && (
              <small className="thread-id">CODEX SESSION / {view.cores[selected].threadId}</small>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
