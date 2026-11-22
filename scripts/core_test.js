import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHABET,
  ALL_WORDS,
  WORD_DATABASE,
  getPool,
  normalizeAnswer,
  pickWord,
  scoreFor,
  sentenceParts,
} from '../src/words.ts';
import { letterName } from '../src/speech.ts';

test('every word is unique, correctly sized and present once in its sentence', () => {
  const seen = new Set();
  for (const [difficulty, entries] of Object.entries(WORD_DATABASE)) {
    const expected = difficulty === 'principiante' ? [3, 4] : difficulty === 'intermedio' ? [5, 5] : [6, 7];
    for (const entry of entries) {
      assert.ok(!seen.has(entry.word), `duplicate word: ${entry.word}`);
      seen.add(entry.word);
      assert.ok(entry.word.length >= expected[0] && entry.word.length <= expected[1], entry.word);
      assert.match(entry.word, /^[A-Z]+$/u);
      assert.ok(entry.it.trim().length > 0);
      assert.ok(entry.sentence.trim().length > 0);
      const matches = entry.sentence.match(new RegExp(`\\b${entry.word}\\b`, 'giu')) ?? [];
      assert.equal(matches.length, 1, `${entry.word} appears once in its sentence`);
    }
  }
  assert.equal(ALL_WORDS.length, 49);
});

test('pools expose the expected words and the mixed pool contains everything', () => {
  assert.equal(getPool('principiante').length, 16);
  assert.equal(getPool('intermedio').length, 17);
  assert.equal(getPool('avanzato').length, 16);
  assert.equal(getPool('tutti').length, ALL_WORDS.length);
});

test('answer normalisation ignores case, spaces and punctuation', () => {
  assert.equal(normalizeAnswer('  cAt! '), 'CAT');
  assert.equal(normalizeAnswer('a-b-c'), 'ABC');
  assert.equal(normalizeAnswer('123'), '');
});

test('word selection avoids used words and restarts when the pool is exhausted', () => {
  const pool = getPool('principiante');
  const used = new Set(pool.slice(0, 3).map((entry) => entry.word));
  const chosen = pickWord(pool, used, () => 0);
  assert.equal(chosen.word, pool[3]?.word);
  assert.throws(() => pickWord([], new Set()), RangeError);
  const allUsed = new Set(pool.map((entry) => entry.word));
  assert.ok(pool.includes(pickWord(pool, allUsed, () => 0.99)));
});

test('sentence parts mask the target word and reveal it on request', () => {
  const masked = sentenceParts('The small cat drinks milk.', 'CAT');
  const maskedText = masked.map((part) => part.text).join('');
  assert.ok(!maskedText.includes('CAT'));
  assert.ok(masked.some((part) => part.blank && part.text === '___'));
  const revealed = sentenceParts('The small cat drinks milk.', 'CAT', true);
  assert.ok(revealed.some((part) => part.blank && part.text.toLowerCase() === 'cat'));
  assert.equal(sentenceParts('No target here.', 'CAT')[0]?.text, 'No target here.');
});

test('the alphabet uses the Italian-readable “ey” for A and covers A-Z', () => {
  assert.equal(ALPHABET.length, 26);
  assert.equal(ALPHABET[0]?.letter, 'A');
  assert.match(ALPHABET[0]?.ipa ?? '', /ey/u);
  assert.equal(new Set(ALPHABET.map((entry) => entry.letter)).size, 26);
  assert.equal(letterName('A', 'en-US'), 'ey');
  assert.equal(letterName('A', 'en-GB'), 'ey');
  assert.equal(letterName('H', 'en-US'), 'aitch');
  assert.equal(letterName('Z', 'en-US'), 'zee');
  assert.equal(letterName('Z', 'en-GB'), 'zed');
});

test('score rewards longer words and streaks, while hints reduce the reward', () => {
  assert.equal(scoreFor(3, 0, false), 5);
  assert.equal(scoreFor(3, 5, false), 10);
  assert.equal(scoreFor(3, 0, true), 3);
  assert.equal(scoreFor(5, 0, false), 10);
  assert.equal(scoreFor(6, 0, false), 15);
  assert.equal(scoreFor(6, 5, true), 18);
});
