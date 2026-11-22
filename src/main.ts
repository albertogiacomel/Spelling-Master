import { I18n, registerGameProfile } from '../shared/videogames-kit/src/index.js';
import { createIntegratedSettings, GameUIController } from '../shared/videogames-kit/src/integration.js';
import { GAME_MESSAGES, categoryKey, difficultyKey } from './messages.js';
import type { Language } from './messages.js';
import {
  ALPHABET,
  TRICKY_LETTERS,
  getPool,
  normalizeAnswer,
  pickWord,
  scoreFor,
  sentenceParts,
} from './words.js';
import type { WordEntry, WordPool } from './words.js';
import {
  GAME_ID,
  createOptions,
  createProgress,
  createSettings,
  isPool,
  storageMessage,
} from './stores.js';
import type { GameOptions, Progress } from './stores.js';
import { SpeechService } from './speech.js';

type GameMode = 'direct' | 'indirect' | 'mixed';
type RoundMode = 'direct' | 'indirect';
type ScreenName = 'menu' | 'game' | 'results';

interface GameState {
  mode: GameMode;
  activeMode: RoundMode;
  current: WordEntry | null;
  used: Set<string>;
  wordNumber: number;
  score: number;
  sessionStars: number;
  streak: number;
  bestStreak: number;
  correct: number;
  lives: number;
  isAnswered: boolean;
  hintUsed: boolean;
  gameOver: boolean;
  screen: ScreenName;
}

interface LastResult {
  correct: boolean;
  answer: string;
  word: string;
  points: number;
}

const GAME_MODE_VALUES: readonly GameMode[] = ['direct', 'indirect', 'mixed'];

function isGameMode(value: string | undefined): value is GameMode {
  return typeof value === 'string' && (GAME_MODE_VALUES as readonly string[]).includes(value);
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: #${id}`);
  return found as T;
}

registerGameProfile({
  gameId: GAME_ID,
  difficulties: ['principiante', 'intermedio', 'avanzato', 'tutti'],
  difficulty: 'principiante',
  channels: ['effects', 'voice'],
  defaults: {
    language: 'it',
    theme: 'system',
    motion: 'system',
    contrast: 'normal',
    muted: false,
    effects: true,
    voice: true,
  },
  messages: {
    it: {
      principiante: 'Livello 1',
      intermedio: 'Livello 2',
      avanzato: 'Sfida',
      tutti: 'Tutte le parole',
    },
    en: {
      principiante: 'Level 1',
      intermedio: 'Level 2',
      avanzato: 'Challenge',
      tutti: 'All words',
    },
  },
});

class SpellingApp {
  readonly settings = createSettings();
  readonly options = createOptions();
  readonly progress = createProgress();
  readonly speech = new SpeechService();
  readonly i18n: I18n;
  readonly controller: GameUIController;

  #options: GameOptions;
  #progress: Progress;
  #state: GameState;
  #lastResult: LastResult | null = null;
  #audioRun = 0;
  #autoPlayTimer = 0;

  constructor() {
    this.#options = this.options.load();
    this.#progress = this.progress.load();
    this.#state = {
      mode: 'direct',
      activeMode: 'direct',
      current: null,
      used: new Set<string>(),
      wordNumber: 0,
      score: this.#progress.totalStars,
      sessionStars: 0,
      streak: 0,
      bestStreak: this.#progress.bestStreak,
      correct: 0,
      lives: 3,
      isAnswered: false,
      hintUsed: false,
      gameOver: false,
      screen: 'menu',
    };

    this.i18n = new I18n(
      { it: { ...GAME_MESSAGES.it }, en: { ...GAME_MESSAGES.en } },
      { language: this.currentLanguage() },
    );

    this.controller = new GameUIController({
      gameId: GAME_ID,
      settings: this.settings,
      root: document.body,
      mount: element('game-controls'),
      onOpen: () => this.stopSpeech(),
      onClose: () => this.focusGameInput(),
    });

    this.settings.subscribe(() => this.onSettingsChanged());
    this.speech.onChange(() => this.updateVoiceStatus());

    this.buildAlphabet();
    this.buildKeyboard();
    this.bindEvents();
    this.onSettingsChanged();
    this.showScreen('menu');
    this.updateStats();
    this.updateStorageNote();

    window.addEventListener('pagehide', () => this.stopSpeech());
  }

  private t(key: string, values: Record<string, string | number> = {}): string {
    return this.i18n.t(key, values);
  }

  private currentLanguage(): Language {
    return this.settings.getSnapshot().language === 'en' ? 'en' : 'it';
  }

  private currentAccent(): GameOptions['accent'] {
    return this.#options.accent;
  }

  private currentDifficulty(): WordPool {
    const value = this.settings.getSnapshot().difficulty;
    return isPool(value) ? value : 'principiante';
  }

  private getInput(): HTMLInputElement {
    return element<HTMLInputElement>('spelling-input');
  }

  private clearAutoPlay(): void {
    window.clearTimeout(this.#autoPlayTimer);
    this.#autoPlayTimer = 0;
  }

  private announce(text: string): void {
    element('screen-announcer').textContent = text;
  }

  private buildAlphabet(): void {
    const grid = element('alphabet-grid');
    grid.replaceChildren();
    for (const entry of ALPHABET) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `sp-letter-card${entry.tricky ? ' sp-letter-card--tricky' : ''}`;
      button.dataset.letter = entry.letter;
      button.title = `${entry.letter} ${entry.ipa}`;
      button.setAttribute('aria-label', `${entry.letter}, ${entry.ipa}`);
      const letter = document.createElement('strong');
      letter.textContent = entry.letter;
      const ipa = document.createElement('span');
      ipa.textContent = entry.ipa;
      button.append(letter, ipa);
      button.addEventListener('click', () => this.speakSingleLetter(entry.letter));
      grid.append(button);
    }
  }

  private buildKeyboard(): void {
    const rows: readonly (readonly string[])[] = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
    ];
    const keyboard = element('virtual-keyboard');
    keyboard.replaceChildren();

    for (const row of rows) {
      const rowElement = document.createElement('div');
      rowElement.className = 'sp-key-row';
      for (const key of row) {
        const button = document.createElement('button');
        button.type = 'button';
        const isBack = key === 'BACK';
        button.className = `sp-key${isBack ? ' sp-key--back' : ''}`;
        button.textContent = isBack ? '⌫' : key;
        button.dataset.key = key;
        button.setAttribute('aria-label', isBack ? this.t('backspace') : key);
        button.addEventListener('click', () => {
          if (isBack) this.backspace();
          else this.typeLetter(key);
        });
        rowElement.append(button);
      }
      keyboard.append(rowElement);
    }
  }

  private bindEvents(): void {
    element('brand').addEventListener('click', (event) => {
      event.preventDefault();
      this.goHome();
    });

    document.querySelectorAll<HTMLButtonElement>('[data-start]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.start;
        if (isGameMode(mode)) this.startGame(mode);
      });
    });

    document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.difficulty;
        if (!isPool(value)) return;
        try {
          this.settings.update({ difficulty: value });
        } catch {
          this.updateStorageNote();
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('[data-accent]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.accent;
        if (value === 'en-US' || value === 'en-GB') this.setAccent(value);
      });
    });

    const slider = element<HTMLInputElement>('letter-pause');
    slider.addEventListener('input', () => {
      const pauseMs = Math.min(1500, Math.max(350, Math.round(Number(slider.value) / 50) * 50));
      this.#options = { ...this.#options, pauseMs };
      this.renderPauseValue();
    });
    slider.addEventListener('change', () => this.saveOptions());

    element<HTMLInputElement>('speak-on-key').addEventListener('change', (event) => {
      const target = event.currentTarget;
      if (target instanceof HTMLInputElement) {
        this.#options = { ...this.#options, speakOnKey: target.checked };
        this.saveOptions();
      }
    });

    element('btn-test-voice').addEventListener('click', () => void this.testVoice());
    element('btn-alphabet').addEventListener('click', () => this.openAlphabet());
    element('btn-alphabet-close').addEventListener('click', () => this.closeAlphabet());
    element('btn-alphabet-done').addEventListener('click', () => this.closeAlphabet());
    element('btn-alphabet-all').addEventListener('click', () => void this.speakAlphabet());
    element('btn-tricky').addEventListener('click', () => void this.speakTricky());

    const alphabetDialog = element<HTMLDialogElement>('alphabet-dialog');
    alphabetDialog.addEventListener('click', (event) => {
      if (event.target === alphabetDialog) this.closeAlphabet();
    });
    alphabetDialog.addEventListener('close', () => {
      this.stopSpeech();
      this.clearAlphabetHighlight();
      this.controller.lifecycle.resume('alphabet');
      element('btn-alphabet').focus({ preventScroll: true });
    });

    element('btn-home').addEventListener('click', () => this.goHome());
    element('btn-play').addEventListener('click', () => void this.playCurrent(false));
    element('btn-play-slow').addEventListener('click', () => void this.playCurrent(true));
    element('btn-play-sentence').addEventListener('click', () => void this.playSentence());
    element('btn-sentence-inline').addEventListener('click', () => void this.playSentence());
    element('btn-hint').addEventListener('click', () => this.revealHint());
    element('btn-clear').addEventListener('click', () => this.clearInput());
    element('btn-skip').addEventListener('click', () => this.skipWord());
    element('btn-next').addEventListener('click', () => this.advance());
    element('btn-feedback-word').addEventListener('click', () => void this.speakCurrentWord());
    element('btn-feedback-letters').addEventListener('click', () => void this.speakCurrentLetters());
    element('btn-again').addEventListener('click', () => this.startGame(this.#state.mode));
    element('btn-results-home').addEventListener('click', () => this.goHome());
    element('btn-reset-progress').addEventListener('click', () => this.resetProgress());

    element<HTMLFormElement>('spelling-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitAnswer();
    });
    this.getInput().addEventListener('input', () => this.onInputChanged());

    window.addEventListener('keydown', (event) => this.onGlobalKeyDown(event));
    window.addEventListener('preference-storage-error', () => this.updateStorageNote());
  }

  private onGlobalKeyDown(event: KeyboardEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('dialog[open], #klaro')) return;

    if (event.key === 'Escape') {
      if (element<HTMLDialogElement>('alphabet-dialog').open) {
        event.preventDefault();
        this.closeAlphabet();
      }
      return;
    }

    if (this.#state.screen !== 'game') return;
    if (target?.closest('button, a, input, textarea, select, summary, label, [role="button"], [contenteditable="true"]')) return;

    if (event.code === 'Space') {
      event.preventDefault();
      void this.playCurrent(false);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.#state.isAnswered) this.advance();
      else element<HTMLFormElement>('spelling-form').requestSubmit();
    }
  }

  private onSettingsChanged(): void {
    this.i18n.setLanguage(this.currentLanguage());
    this.renderStaticTexts();
    this.renderDifficulty();
    this.renderOptions();
    this.updateVoiceStatus();
    this.updateStats();
    this.updateStorageNote();

    if (this.#state.screen === 'game' && this.#state.current) {
      this.renderRoundTexts();
      this.renderSlots(this.getInput().value);
      if (this.#lastResult) this.renderFeedback(false);
    }
    if (this.#state.screen === 'results') this.renderResults();
  }

  private renderStaticTexts(): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
      const key = node.dataset.i18n;
      if (key) node.textContent = this.t(key);
    });

    this.getInput().placeholder = this.t('inputPlaceholder');
    element('btn-alphabet-close').setAttribute('aria-label', this.t('close'));
    element('btn-sentence-inline').setAttribute('aria-label', this.t('listenSentence'));
    element('btn-sentence-inline').setAttribute('title', this.t('listenSentence'));
    document.title = this.t('pageTitle');
  }

  private renderDifficulty(): void {
    const difficulty = this.currentDifficulty();
    document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.difficulty === difficulty));
    });
    const capitalized = `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`;
    element('difficulty-desc').textContent = this.t(`difficultyDesc${capitalized}`);
    element('badge-difficulty').textContent = this.t(difficultyKey(difficulty));
  }

  private renderOptions(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-accent]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.accent === this.#options.accent));
    });
    element<HTMLInputElement>('letter-pause').value = String(this.#options.pauseMs);
    element<HTMLInputElement>('speak-on-key').checked = this.#options.speakOnKey;
    this.renderPauseValue();
  }

  private renderPauseValue(): void {
    const separator = this.currentLanguage() === 'it' ? ',' : '.';
    element('pause-value').textContent = `${(this.#options.pauseMs / 1000).toFixed(2).replace('.', separator)} s`;
  }

  private updateVoiceStatus(): void {
    const snapshot = this.settings.getSnapshot();
    const dot = element('voice-dot');
    const status = element('voice-status');

    if (!this.speech.supported) {
      dot.dataset.state = 'missing';
      status.textContent = this.t('voiceMissing');
      return;
    }
    if (snapshot.muted || !snapshot.voice) {
      dot.dataset.state = 'missing';
      status.textContent = this.t('voiceBlocked');
      return;
    }
    if (this.speech.hasVoice(this.currentAccent())) {
      dot.dataset.state = 'ready';
      status.textContent = this.currentAccent() === 'en-GB' ? this.t('voiceReadyUK') : this.t('voiceReadyUS');
      return;
    }
    dot.dataset.state = 'missing';
    status.textContent = this.t('voiceMissing');
  }

  private async testVoice(): Promise<void> {
    const snapshot = this.settings.getSnapshot();
    if (!this.speech.supported) {
      this.updateVoiceStatus();
      return;
    }
    if (snapshot.muted || !snapshot.voice) {
      element('voice-status').textContent = this.t('voiceTestBlocked');
      return;
    }
    if (!this.speech.hasVoice(this.currentAccent())) {
      this.updateVoiceStatus();
      return;
    }
    element('voice-status').textContent = this.t('speechListening');
    await this.speech.speak(this.t('testPhrase'), { accent: this.currentAccent(), rate: 0.95 });
    this.updateVoiceStatus();
  }

  private setAccent(accent: GameOptions['accent']): void {
    this.stopSpeech();
    this.#options = { ...this.#options, accent };
    this.saveOptions();
    this.renderOptions();
    this.updateVoiceStatus();
  }

  private saveOptions(): boolean {
    const ok = this.options.save(this.#options);
    this.updateStorageNote();
    return ok;
  }

  private updateStats(): void {
    element('stat-score').textContent = String(this.#state.score);
    element('stat-streak').textContent = String(this.#state.streak);
    const lives = element('stat-lives');
    if (this.#state.screen === 'game' && this.#state.mode === 'mixed') {
      lives.hidden = false;
      lives.textContent = `${'❤️'.repeat(this.#state.lives)}${'🤍'.repeat(Math.max(0, 3 - this.#state.lives))}`;
    } else {
      lives.hidden = true;
      lives.textContent = '';
    }
    this.updateStorageNote();
  }

  private updateStorageNote(): void {
    const statuses = [this.settings.status, this.progress.status, this.options.status];
    const key = statuses.includes('memory')
      ? 'storageMemory'
      : statuses.some((status) => status === 'invalid' || status === 'future')
        ? 'storageUnavailable'
        : storageMessage('persistent');
    element('storage-note').textContent = this.t(key);
    element('btn-reset-progress').hidden = !(this.#progress.totalStars > 0 || this.#progress.bestStreak > 0);
  }

  private showScreen(screen: ScreenName): void {
    this.#state.screen = screen;
    (['menu', 'game', 'results'] as const).forEach((name) => {
      element(`screen-${name}`).hidden = name !== screen;
    });
    document.body.dataset.screen = screen;

    const headingId = screen === 'menu' ? 'menu-title' : screen === 'game' ? 'round-instruction' : 'results-title';
    const heading = element(headingId);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    this.announce(heading.textContent ?? '');
  }

  private startGame(mode: GameMode): void {
    this.stopSpeech();
    this.clearAutoPlay();
    this.#state = {
      ...this.#state,
      mode,
      activeMode: mode === 'mixed' ? 'direct' : mode,
      current: null,
      used: new Set<string>(),
      wordNumber: 0,
      sessionStars: 0,
      streak: 0,
      correct: 0,
      lives: 3,
      isAnswered: false,
      hintUsed: false,
      gameOver: false,
    };
    this.#lastResult = null;
    this.showScreen('game');
    this.nextWord();
  }

  private nextWord(): void {
    this.stopSpeech();
    this.clearAutoPlay();
    const state = this.#state;
    state.isAnswered = false;
    state.hintUsed = false;
    state.gameOver = false;
    state.wordNumber += 1;
    state.activeMode = state.mode === 'mixed'
      ? (Math.random() < 0.5 ? 'direct' : 'indirect')
      : state.mode;

    const pool = getPool(this.currentDifficulty());
    if (pool.every((entry) => state.used.has(entry.word))) state.used.clear();
    const chosen = pickWord(pool, state.used);
    state.used.add(chosen.word);
    state.current = chosen;

    this.resetRoundUi();
    this.renderRoundTexts();
    this.updateStats();
    this.#lastResult = null;

    this.#autoPlayTimer = window.setTimeout(() => {
      if (this.#state.current === chosen && this.#state.screen === 'game') {
        void this.playCurrent(false);
      }
    }, 280);
  }

  private resetRoundUi(): void {
    const input = this.getInput();
    input.value = '';
    input.disabled = false;
    input.maxLength = (this.#state.current?.word.length ?? 0) + 4;
    element('btn-clear').hidden = true;
    element<HTMLButtonElement>('btn-check').disabled = false;
    element('btn-skip').hidden = false;
    element('btn-play-sentence').hidden = this.#state.activeMode === 'indirect';
    element('btn-hint').hidden = false;
    element('hint-box').hidden = true;
    element('feedback').hidden = true;
    element('letter-diff').replaceChildren();
    element('btn-next').hidden = false;
    this.setNextLabel('next');
    element('word-length').textContent = String(this.#state.current?.word.length ?? 0);
    this.renderSlots('');
    this.resetLeds();
    if (window.innerWidth > 640) input.focus({ preventScroll: true });
  }

  private setNextLabel(key: 'next' | 'results'): void {
    const label = element('btn-next').querySelector<HTMLElement>('[data-i18n]');
    if (label) {
      label.dataset.i18n = key;
      label.textContent = this.t(key);
    }
  }

  private renderRoundTexts(): void {
    const state = this.#state;
    const current = state.current;
    if (!current) return;
    const indirect = state.activeMode === 'indirect';

    element('current-word-num').textContent = String(state.wordNumber);
    element('badge-difficulty').textContent = this.t(difficultyKey(this.currentDifficulty()));
    element('badge-mode').textContent = this.t(indirect ? 'badgeIndirect' : 'badgeDirect');
    element('round-instruction').textContent = this.t(indirect ? 'instructionIndirect' : 'instructionDirect');
    element('btn-play-label').textContent = this.t(indirect ? 'listenLetters' : 'listenWord');
    element('btn-play-sentence').hidden = indirect;
    element('sentence-box').hidden = indirect;
    element('indirect-leds').hidden = !indirect;
    element('word-length').textContent = String(current.word.length);
    element('hint-translation').textContent = current.it;
    element('hint-category').textContent = this.t(categoryKey(current.category));

    if (state.hintUsed) {
      element('btn-hint').hidden = true;
      element('hint-box').hidden = false;
    } else {
      element('btn-hint').hidden = false;
      element('hint-box').hidden = true;
    }

    if (indirect) this.buildLeds(current.word.length);
    this.renderSentence(false);
    this.updateStats();
  }

  private renderSentence(reveal: boolean): void {
    const current = this.#state.current;
    if (!current) return;
    const container = element('sentence-text');
    container.replaceChildren();
    for (const part of sentenceParts(current.sentence, current.word, reveal)) {
      if (part.blank) {
        const blank = document.createElement('span');
        blank.className = 'sp-blank';
        blank.textContent = part.text;
        container.append(blank);
      } else {
        container.append(document.createTextNode(part.text));
      }
    }
  }

  private renderSlots(text: string): void {
    const current = this.#state.current;
    const container = element('letter-slots');
    container.replaceChildren();
    if (!current) return;

    const clean = normalizeAnswer(text);
    const target = current.word;
    const displayLength = Math.max(target.length, Math.min(clean.length, target.length + 4));
    const answered = this.#state.isAnswered;

    for (let index = 0; index < displayLength; index += 1) {
      const slot = document.createElement('span');
      slot.className = 'sp-slot';
      const userChar = clean[index] ?? '';
      const targetChar = target[index] ?? '';
      let state = 'empty';

      if (answered) {
        slot.textContent = targetChar || userChar || '';
        state = userChar === targetChar ? 'correct' : 'wrong';
      } else if (userChar) {
        slot.textContent = userChar;
        state = index >= target.length ? 'extra' : 'filled';
      } else if (index === clean.length) {
        state = 'active';
      }

      slot.dataset.state = state;
      container.append(slot);
    }
  }

  private onInputChanged(): void {
    if (this.#state.isAnswered) return;
    const input = this.getInput();
    const clean = normalizeAnswer(input.value);
    element('btn-clear').hidden = clean.length === 0;
    this.renderSlots(clean);
  }

  private clearInput(): void {
    if (this.#state.isAnswered) return;
    const input = this.getInput();
    input.value = '';
    element('btn-clear').hidden = true;
    this.renderSlots('');
    input.focus({ preventScroll: true });
  }

  private typeLetter(letter: string): void {
    if (this.#state.isAnswered) return;
    const input = this.getInput();
    if (input.value.length >= input.maxLength) return;
    input.value += letter;
    this.onInputChanged();
    if (this.#options.speakOnKey) void this.speakSingleLetter(letter);
    input.focus({ preventScroll: true });
  }

  private backspace(): void {
    if (this.#state.isAnswered) return;
    const input = this.getInput();
    input.value = input.value.slice(0, -1);
    this.onInputChanged();
    input.focus({ preventScroll: true });
  }

  private revealHint(): void {
    if (this.#state.isAnswered || !this.#state.current) return;
    this.#state.hintUsed = true;
    element('btn-hint').hidden = true;
    element('hint-box').hidden = false;
  }

  private submitAnswer(): void {
    if (this.#state.isAnswered) {
      this.advance();
      return;
    }
    const current = this.#state.current;
    if (!current) return;
    const input = this.getInput();
    const answer = normalizeAnswer(input.value);
    if (!answer) {
      input.focus({ preventScroll: true });
      return;
    }

    this.stopSpeech();
    this.clearAutoPlay();
    this.#state.isAnswered = true;
    input.disabled = true;
    element<HTMLButtonElement>('btn-check').disabled = true;
    element('btn-skip').hidden = true;
    element('btn-play-sentence').hidden = false;
    element('btn-clear').hidden = true;

    const correct = answer === current.word;
    let points = 0;

    if (correct) {
      this.#state.streak += 1;
      this.#state.bestStreak = Math.max(this.#state.bestStreak, this.#state.streak);
      this.#state.correct += 1;
      points = scoreFor(current.word.length, this.#state.streak, this.#state.hintUsed);
      this.#state.score += points;
      this.#state.sessionStars += points;
      this.#progress = {
        ...this.#progress,
        completedWords: this.#progress.completedWords + 1,
      };
      this.playTone(true);
    } else {
      this.#state.streak = 0;
      if (this.#state.mode === 'mixed') {
        this.#state.lives = Math.max(0, this.#state.lives - 1);
        if (this.#state.lives === 0) this.#state.gameOver = true;
      }
      const card = element('game-card');
      card.classList.remove('sp-shake');
      void card.offsetWidth;
      card.classList.add('sp-shake');
      this.playTone(false);
    }

    this.updateStats();
    this.renderSentence(true);
    this.renderSlots(answer);
    this.showFeedback(correct, answer, current.word, points);
    this.saveProgress();

    window.setTimeout(() => {
      if (this.#state.screen === 'game' && this.#state.current === current) {
        void this.speech.speak(current.word, { accent: this.currentAccent(), rate: 1 });
      }
    }, 320);
  }

  private playTone(success: boolean): void {
    try {
      this.controller.audio.tone({
        frequencies: success ? [523.25, 659.25, 783.99] : [220, 175],
        duration: success ? 0.18 : 0.22,
        spacing: success ? 0.07 : 0.1,
        volume: 0.05,
        wave: success ? 'sine' : 'triangle',
      });
    } catch {
      // The shared AudioManager reports unavailable audio through settings.
    }
  }

  private showFeedback(correct: boolean, answer: string, word: string, points: number, focus = true): void {
    this.#lastResult = { correct, answer, word, points };
    const panel = element('feedback');
    panel.hidden = false;
    panel.dataset.result = correct ? 'correct' : 'wrong';
    const icon = element('feedback-icon');
    icon.textContent = correct ? '🌟' : '🐱';
    element('feedback-title').textContent = this.t(correct ? 'feedbackCorrectTitle' : 'feedbackWrongTitle');

    if (correct) {
      element('feedback-detail').textContent = this.t('feedbackCorrectDetail', {
        word,
        it: this.#state.current?.it ?? '',
        points,
      });
      element('letter-diff').replaceChildren();
    } else {
      element('feedback-detail').textContent = this.t('feedbackWrongDetail', {
        answer,
        word,
        it: this.#state.current?.it ?? '',
      });
      const diff = element('letter-diff');
      diff.replaceChildren();
      const maxLength = Math.max(answer.length, word.length);
      for (let index = 0; index < maxLength; index += 1) {
        const userChar = answer[index] ?? '·';
        const targetChar = word[index] ?? '∅';
        const match = userChar === targetChar;
        const badge = document.createElement('span');
        badge.dataset.match = String(match);
        badge.textContent = match ? targetChar : `${userChar}→${targetChar}`;
        diff.append(badge);
      }
    }

    this.setNextLabel(this.#state.gameOver ? 'results' : 'next');
    if (focus) element('btn-next').focus({ preventScroll: true });
  }

  private renderFeedback(focus: boolean): void {
    if (!this.#lastResult) return;
    this.showFeedback(this.#lastResult.correct, this.#lastResult.answer, this.#lastResult.word, this.#lastResult.points, focus);
  }

  private advance(): void {
    if (this.#state.gameOver) this.showResults();
    else this.nextWord();
  }

  private skipWord(): void {
    if (this.#state.isAnswered) return;
    this.stopSpeech();
    this.clearAutoPlay();
    this.#state.streak = 0;
    if (this.#state.mode === 'mixed') {
      this.#state.lives = Math.max(0, this.#state.lives - 1);
      if (this.#state.lives === 0) {
        this.#state.gameOver = true;
        this.showResults();
        return;
      }
    }
    this.updateStats();
    this.nextWord();
  }

  private saveProgress(): boolean {
    const next: Progress = {
      totalStars: this.#state.score,
      bestStreak: Math.max(this.#progress.bestStreak, this.#state.bestStreak),
      completedWords: this.#progress.completedWords,
    };
    const ok = this.progress.save(next);
    this.#progress = next;
    this.updateStorageNote();
    return ok;
  }

  private showResults(): void {
    this.stopSpeech();
    this.clearAutoPlay();
    this.#state.screen = 'results';
    this.showScreen('results');
    this.renderResults();
    this.updateStats();
  }

  private renderResults(): void {
    element('final-score').textContent = String(this.#state.score);
    element('final-correct').textContent = String(this.#state.correct);
    element('final-streak').textContent = String(this.#progress.bestStreak);
    element('results-lead').textContent = this.t('resultsLead', { correct: this.#state.correct });
    const message = this.#state.correct >= 8
      ? 'resultsGreat'
      : this.#state.correct >= 4
        ? 'resultsGood'
        : 'resultsTry';
    element('results-message').textContent = this.t(message);
  }

  private resetProgress(): void {
    if (!window.confirm(this.t('confirmResetProgress'))) return;
    try {
      const value = this.progress.reset();
      this.#progress = value;
      this.#state.score = 0;
      this.#state.bestStreak = 0;
      this.#state.streak = 0;
      this.#state.sessionStars = 0;
      this.#state.correct = 0;
      this.updateStats();
      this.updateStorageNote();
      this.announce(this.t('progressReset'));
    } catch {
      this.updateStorageNote();
    }
  }

  private goHome(): void {
    this.stopSpeech();
    this.clearAutoPlay();
    this.#state.current = null;
    this.#state.isAnswered = false;
    this.#state.gameOver = false;
    this.#state.streak = 0;
    this.#lastResult = null;
    this.showScreen('menu');
    this.updateStats();
  }

  private setVisualizer(active: boolean, text = ''): void {
    const visualizer = element('visualizer');
    visualizer.hidden = !active;
    if (active) element('visualizer-text').textContent = text;
  }

  private stopSpeech(): void {
    this.#audioRun += 1;
    this.speech.stop();
    this.setVisualizer(false);
    this.resetLeds();
  }

  private async playCurrent(slow: boolean): Promise<void> {
    const current = this.#state.current;
    if (!current || this.#state.screen !== 'game') return;
    const snapshot = this.settings.getSnapshot();
    if (snapshot.muted || !snapshot.voice) {
      element('voice-status').textContent = this.t('voiceBlocked');
      return;
    }
    this.clearAutoPlay();
    const run = ++this.#audioRun;
    const accent = this.currentAccent();

    if (this.#state.activeMode === 'direct') {
      this.setVisualizer(true, this.t('speechListening'));
      await this.speech.speak(current.word, { accent, rate: slow ? 0.72 : 1 });
      if (run === this.#audioRun) this.setVisualizer(false);
      return;
    }

    this.buildLeds(current.word.length);
    this.setVisualizer(true, this.t('speechLetters', { count: current.word.length }));
    const pause = slow ? Math.max(850, this.#options.pauseMs * 1.5) : this.#options.pauseMs;
    const ok = await this.speech.speakLetters(
      current.word.toUpperCase().split(''),
      accent,
      slow ? 0.8 : 1,
      pause,
      (index) => {
        if (run === this.#audioRun) this.highlightLed(index, current.word.length);
      },
    );
    if (run !== this.#audioRun) return;
    this.setVisualizer(false);
    if (ok) element('led-counter').textContent = this.t('speechDone');
  }

  private async playSentence(): Promise<void> {
    const current = this.#state.current;
    if (!current) return;
    const snapshot = this.settings.getSnapshot();
    if (snapshot.muted || !snapshot.voice) return;
    const run = ++this.#audioRun;
    this.setVisualizer(true, this.t('speechListening'));
    await this.speech.speak(current.sentence, { accent: this.currentAccent(), rate: 0.95 });
    if (run === this.#audioRun) this.setVisualizer(false);
  }

  private async speakCurrentWord(): Promise<void> {
    const current = this.#state.current;
    if (!current) return;
    const snapshot = this.settings.getSnapshot();
    if (snapshot.muted || !snapshot.voice) return;
    await this.speech.speak(current.word, { accent: this.currentAccent(), rate: 1 });
  }

  private async speakCurrentLetters(): Promise<void> {
    const current = this.#state.current;
    if (!current) return;
    const snapshot = this.settings.getSnapshot();
    if (snapshot.muted || !snapshot.voice) return;
    await this.speech.speakLetters(
      current.word.toUpperCase().split(''),
      this.currentAccent(),
      1,
      this.#options.pauseMs,
    );
  }

  private speakSingleLetter(letter: string): void {
    const snapshot = this.settings.getSnapshot();
    if (!this.speech.supported) {
      this.updateVoiceStatus();
      return;
    }
    if (snapshot.muted || !snapshot.voice) {
      element('voice-status').textContent = this.t('voiceBlocked');
      return;
    }
    void this.speech.speakLetter(letter, this.currentAccent(), 1);
  }

  private async speakAlphabet(): Promise<void> {
    const snapshot = this.settings.getSnapshot();
    if (snapshot.muted || !snapshot.voice || !this.speech.hasVoice(this.currentAccent())) {
      this.updateVoiceStatus();
      return;
    }
    this.announce(this.t('alphabetAll'));
    await this.speech.speakLetters(
      ALPHABET.map((entry) => entry.letter),
      this.currentAccent(),
      0.9,
      450,
      (index) => {
        const entry = ALPHABET[index];
        if (entry) this.highlightAlphabet(entry.letter);
      },
    );
    this.clearAlphabetHighlight();
  }

  private async speakTricky(): Promise<void> {
    const snapshot = this.settings.getSnapshot();
    if (snapshot.muted || !snapshot.voice || !this.speech.hasVoice(this.currentAccent())) {
      this.updateVoiceStatus();
      return;
    }
    this.announce(this.t('trickyListen'));
    await this.speech.speakLetters(TRICKY_LETTERS, this.currentAccent(), 0.9, 500, (index) => {
      const letter = TRICKY_LETTERS[index];
      if (letter) this.highlightAlphabet(letter);
    });
    this.clearAlphabetHighlight();
  }

  private highlightAlphabet(letter: string): void {
    document.querySelectorAll<HTMLElement>('#alphabet-grid [data-letter]').forEach((card) => {
      card.dataset.active = String(card.dataset.letter === letter);
    });
  }

  private clearAlphabetHighlight(): void {
    document.querySelectorAll<HTMLElement>('#alphabet-grid [data-letter]').forEach((card) => {
      card.removeAttribute('data-active');
    });
  }

  private buildLeds(length: number): void {
    const row = element('led-row');
    row.replaceChildren();
    for (let index = 0; index < length; index += 1) {
      const led = document.createElement('span');
      led.className = 'sp-led';
      led.dataset.state = 'pending';
      row.append(led);
    }
    element('led-counter').textContent = this.t('ledReady', { count: length });
  }

  private highlightLed(activeIndex: number, total: number): void {
    const leds = element('led-row').children;
    for (let index = 0; index < leds.length; index += 1) {
      const led = leds[index];
      if (!(led instanceof HTMLElement)) continue;
      led.dataset.state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
    }
    element('led-counter').textContent = this.t('speechLetterOf', { index: activeIndex + 1, total });
  }

  private resetLeds(): void {
    const row = element('led-row');
    for (const led of row.children) {
      if (led instanceof HTMLElement) led.dataset.state = 'pending';
    }
    const current = this.#state.current;
    if (current && this.#state.screen === 'game') {
      element('led-counter').textContent = this.t('ledReady', { count: current.word.length });
    }
  }

  private openAlphabet(): void {
    this.stopSpeech();
    this.controller.lifecycle.pause('alphabet');
    const dialog = element<HTMLDialogElement>('alphabet-dialog');
    if (!dialog.open) dialog.showModal();
    element('btn-alphabet-close').focus({ preventScroll: true });
  }

  private closeAlphabet(): void {
    this.clearAlphabetHighlight();
    const dialog = element<HTMLDialogElement>('alphabet-dialog');
    if (dialog.open) dialog.close();
  }

  private focusGameInput(): void {
    if (this.#state.screen === 'game' && !this.#state.isAnswered && window.innerWidth > 640) {
      this.getInput().focus({ preventScroll: true });
    }
  }
}

const app = new SpellingApp();
(globalThis as { __spellingApp?: SpellingApp }).__spellingApp = app;
