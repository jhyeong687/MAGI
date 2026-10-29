import { personaInfo, type Locale, type Run } from '../shared/domain.ts';
import { phaseLabels } from './i18n.ts';
import { phaseProgress } from './process.ts';
import { experienceCopies } from './experienceCopy.ts';
import './experience.css';

export default function DeliberationStatus({
  run,
  locale,
  elapsedSeconds,
  replay = false,
  now = Date.now(),
}: {
  run: Run | null;
  locale: Locale;
  elapsedSeconds: number;
  replay?: boolean;
  now?: number;
}) {
  const t = experienceCopies[locale];
  const progress = run ? phaseProgress(run) : null;
  const message = !run
    ? t.idle
    : run.status === 'error'
      ? t.failed
      : run.status === 'cancelled'
        ? t.stopped
        : run.answer?.status === 'error'
          ? t.reportFailed
          : run.answer?.status === 'cancelled'
            ? t.reportStopped
            : run.status === 'completed'
              ? run.answer?.status === 'completed'
                ? t.complete
                : t.votesComplete
              : run.phase === 'report'
                ? t.reporting
                : progress!.waiting.length
                  ? `${t.waitingFor}: ${progress!.waiting.map((p) => personaInfo[p].name).join(' · ')}`
                  : t.allReceived;
  const seconds = Math.max(0, Math.floor(elapsedSeconds));
  return (
    <div className="deliberation-status" data-testid="deliberation-status">
      <div role="status" aria-live="polite" className="deliberation-status-main">
        {run && (
          <strong>
            {phaseLabels[locale][run.phase]} · {run.phase === 'report' ? t.finalVotes : t.received}{' '}
            <span data-testid="phase-response-count">{progress!.received} / 3</span>
          </strong>
        )}
        <p data-testid="phase-waiting">{message}</p>
      </div>
      {run && (
        <div className="deliberation-status-time" aria-live="off">
          <span>
            {replay ? t.recordedAt : t.elapsed}{' '}
            <time data-testid="status-elapsed">
              {String(Math.floor(seconds / 60)).padStart(2, '0')}:
              {String(seconds % 60).padStart(2, '0')}
            </time>
          </span>
          {!replay && run.status === 'running' && (
            <span>
              {progress!.latestAt
                ? `${t.lastResponse} ${Math.max(0, Math.floor((now - progress!.latestAt) / 1000))}${t.secondsAgo}`
                : t.awaitingFirst}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
