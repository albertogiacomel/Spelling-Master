import { VersionedStore } from '../shared/videogames-kit/src/index.js';
import type { GameSettings, SettingsStore, StorageLike } from '../shared/videogames-kit/src/index.js';
import { createIntegratedSettings } from '../shared/videogames-kit/src/integration.js';
import type { Difficulty, WordPool } from './words.js';

export const GAME_ID = 'spelling-master';
export const LEGACY_KEY = 'spellingMagicBoxPrefs';

export interface Progress {
  totalStars: number;
  bestStreak: number;
  completedWords: number;
}

export interface GameOptions {
  accent: 'en-US' | 'en-GB';
  pauseMs: number;
  speakOnKey: boolean;
}

const DIFFICULTIES: readonly Difficulty[] = ['principiante', 'intermedio', 'avanzato'];

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

export function isPool(value: unknown): value is WordPool {
  return value === 'tutti' || isDifficulty(value);
}

function readLegacy(): Record<string, unknown> | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try {
    const raw = globalThis.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function clampPause(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 750;
  return Math.min(1500, Math.max(350, Math.round(value / 50) * 50));
}

export function createSettings(storage?: () => StorageLike): SettingsStore {
  const settings = createIntegratedSettings(GAME_ID, {
    ...(storage ? { storage } : {}),
    onError: (error, operation) => {
      document.body.dataset.preferenceStorage = 'unavailable';
      window.dispatchEvent(new CustomEvent('preference-storage-error', {
        detail: { operation, message: error instanceof Error ? error.message : String(error) },
      }));
    },
  });

  if (settings.status === 'empty') {
    const old = readLegacy();
    if (old) {
      const patch: Partial<GameSettings> = {};
      if (old.theme === 'dark') patch.theme = 'dark';
      if (old.theme === 'light') patch.theme = 'light';
      if (old.theme === 'contrast') {
        patch.theme = 'dark';
        patch.contrast = 'high';
      }
      if (isDifficulty(old.difficulty)) patch.difficulty = old.difficulty;
      if (typeof old.sfxEnabled === 'boolean') patch.effects = old.sfxEnabled;
      if (old.reducedMotion === true) patch.motion = 'reduced';
      if (Object.keys(patch).length > 0) {
        try {
          settings.update(patch);
        } catch {
          // Invalid legacy values are ignored; defaults remain active.
        }
      }
    }
  }

  return settings;
}

export function createProgress(storage?: () => StorageLike): VersionedStore<Progress> {
  return new VersionedStore<Progress>({
    gameId: GAME_ID,
    slot: 'progress',
    ...(storage ? { storage } : {}),
    defaults: () => ({ totalStars: 0, bestStreak: 0, completedWords: 0 }),
    validate: (value): value is Progress => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
      const candidate = value as Partial<Progress>;
      return Object.keys(candidate).length === 3
        && typeof candidate.totalStars === 'number' && Number.isSafeInteger(candidate.totalStars) && candidate.totalStars >= 0
        && typeof candidate.bestStreak === 'number' && Number.isSafeInteger(candidate.bestStreak) && candidate.bestStreak >= 0
        && typeof candidate.completedWords === 'number' && Number.isSafeInteger(candidate.completedWords) && candidate.completedWords >= 0;
    },
    legacy: [{
      key: LEGACY_KEY,
      parse: (raw) => JSON.parse(raw) as unknown,
      decode: (value) => {
        const old = value !== null && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
        const totalStars = typeof old.totalStars === 'number'
          && Number.isSafeInteger(old.totalStars) && old.totalStars >= 0
          ? old.totalStars
          : 0;
        return {
          version: 1,
          data: { totalStars, bestStreak: 0, completedWords: 0 } satisfies Progress,
        };
      },
    }],
  });
}

export function createOptions(storage?: () => StorageLike): VersionedStore<GameOptions> {
  return new VersionedStore<GameOptions>({
    gameId: GAME_ID,
    slot: 'options',
    ...(storage ? { storage } : {}),
    defaults: () => ({ accent: 'en-US', pauseMs: 750, speakOnKey: true }),
    validate: (value): value is GameOptions => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
      const candidate = value as Partial<GameOptions>;
      return Object.keys(candidate).length === 3
        && (candidate.accent === 'en-US' || candidate.accent === 'en-GB')
        && typeof candidate.pauseMs === 'number' && Number.isSafeInteger(candidate.pauseMs)
        && candidate.pauseMs >= 350 && candidate.pauseMs <= 1500 && candidate.pauseMs % 50 === 0
        && typeof candidate.speakOnKey === 'boolean';
    },
    legacy: [{
      key: LEGACY_KEY,
      parse: (raw) => JSON.parse(raw) as unknown,
      decode: (value) => {
        const old = value !== null && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
        return {
          version: 1,
          data: {
            accent: old.preferredAccent === 'en-GB' ? 'en-GB' : 'en-US',
            pauseMs: clampPause(old.letterPauseMs),
            speakOnKey: true,
          } satisfies GameOptions,
        };
      },
    }],
  });
}

export function storageMessage(status: string): 'storageSaved' | 'storageMemory' | 'storageUnavailable' {
  if (status === 'persistent' || status === 'empty') return 'storageSaved';
  if (status === 'memory') return 'storageMemory';
  return 'storageUnavailable';
}
