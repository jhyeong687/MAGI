import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultSettings,
  summarize,
  type CatalogSnapshot,
  type Environment,
  type Run,
  type RunSummary,
  type Settings,
} from '../shared/domain.ts';
import { request } from './api.ts';

export function useCouncil() {
  const [settings, setSettings] = useState<Settings>(structuredClone(defaultSettings));
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const runRef = useRef<Run | null>(null);
  const initialQuery = new URLSearchParams(location.search);
  const selection = useRef({
    id: initialQuery.get('run') || undefined,
    follow: initialQuery.get('follow') === '1' || !initialQuery.has('run'),
    after: undefined as string | undefined,
  });
  const selecting = useRef<AbortController | null>(null);
  const selectionEpoch = useRef(0);

  const locationForSelection = useCallback((id?: string) => {
    const url = new URL(location.href);
    if (id) url.searchParams.set('run', id);
    else url.searchParams.delete('run');
    if (selection.current.follow) url.searchParams.set('follow', '1');
    else url.searchParams.delete('follow');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, []);

  const accept = useCallback(
    (next: Run) => {
      if (runRef.current?.id === next.id && runRef.current.version > next.version) return;
      runRef.current = next;
      setRun(next);
      selection.current.id = next.id;
      selection.current.after = undefined;
      locationForSelection(next.id);
      setHistory((list) =>
        [summarize(next), ...list.filter((item) => item.id !== next.id)].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    },
    [locationForSelection],
  );

  const chooseRun = useCallback(
    async (id: string) => {
      selection.current = { id, follow: false, after: undefined };
      selecting.current?.abort();
      const controller = new AbortController();
      selecting.current = controller;
      const epoch = ++selectionEpoch.current;
      const next = await request<Run>(`/api/runs/${id}`, { signal: controller.signal });
      if (epoch === selectionEpoch.current && selection.current.id === id) accept(next);
    },
    [accept],
  );

  const updateRun = useCallback(
    (next: Run) => {
      if (runRef.current?.id !== next.id) {
        selectionEpoch.current++;
        selecting.current?.abort();
        selection.current = { id: next.id, follow: true, after: undefined };
      }
      accept(next);
    },
    [accept],
  );
  const clearRun = useCallback(() => {
    selectionEpoch.current++;
    selecting.current?.abort();
    // Wait for a new live job; unrelated settings/catalog events must not reopen
    // the latest archived result while the operator is writing a new proposal.
    selection.current = { id: undefined, follow: true, after: '*' };
    runRef.current = null;
    setRun(null);
    locationForSelection();
  }, [locationForSelection]);
  const pinCurrent = useCallback(() => {
    selection.current.follow = false;
    selection.current.after = undefined;
    locationForSelection(runRef.current?.id);
  }, [locationForSelection]);

  useEffect(() => {
    let alive = true,
      catalogSeen = false;
    const bootstrap = new AbortController();
    const receive = (catalog: CatalogSnapshot) => {
      if (!alive) return;
      catalogSeen = true;
      setHistory(catalog.runs);
      setSettings(catalog.settings);
      setConnected(true);
      const current = catalog.current;
      if (!current) return;
      const pick = selection.current;
      const selected = catalog.runs.find((item) => item.id === pick.id);
      // A reconnect may show a newer active run. Refresh a pinned run that finished
      // while disconnected instead of leaving its last 'running' snapshot on screen.
      if (
        !pick.follow &&
        pick.id &&
        current.id !== pick.id &&
        selected &&
        (!runRef.current || selected.version > runRef.current.version)
      ) {
        const epoch = selectionEpoch.current;
        void request<Run>(`/api/runs/${pick.id}`, { signal: bootstrap.signal })
          .then((next) => {
            if (alive && epoch === selectionEpoch.current && selection.current.id === next.id)
              accept(next);
          })
          .catch((err) => {
            if (alive && !bootstrap.signal.aborted) setError(String(err));
          });
      }
      if (
        pick.follow
          ? current.id === catalog.runs[0]?.id &&
            current.id !== pick.after &&
            (pick.after !== '*' || current.status === 'running')
          : current.id === pick.id
      )
        accept(current);
    };
    const stream = new EventSource('/api/events');
    stream.addEventListener('catalog', (event: MessageEvent) => {
      try {
        receive(JSON.parse(event.data));
      } catch {
        setConnected(false);
      }
    });
    stream.onopen = () => {
      if (alive) setConnected(true);
    };
    stream.onerror = () => {
      if (alive) setConnected(false);
    };
    void request<Environment>('/api/environment', { signal: bootstrap.signal })
      .then((value) => {
        if (alive) setEnvironment(value);
      })
      .catch((err) => {
        if (alive && !bootstrap.signal.aborted) setError(String(err));
      });
    void Promise.all([
      request<Settings>('/api/settings', { signal: bootstrap.signal }),
      request<RunSummary[]>('/api/runs', { signal: bootstrap.signal }),
    ])
      .then(async ([config, items]) => {
        if (!alive) return;
        if (!catalogSeen) {
          setSettings(config);
          setHistory(items);
        }
        const epoch = selectionEpoch.current;
        if (selection.current.after === '*') return;
        const id = selection.current.id || items[0]?.id;
        if (!id || runRef.current?.id === id) return;
        const next = await request<Run>(`/api/runs/${id}`, { signal: bootstrap.signal });
        if (
          alive &&
          epoch === selectionEpoch.current &&
          (selection.current.follow
            ? !runRef.current || runRef.current.id === id
            : selection.current.id === id)
        )
          accept(next);
      })
      .catch((err) => {
        if (alive && !bootstrap.signal.aborted) setError(String(err));
      });
    return () => {
      alive = false;
      bootstrap.abort();
      selecting.current?.abort();
      stream.close();
    };
  }, [accept]);
  return {
    settings,
    setSettings,
    environment,
    setEnvironment,
    run,
    history,
    error,
    setError,
    connected,
    chooseRun,
    updateRun,
    clearRun,
    pinCurrent,
  };
}
