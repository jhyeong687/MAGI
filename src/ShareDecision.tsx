import { useEffect, useId, useRef, useState } from 'react';
import type { Locale, Run } from '../shared/domain.ts';
import MagiScreen from './MagiScreen.tsx';
import { shareCopies } from './shareCopy.ts';
import { cardExcerpt, publicVerdictLink, type SharePresentation } from './sharePresentation.ts';
import { createShareImage } from './shareImage.ts';

export default function ShareDecision({
  run,
  locale,
  example = false,
  recorded = false,
  presentation,
}: {
  run: Run;
  locale: Locale;
  example?: boolean;
  recorded?: boolean;
  presentation?: SharePresentation;
}) {
  const t = shareCopies[locale];
  const [open, setOpen] = useState(false);
  return (
    <>
      <button data-testid="share-verdict" onClick={() => setOpen(true)}>
        {t.open} ↗
      </button>
      {open && (
        <ShareDialog
          run={run}
          locale={locale}
          example={example}
          recorded={recorded}
          presentation={presentation}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}
function ShareDialog({
  run,
  locale,
  example,
  recorded,
  presentation,
  close,
}: {
  run: Run;
  locale: Locale;
  example: boolean;
  recorded: boolean;
  presentation?: SharePresentation;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const title = useId();
  const t = shareCopies[locale];
  const [question, setQuestion] = useState(true),
    [answer, setAnswer] = useState(true);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [headline, setHeadline] = useState(() =>
    cardExcerpt(presentation?.title || run.question, 96),
  );
  const [summary, setSummary] = useState(() =>
    cardExcerpt(presentation?.summary || run.answer?.content?.answer || '', 160),
  );
  const publicLink = publicVerdictLink(locale, presentation?.example);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let alive = true,
      url = '';
    setImage(null);
    setFailed(false);
    setNotice('');
    void createShareImage(run, screen.current!.querySelector('svg')!, locale, {
      question,
      answer,
      example,
      recorded,
      title: headline,
      summary,
      link: publicLink,
    })
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [run, locale, question, answer, example, recorded, headline, summary, publicLink]);
  const filename = `MAGI-${run.verdict!.result.toLowerCase()}.png`;
  const file = image ? new File([image.blob], filename, { type: 'image/png' }) : null;
  const native =
    file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'MAGI / 決議' });
      setNotice(t.shared);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setNotice(t.failed);
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicLink);
      setNotice(presentation ? t.publicCopied : t.copied);
    } catch {
      setNotice(t.copyFailed);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal wide share-dialog"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="modal-heading">
        <span id={title}>{t.title}</span>
        <button aria-label={t.close} onClick={close}>
          ×
        </button>
      </div>
      <p className="share-privacy">{t.privacy}</p>
      <div className="share-options">
        <label>
          <input
            data-testid="share-include-question"
            type="checkbox"
            checked={question}
            onChange={(event) => setQuestion(event.target.checked)}
          />
          {t.question}
        </label>
        <label>
          <input
            data-testid="share-include-answer"
            type="checkbox"
            checked={answer}
            onChange={(event) => setAnswer(event.target.checked)}
          />
          {t.answer}
        </label>
      </div>
      <div className="share-editor">
        {question && (
          <label>
            {t.headline}
            <input
              data-testid="share-headline"
              value={headline}
              maxLength={96}
              onChange={(event) => setHeadline(event.target.value)}
            />
          </label>
        )}
        {answer && (
          <label>
            {t.summary}
            <textarea
              data-testid="share-summary"
              value={summary}
              maxLength={160}
              rows={3}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
        )}
        <small>{t.editorHelp}</small>
      </div>
      <div ref={screen} className="share-render-source" aria-hidden="true" inert>
        <MagiScreen run={run} locale={locale} replay={false} motion={false} onSelect={() => {}} />
      </div>
      {image ? (
        <img
          className="share-preview"
          data-testid="share-preview"
          src={image.url}
          alt={t.preview}
        />
      ) : (
        <p role="status">{failed ? t.failed : t.preparing}</p>
      )}
      <div className="share-actions">
        <button
          data-testid="download-share"
          disabled={!image}
          onClick={() => {
            if (!image) return;
            const link = document.createElement('a');
            link.href = image.url;
            link.download = filename;
            link.click();
            setNotice(t.saved);
          }}
        >
          {t.download} ↓
        </button>
        {native && <button onClick={() => void share()}>{t.native} ↗</button>}
        <button data-testid="copy-demo-link" onClick={() => void copyLink()}>
          {presentation ? t.publicLink : t.link}
        </button>
      </div>
      <a className="share-public-link" href={publicLink} target="_blank" rel="noreferrer">
        {publicLink}
      </a>
      {notice && <p role="status">{notice}</p>}
    </dialog>
  );
}
