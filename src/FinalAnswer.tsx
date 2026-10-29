import {
  ANSWER_REVISION,
  PERSONAS,
  personaInfo,
  personaProfiles,
  type Run,
  type Locale,
} from '../shared/domain.ts';
import type { Copy } from './i18n.ts';
import { useEffect, useState } from 'react';
import { serviceCopies } from './serviceCopy.ts';
import { reportText } from './report.ts';
import { displayCopies } from './displayCopy.ts';
import ShareDecision from './ShareDecision.tsx';
import type { SharePresentation } from './sharePresentation.ts';
import './share.css';
export default function FinalAnswer({
  run,
  t,
  locale,
  onGenerate,
  disabled,
  replay,
  example = false,
  recorded = false,
  presentation,
}: {
  run: Run;
  t: Copy;
  locale: Locale;
  onGenerate: (refresh?: boolean) => void;
  disabled: boolean;
  replay: boolean;
  example?: boolean;
  recorded?: boolean;
  presentation?: SharePresentation;
}) {
  const generation = run.answer;
  const content =
    generation?.status === 'completed' ? generation.content : generation?.previousContent;
  const ui = serviceCopies[locale];
  const [notice, setNotice] = useState('');
  useEffect(() => setNotice(''), [run.id, locale]);
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText(run, t));
      setNotice(ui.copied);
    } catch {
      setNotice(ui.copyFailed);
    }
  }
  function downloadReport() {
    const url = URL.createObjectURL(
      new Blob([reportText(run, t)], { type: 'text/markdown;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `MAGI-${run.id.slice(0, 8)}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="final-answer"
      data-testid="final-answer"
      aria-labelledby="final-answer-title"
      aria-busy={generation?.status === 'generating'}
    >
      <header>
        <div>
          <small>MAGI / {displayCopies[locale].document}</small>
          <h2 id="final-answer-title">{t.finalAnswer}</h2>
        </div>
        <span>{t.councilSynthesis}</span>
      </header>
      <p className="answer-question">{presentation?.title || run.question}</p>
      {generation?.status === 'generating' ? (
        <p role="status" className="answer-pending">
          {t.answerGenerating}
        </p>
      ) : content ? (
        <>
          {generation?.status === 'error' && (
            <p role="alert" className="error-text">
              {t.answerFailed} {generation.error}
            </p>
          )}
          {generation?.status === 'cancelled' && <p role="status">{t.answerCancelled}</p>}
          <p className="answer-text" data-testid="answer-text">
            {content.answer}
          </p>
          <div className="answer-sections">
            <div>
              <h3>{t.answerReasons}</h3>
              <ul>
                {content.keyReasons.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
            {!!content.conditions.length && (
              <div>
                <h3>{t.answerConditions}</h3>
                <ul>
                  {content.conditions.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!content.disagreements.length && (
              <div className="answer-dissent">
                <h3>{t.answerDisagreements}</h3>
                <ul>
                  {content.disagreements.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <details className="answer-sources" open>
            <summary>{t.answerSources}</summary>
            {PERSONAS.map((persona) => {
              const final = run.records.findLast(
                (record) => record.persona === persona && record.phase === 'final-vote',
              );
              return (
                final && (
                  <p key={persona}>
                    <b>
                      {personaInfo[persona].name} · {final.assessment.vote}
                    </b>
                    <small>
                      {personaProfiles[persona].labels[locale].aspect} ·{' '}
                      {personaProfiles[persona].labels[locale].lens}
                    </small>
                    <span>{final.assessment.summary}</span>
                  </p>
                )
              );
            })}
          </details>
          <footer className="report-actions">
            <span>FILE / {run.id.slice(0, 8).toUpperCase()}</span>
            <div>
              {generation?.status === 'completed' && (
                <ShareDecision
                  run={run}
                  locale={locale}
                  example={example}
                  recorded={recorded}
                  presentation={presentation}
                />
              )}
              <button data-testid="copy-report" onClick={() => void copyReport()}>
                {ui.copy}
              </button>
              <button data-testid="download-report" onClick={downloadReport}>
                {ui.download} ↓
              </button>
            </div>
            {notice && <p role="status">{notice}</p>}
          </footer>
          {!replay &&
            (generation?.revision !== ANSWER_REVISION || generation.status !== 'completed') && (
              <button
                data-testid="refresh-answer"
                onClick={() => onGenerate(true)}
                disabled={disabled}
              >
                {ui.refresh}
              </button>
            )}
        </>
      ) : (
        <>
          <p role={generation?.status === 'error' ? 'alert' : 'status'}>
            {generation?.status === 'error'
              ? t.answerFailed
              : generation?.status === 'cancelled'
                ? t.answerCancelled
                : t.answerMissing}
          </p>
          {generation?.error && <p className="error-text">{generation.error}</p>}
          {!replay && (
            <button data-testid="generate-answer" onClick={() => onGenerate()} disabled={disabled}>
              {generation ? t.answerRetry : t.answerGenerate}
            </button>
          )}
        </>
      )}
    </section>
  );
}
