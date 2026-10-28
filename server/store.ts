import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  defaultSettings,
  settingsSchema,
  PERSONAS,
  type Run,
  type Settings,
} from '../shared/domain.ts';
import { upgradeDefaultPrompts } from '../shared/personas.ts';

export class Store {
  readonly directory: string;
  readonly runs = new Map<string, Run>();
  settings: Settings;
  constructor(directory = process.env.MAGI_DATA_DIR || '.magi') {
    this.directory = resolve(directory);
    mkdirSync(resolve(this.directory, 'history'), { recursive: true });
    try {
      this.settings = settingsSchema.parse(
        JSON.parse(readFileSync(resolve(this.directory, 'settings.json'), 'utf8')),
      );
    } catch {
      this.settings = structuredClone(defaultSettings);
    }
    const upgraded = upgradeDefaultPrompts(this.settings.prompts);
    if (PERSONAS.some((persona) => upgraded[persona] !== this.settings.prompts[persona]))
      this.saveSettings({ ...this.settings, prompts: upgraded });
    for (const file of readdirSync(resolve(this.directory, 'history')).filter((f) =>
      /^[\da-f-]+\.json$/i.test(f),
    )) {
      try {
        const run = JSON.parse(
          readFileSync(resolve(this.directory, 'history', file), 'utf8'),
        ) as Run;
        if (run.id !== file.slice(0, -5) || !run.cores || !Array.isArray(run.records)) continue;
        this.runs.set(run.id, run);
        if (run.status === 'running') {
          if (run.phase === 'report' && run.verdict && run.answer) {
            run.status = 'completed';
            run.answer.status = 'error';
            run.answer.error = 'Local server restarted before the final answer finished.';
            run.answer.completedAt = new Date().toISOString();
            run.completedAt = run.answer.completedAt;
            run.updatedAt = run.completedAt;
            run.version++;
            this.save(run);
            continue;
          }
          run.status = 'error';
          run.error = 'Local server restarted before the decision finished.';
          run.completedAt = new Date().toISOString();
          for (const core of Object.values(run.cores)) {
            core.state = 'ERROR';
            core.error = run.error;
          }
          this.save(run);
        }
      } catch {
        console.warn(`Could not load history file ${file}. File preserved.`);
      }
    }
  }
  private atomic(path: string, data: unknown) {
    writeFileSync(path + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 });
    renameSync(path + '.tmp', path);
  }
  save(run: Run) {
    this.runs.set(run.id, run);
    this.atomic(resolve(this.directory, 'history', `${run.id}.json`), run);
  }
  saveSettings(settings: Settings) {
    this.atomic(resolve(this.directory, 'settings.json'), settings);
    this.settings = settings;
  }
  list() {
    return [...this.runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
