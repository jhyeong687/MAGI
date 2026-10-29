import { useEffect, useState } from 'react';
import type { Locale } from '../../shared/domain.ts';
import DemoApp from './DemoApp.tsx';
import TrialApp from './TrialApp.tsx';
import { localeNames } from '../displayCopy.ts';
export default function PublicApp() {
  const [trial, setTrial] = useState(
    () => new URLSearchParams(location.search).get('mode') === 'trial',
  );
  const [locale, setLocale] = useState<Locale>(() => {
    const value =
      new URLSearchParams(location.search).get('lang') || localStorage.getItem('magi-demo-locale');
    return value && Object.hasOwn(localeNames, value) ? (value as Locale) : 'ja';
  });
  useEffect(() => {
    const pop = () => {
      const query = new URLSearchParams(location.search);
      setTrial(query.get('mode') === 'trial');
      const value = query.get('lang');
      if (value && Object.hasOwn(localeNames, value)) setLocale(value as Locale);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
  }, [locale]);
  function language(value: Locale) {
    setLocale(value);
    localStorage.setItem('magi-demo-locale', value);
    document.documentElement.lang = value === 'zh' ? 'zh-Hans' : value;
    const url = new URL(location.href);
    url.searchParams.set('lang', value);
    history.replaceState(null, '', url);
  }
  function mode(value: boolean) {
    const url = new URL(location.href);
    if (value) {
      url.searchParams.set('mode', 'trial');
      url.searchParams.delete('view');
    } else url.searchParams.delete('mode');
    history.pushState(null, '', url);
    setTrial(value);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return trial ? (
    <TrialApp locale={locale} onLocale={language} onBack={() => mode(false)} />
  ) : (
    <DemoApp
      onTry={() => {
        const value = new URLSearchParams(location.search).get('lang') as Locale;
        if (value && Object.hasOwn(localeNames, value)) language(value);
        mode(true);
      }}
    />
  );
}
