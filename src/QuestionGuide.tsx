import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '../shared/domain.ts';
import { experienceCopies } from './experienceCopy.ts';
import {
  composeQuestion,
  emptyQuestionDraft,
  mergeQuestion,
  questionTemplate,
  questionTopics,
  type QuestionDraft,
} from './questionGuide.ts';
import './experience.css';

export default function QuestionGuide({
  locale,
  value = '',
  onApply,
  disabled = false,
}: {
  locale: Locale;
  value?: string;
  onApply?: (question: string) => void;
  disabled?: boolean;
}) {
  const t = experienceCopies[locale];
  const preview = !onApply;
  const storageKey = preview ? 'magi-guide-demo-draft' : 'magi-guide-local-draft';
  const [draft, setDraft] = useState<QuestionDraft>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return Object.fromEntries(
        Object.keys(emptyQuestionDraft()).map((key) => [
          key,
          typeof saved?.[key] === 'string' ? saved[key].slice(0, 2000) : '',
        ]),
      ) as QuestionDraft;
    } catch {
      return emptyQuestionDraft();
    }
  });
  const [open, setOpen] = useState(Boolean(draft.decision));
  const [notice, setNotice] = useState('');
  const previous = useRef('');
  const decisionInput = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const composed = composeQuestion(draft, locale);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* Draft editing still works without browser storage. */
    }
    setNotice('');
  }, [draft, locale, storageKey]);
  async function apply() {
    if (disabled || !draft.decision.trim()) return;
    setNotice('');
    if (composed.length > 6000) {
      setNotice(t.tooLong);
      return;
    }
    if (onApply) {
      const combined = mergeQuestion(value, composed, previous.current);
      if (combined.length > 6000) {
        setNotice(t.tooLong);
        return;
      }
      previous.current = composed;
      onApply(combined);
    } else {
      try {
        await navigator.clipboard.writeText(composed);
        setNotice(t.copied);
      } catch {
        setNotice(t.copyFailed);
      }
    }
  }
  return (
    <section
      className="question-guide"
      data-testid="question-guide"
      aria-labelledby={`${id}-title`}
    >
      <header>
        <h3 id={`${id}-title`}>{t.guideTitle}</h3>
        <p>{t.guideHint}</p>
      </header>
      {preview && (
        <p className="guide-disclosure" data-testid="guide-disclosure">
          {t.demoHint}
        </p>
      )}
      <div className="guide-topics" role="group" aria-label={t.guideTitle}>
        {questionTopics.map((topic) => (
          <button
            type="button"
            key={topic}
            data-testid={`guide-${topic}`}
            disabled={disabled}
            onClick={() => {
              setDraft(questionTemplate(locale, topic));
              setOpen(true);
              requestAnimationFrame(() => decisionInput.current?.focus());
            }}
          >
            {t[topic]}
          </button>
        ))}
      </div>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          {t.context} / {t.decision} / {t.criteria}
        </summary>
        <div className="guide-fields">
          {(['context', 'decision', 'criteria'] as const).map((field) => (
            <label key={field} htmlFor={`${id}-${field}`}>
              {t[field]}
              {field === 'decision' && ' *'}
              <textarea
                id={`${id}-${field}`}
                ref={field === 'decision' ? decisionInput : undefined}
                data-testid={`guide-${field}`}
                rows={2}
                maxLength={2000}
                value={draft[field]}
                disabled={disabled}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <p className="guide-note">{preview ? t.demoDraft : t.saved}</p>
        {preview && (
          <textarea
            className="guide-preview"
            data-testid="guide-preview"
            aria-label={t.demoDraft}
            rows={5}
            readOnly
            value={composed}
          />
        )}
        <button
          type="button"
          data-testid="guide-apply"
          disabled={disabled || !draft.decision.trim()}
          onClick={() => void apply()}
        >
          {preview ? t.copy : value.trim() ? t.append : t.build}
        </button>
      </details>
      {notice && (
        <p role="status" className="guide-note">
          {notice}
        </p>
      )}
    </section>
  );
}
