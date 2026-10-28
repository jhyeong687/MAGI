import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PERSONAS,
  defaultSettings,
  defaultPrompts,
  personaInfo,
  type Persona,
} from '../shared/domain.ts';
import { legacyDefaultPrompts, primaryPeer, PERSONA_REVISION } from '../shared/personas.ts';
import { Store } from '../server/store.ts';
import { makePrompt, Orchestrator } from '../server/orchestrator.ts';
import { makeSynthesisPrompt } from '../server/synthesis.ts';
import { createScenario } from './fixtures/scenarios.ts';
import { fixtureSynthesis } from './fixtures/synthesis.ts';

test('known stock presets upgrade once while custom personality edits, other preferences and past runs survive', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-personas-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'history'));
  const custom = legacyDefaultPrompts.casper + '\nUser-authored custom instructions.';
  const settings = {
    ...structuredClone(defaultSettings),
    locale: 'ja',
    sound: true,
    timeoutSeconds: 63,
    discussionRounds: 2,
    prompts: { ...legacyDefaultPrompts, casper: custom },
  };
  writeFileSync(join(directory, 'settings.json'), JSON.stringify(settings));
  const old = createScenario('approved');
  old.settings.prompts = structuredClone(legacyDefaultPrompts);
  const historyPath = join(directory, 'history', old.id + '.json');
  const historyBytes = JSON.stringify(old);
  writeFileSync(historyPath, historyBytes);
  const store = new Store(directory);
  assert.equal(store.settings.prompts.melchior, defaultPrompts.melchior);
  assert.equal(store.settings.prompts.balthasar, defaultPrompts.balthasar);
  assert.equal(store.settings.prompts.casper, custom);
  assert.deepEqual({ ...store.settings, prompts: null }, { ...settings, prompts: null });
  assert.equal(readFileSync(historyPath, 'utf8'), historyBytes);
  const saved = readFileSync(join(directory, 'settings.json'), 'utf8');
  new Store(directory);
  assert.equal(readFileSync(join(directory, 'settings.json'), 'utf8'), saved);
});

test('independent analysis cannot see peer or own prior judgments even when supplied to the prompt builder', () => {
  const run = createScenario('approved');
  const peers = Object.fromEntries(
    PERSONAS.map((p) => [p, { ...run.cores[p].latest!, summary: 'PRIVATE_PREVIOUS_JUDGMENT' }]),
  );
  for (const p of PERSONAS) {
    const prompt = makePrompt(run, p, 'independent', 0, peers);
    assert.ok(!prompt.includes('PRIVATE_PREVIOUS_JUDGMENT'));
    assert.ok(!prompt.includes('own_previous_assessment_json'));
    assert.ok(!prompt.includes('<peer_assessments_json>'));
  }
});

test('each debate cycle gives everyone a different primary interlocutor and immutable own/peer round snapshots', () => {
  const run = createScenario('approved');
  const peers = Object.fromEntries(PERSONAS.map((p) => [p, structuredClone(run.cores[p].latest!)]));
  for (let round = 1; round <= 3; round++) {
    const targets = PERSONAS.map((p) => primaryPeer(p, round));
    assert.equal(new Set(targets).size, 3);
    for (const p of PERSONAS) {
      const target = primaryPeer(p, round);
      assert.notEqual(target, p);
      assert.notEqual(target, primaryPeer(p, round + 1));
      run.cores[p].latest = { ...run.cores[p].latest!, summary: 'SAME_ROUND_MUTATION' };
      const prompt = makePrompt(run, p, 'cross-examination', round, peers);
      assert.ok(prompt.includes(`Primary interlocutor: ${personaInfo[target].name}`));
      assert.ok(!prompt.includes('SAME_ROUND_MUTATION'));
      const own = JSON.parse(
        prompt
          .split('<own_previous_assessment_json>\n')[1]
          .split('\n</own_previous_assessment_json>')[0],
      );
      assert.deepEqual(own, peers[p]);
      const others = JSON.parse(
        prompt.split('<peer_assessments_json>\n')[1].split('\n</peer_assessments_json>')[0],
      );
      assert.equal(others.length, 2);
      assert.ok(
        others.every((other: { persona: string }) => other.persona !== personaInfo[p].name),
      );
    }
  }
});

test('persona preset revision is captured with the actual prompts; synthesis keeps source aspects with their original claims', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-persona-run-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const orchestrator = new Orchestrator(
    new Store(directory),
    async () => new Promise(() => {}),
    fixtureSynthesis,
  );
  const run = orchestrator.create('proposal', defaultSettings, 'test-only');
  assert.equal(run.personaRevision, PERSONA_REVISION);
  assert.deepEqual(run.settings.prompts, defaultPrompts);
  orchestrator.cancel(run.id);
  const completed = createScenario('approved');
  const prompt = makeSynthesisPrompt(completed);
  const evidence = JSON.parse(
    prompt.split('<council_evidence_json>\n')[1].split('\n</council_evidence_json>')[0],
  );
  assert.equal(evidence.finalAssessments.length, 3);
  for (const [index, p] of PERSONAS.entries()) {
    assert.equal(evidence.finalAssessments[index].summary, completed.cores[p].latest!.summary);
    assert.ok(evidence.finalAssessments[index].aspect.includes('나오코'));
  }
});
