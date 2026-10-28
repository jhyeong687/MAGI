import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSettings,
  settingsSchema,
  PERSONAS,
  personaProfiles,
  type Locale,
} from '../shared/domain.ts';
import { makePrompt } from '../server/orchestrator.ts';
import { makeSynthesisPrompt } from '../server/synthesis.ts';
import { copies, phaseLabels } from '../src/i18n.ts';
import { displayCopies, resolutionLabel } from '../src/displayCopy.ts';
import { serviceCopies } from '../src/serviceCopy.ts';
import { createScenario } from './fixtures/scenarios.ts';

test('fresh installs use English and all four locale catalogs have complete UI and persona coverage', () => {
  assert.equal(defaultSettings.locale, 'en');
  for (const locale of ['en', 'ko', 'ja', 'zh'] as Locale[]) {
    assert.equal(settingsSchema.parse({ ...defaultSettings, locale }).locale, locale);
    for (const catalog of [copies, phaseLabels, displayCopies, serviceCopies]) {
      assert.deepEqual(Object.keys(catalog[locale]).sort(), Object.keys(catalog.en).sort());
      assert.ok(
        Object.values(catalog[locale]).every(
          (value) => typeof value === 'string' && value.length > 0,
        ),
      );
    }
    for (const persona of PERSONAS) assert.ok(personaProfiles[persona].labels[locale].aspect);
  }
});

test('each locale controls all new persona stages and synthesis without rewriting saved assessments', () => {
  for (const [locale, language] of Object.entries({
    en: 'English',
    ko: 'Korean',
    ja: 'Japanese',
    zh: 'Simplified Chinese',
  })) {
    const run = createScenario('approved');
    run.settings.locale = locale as Locale;
    const original = structuredClone(run.records);
    for (const phase of [
      'independent',
      'cross-examination',
      'reconsideration',
      'final-vote',
    ] as const)
      for (const persona of PERSONAS)
        assert.ok(makePrompt(run, persona, phase, 1, {}).includes(`Respond in ${language}`));
    assert.ok(makeSynthesisPrompt(run).includes(`Respond in ${language}`));
    assert.deepEqual(run.records, original);
    assert.equal(
      resolutionLabel(run, 'approved', locale as Locale),
      displayCopies[locale as Locale].approved,
    );
  }
});
