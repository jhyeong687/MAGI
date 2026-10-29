import type { Locale } from '../shared/domain.ts';
import { demoUrl } from './shareCopy.ts';

export type PublicExample = 'recording' | 'club' | 'feature' | 'meeting';
export type SharePresentation = { title: string; summary: string; example: PublicExample };
const examples: readonly string[] = ['recording', 'club', 'feature', 'meeting'];

// Only public catalog keys go into URLs. Never serialize a local question, run ID or answer.
export function publicVerdictLink(locale: Locale, example?: PublicExample) {
  if (!example || !examples.includes(example)) return demoUrl;
  const link = new URL(demoUrl);
  link.searchParams.set('lang', locale);
  link.searchParams.set('example', example);
  link.searchParams.set('view', 'result');
  return link.href;
}

export function cardExcerpt(text: string, limit: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const characters = Array.from(clean);
  if (characters.length <= limit) return clean;
  let excerpt = characters.slice(0, limit - 1).join('');
  const boundary = excerpt.lastIndexOf(' ');
  if (boundary > excerpt.length * 0.65) excerpt = excerpt.slice(0, boundary);
  return excerpt.trimEnd() + '…';
}
