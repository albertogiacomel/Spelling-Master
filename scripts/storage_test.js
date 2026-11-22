import test from 'node:test';
import assert from 'node:assert/strict';
import { createOptions, createProgress } from '../src/stores.ts';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    read(key) {
      return data.get(key);
    },
  };
}

const PROGRESS_KEY = 'ag-games:spelling-master:progress:v1';
const OPTIONS_KEY = 'ag-games:spelling-master:options:v1';
const LEGACY = 'spellingMagicBoxPrefs';

test('progress starts empty, saves and reloads with a versioned envelope', () => {
  const storage = fakeStorage();
  const store = createProgress(() => storage);
  assert.deepEqual(store.load(), { totalStars: 0, bestStreak: 0, completedWords: 0 });
  assert.equal(store.save({ totalStars: 12, bestStreak: 3, completedWords: 2 }), true);
  assert.equal(store.status, 'persistent');
  const reloaded = createProgress(() => storage);
  assert.deepEqual(reloaded.load(), { totalStars: 12, bestStreak: 3, completedWords: 2 });
  const envelope = JSON.parse(storage.read(PROGRESS_KEY));
  assert.equal(envelope.version, 1);
});

test('legacy prototype preferences migrate stars without deleting the old key', () => {
  const storage = fakeStorage({
    [LEGACY]: JSON.stringify({
      totalStars: 42,
      preferredAccent: 'en-GB',
      letterPauseMs: 900,
      theme: 'dark',
      sfxEnabled: false,
    }),
  });
  const progress = createProgress(() => storage);
  assert.equal(progress.load().totalStars, 42);
  assert.ok(storage.read(LEGACY));
  const options = createOptions(() => storage);
  assert.deepEqual(options.load(), { accent: 'en-GB', pauseMs: 900, speakOnKey: true });
});

test('invalid and future saves are refused without overwriting newer data', () => {
  const storage = fakeStorage({
    [PROGRESS_KEY]: JSON.stringify({ version: 2, data: { totalStars: 99, bestStreak: 9, completedWords: 9 } }),
  });
  const store = createProgress(() => storage);
  assert.deepEqual(store.load(), { totalStars: 0, bestStreak: 0, completedWords: 0 });
  assert.equal(store.status, 'future');
  assert.throws(() => store.save({ totalStars: 1, bestStreak: 0, completedWords: 0 }), RangeError);
  assert.equal(JSON.parse(storage.read(PROGRESS_KEY)).version, 2);

  const invalid = fakeStorage({
    [PROGRESS_KEY]: JSON.stringify({ version: 1, data: { totalStars: -1, bestStreak: 0, completedWords: 0 } }),
  });
  const invalidStore = createProgress(() => invalid);
  assert.deepEqual(invalidStore.load(), { totalStars: 0, bestStreak: 0, completedWords: 0 });
  assert.equal(invalidStore.status, 'invalid');
});

test('options validate accent, pause range and speaking preference', () => {
  const storage = fakeStorage();
  const store = createOptions(() => storage);
  assert.deepEqual(store.load(), { accent: 'en-US', pauseMs: 750, speakOnKey: true });
  assert.equal(store.save({ accent: 'en-GB', pauseMs: 1000, speakOnKey: false }), true);
  assert.equal(createOptions(() => storage).load().accent, 'en-GB');
  assert.throws(() => store.save({ accent: 'fr-FR', pauseMs: 750, speakOnKey: true }), TypeError);
  assert.throws(() => store.save({ accent: 'en-US', pauseMs: 300, speakOnKey: true }), TypeError);
  assert.throws(() => store.save({ accent: 'en-US', pauseMs: 760, speakOnKey: true }), TypeError);
  assert.equal(JSON.parse(storage.read(OPTIONS_KEY)).version, 1);
});
