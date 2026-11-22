import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechService, letterName } from '../src/speech.ts';

test('speech sequence says A as “ey” and spells the whole alphabet in order', async () => {
  const spoken = [];
  const originalSynth = globalThis.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;

  globalThis.speechSynthesis = {
    getVoices: () => [{ name: 'Test US', lang: 'en-US', localService: true, default: true }],
    addEventListener: () => {},
    cancel: () => {},
    speak: (utterance) => {
      spoken.push(utterance.text);
      queueMicrotask(() => utterance.onend?.());
    },
  };
  globalThis.SpeechSynthesisUtterance = class {
    text;
    lang = '';
    rate = 1;
    pitch = 1;
    voice = null;
    onend = null;
    onerror = null;
    constructor(text) {
      this.text = text;
    }
  };

  try {
    const service = new SpeechService();
    assert.equal(letterName('A', 'en-US'), 'ey');
    assert.equal(letterName('Z', 'en-GB'), 'zed');

    await service.speakLetter('A', 'en-US');
    assert.deepEqual(spoken, ['ey']);

    spoken.length = 0;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    await service.speakLetters(letters, 'en-US', 1, 0);
    assert.equal(spoken.length, 26);
    assert.equal(spoken[0], 'ey');
    assert.equal(spoken[25], 'zee');
    service.stop();
  } finally {
    if (originalSynth === undefined) delete globalThis.speechSynthesis;
    else globalThis.speechSynthesis = originalSynth;
    if (originalUtterance === undefined) delete globalThis.SpeechSynthesisUtterance;
    else globalThis.SpeechSynthesisUtterance = originalUtterance;
  }
});
