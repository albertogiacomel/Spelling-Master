export type Accent = 'en-US' | 'en-GB';

const LETTER_NAMES: Readonly<Record<string, string>> = {
  A: 'ay',
  B: 'bee',
  C: 'see',
  D: 'dee',
  E: 'ee',
  F: 'eff',
  G: 'gee',
  H: 'aitch',
  I: 'eye',
  J: 'jay',
  K: 'kay',
  L: 'ell',
  M: 'em',
  N: 'en',
  O: 'oh',
  P: 'pee',
  Q: 'cue',
  R: 'ar',
  S: 'ess',
  T: 'tee',
  U: 'you',
  V: 'vee',
  W: 'double you',
  X: 'ex',
  Y: 'why',
  Z: 'zee',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizedLang(value: string): string {
  return value.replace('_', '-').toLowerCase();
}

/**
 * Small SpeechSynthesis adapter with explicit voice selection and a
 * cancellation token. The shared AudioManager still owns mute/voice gating.
 */
export class SpeechService {
  readonly supported: boolean;
  #synth: SpeechSynthesis | null;
  #Utterance: typeof SpeechSynthesisUtterance | null;
  #token = 0;
  #voices: SpeechSynthesisVoice[] = [];
  #listeners = new Set<() => void>();

  constructor() {
    this.#synth = typeof globalThis.speechSynthesis === 'undefined' ? null : globalThis.speechSynthesis;
    this.#Utterance = typeof globalThis.SpeechSynthesisUtterance === 'undefined'
      ? null
      : globalThis.SpeechSynthesisUtterance;
    this.supported = Boolean(this.#synth && this.#Utterance);
    if (!this.#synth) return;

    const refresh = () => this.refresh();
    this.#synth.addEventListener?.('voiceschanged', refresh);
    this.refresh();
    setTimeout(refresh, 250);
    setTimeout(refresh, 1200);
  }

  get voices(): readonly SpeechSynthesisVoice[] {
    return this.#voices;
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  refresh(): void {
    if (!this.#synth) return;
    const next = this.#synth.getVoices();
    if (next.length === 0) return;
    const changed = next.length !== this.#voices.length
      || next.some((voice, index) => voice.name !== this.#voices[index]?.name || voice.lang !== this.#voices[index]?.lang);
    if (!changed) return;
    this.#voices = next;
    for (const listener of this.#listeners) listener();
  }

  getVoice(accent: Accent): SpeechSynthesisVoice | null {
    if (this.#voices.length === 0) this.refresh();
    const target = normalizedLang(accent);
    const exact = this.#voices.filter((voice) => normalizedLang(voice.lang) === target);
    const english = this.#voices.filter((voice) => normalizedLang(voice.lang).startsWith('en'));
    const candidates = exact.length > 0 ? exact : english;
    if (candidates.length === 0) return null;

    const preferredNames = accent === 'en-GB'
      ? ['Daniel', 'Kate', 'Serena', 'Sonia', 'Google UK English Female', 'Google UK English Male']
      : ['Samantha', 'Alex', 'Aria', 'Zira', 'Google US English', 'Google US English Female'];

    const rank = (voice: SpeechSynthesisVoice): number => {
      let score = 0;
      if (voice.localService) score += 20;
      const nameIndex = preferredNames.findIndex((name) => voice.name.toLowerCase().includes(name.toLowerCase()));
      if (nameIndex >= 0) score += 10 - nameIndex;
      if (normalizedLang(voice.lang) === target) score += 5;
      if (voice.default) score += 2;
      return score;
    };

    return [...candidates].sort((a, b) => rank(b) - rank(a))[0] ?? null;
  }

  hasVoice(accent: Accent): boolean {
    return this.getVoice(accent) !== null;
  }

  stop(): void {
    this.#token += 1;
    this.#synth?.cancel();
  }

  async speak(text: string, { accent, rate = 1 }: { accent: Accent; rate?: number }): Promise<boolean> {
    this.stop();
    const token = this.#token;
    return this.#utter(text, accent, rate, token);
  }

  async speakLetter(letter: string, accent: Accent, rate = 1): Promise<boolean> {
    const upper = letter.toUpperCase();
    const name = upper === 'Z' && accent === 'en-GB' ? 'zed' : LETTER_NAMES[upper] ?? upper;
    return this.speak(name, { accent, rate });
  }

  async speakLetters(
    letters: readonly string[],
    accent: Accent,
    rate: number,
    pauseMs: number,
    onIndex?: (index: number) => void,
  ): Promise<boolean> {
    this.stop();
    const token = this.#token;
    for (let index = 0; index < letters.length; index += 1) {
      if (token !== this.#token) return false;
      const letter = letters[index];
      if (!letter) continue;
      onIndex?.(index);
      const upper = letter.toUpperCase();
      const name = upper === 'Z' && accent === 'en-GB' ? 'zed' : LETTER_NAMES[upper] ?? upper;
      await this.#utter(name, accent, rate, token);
      if (token !== this.#token) return false;
      if (index < letters.length - 1) await delay(pauseMs);
    }
    return token === this.#token;
  }

  #utter(text: string, accent: Accent, rate: number, token: number): Promise<boolean> {
    const synth = this.#synth;
    const Utterance = this.#Utterance;
    if (!this.supported || !synth || !Utterance || !text.trim()) return Promise.resolve(false);
    if (token !== this.#token) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const utterance = new Utterance(text);
      const voice = this.getVoice(accent);
      if (voice) utterance.voice = voice;
      utterance.lang = accent;
      utterance.rate = Math.min(2, Math.max(0.5, rate));
      utterance.pitch = 1;

      let settled = false;
      let timer = 0;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };

      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      timer = setTimeout(() => finish(false), Math.max(4500, text.length * 220));

      try {
        synth.speak(utterance);
      } catch {
        finish(false);
      }
    });
  }
}
