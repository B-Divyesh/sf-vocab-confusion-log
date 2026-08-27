import type { Attempt, PracticeMode, WordPair } from './types';

export const FREE_ACTIVE_LIMIT = 8;
export const DAY = 24 * 60 * 60 * 1000;
export const MISS_DELAY = 10 * 60 * 1000;

export function normalizeAnswer(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function samePair(a: Pick<WordPair, 'wordA' | 'wordB'>, b: Pick<WordPair, 'wordA' | 'wordB'>): boolean {
  const left = [normalizeAnswer(a.wordA), normalizeAnswer(a.wordB)].sort().join('\u0000');
  const right = [normalizeAnswer(b.wordA), normalizeAnswer(b.wordB)].sort().join('\u0000');
  return left === right;
}

export function nextMode(pair: WordPair): PracticeMode {
  const hasBothAudio = Boolean(pair.audioA && pair.audioB);
  if (!hasBothAudio) return 'text-audio';
  return pair.lastMode === 'text-audio' ? 'audio-text' : 'text-audio';
}

export function applyGrade(pair: WordPair, correct: boolean, mode: PracticeMode, now = Date.now()): WordPair {
  if (!correct) {
    return {
      ...pair,
      cleanStreak: 0,
      dueAt: now + MISS_DELAY,
      updatedAt: now,
      lastMode: mode,
      resolvedAt: undefined
    };
  }

  const cleanStreak = Math.min(3, pair.cleanStreak + 1);
  const resolvedAt = cleanStreak === 3 ? now : undefined;
  const delay = cleanStreak === 1 ? DAY : cleanStreak === 2 ? 3 * DAY : 0;
  return {
    ...pair,
    cleanStreak,
    dueAt: resolvedAt ? now : now + delay,
    updatedAt: now,
    lastMode: mode,
    resolvedAt
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function resolvedCsv(pairs: WordPair[], attempts: Attempt[]): string {
  const rows: Array<Array<string | number>> = [[
    'word_a', 'word_b', 'language', 'contrast_cue', 'mnemonic',
    'resolved_at', 'clean_attempts', 'total_attempts'
  ]];
  for (const pair of pairs.filter((item) => item.resolvedAt).sort((a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0))) {
    const pairAttempts = attempts.filter((attempt) => attempt.pairId === pair.id);
    rows.push([
      pair.wordA,
      pair.wordB,
      pair.language,
      pair.contrast,
      pair.mnemonic,
      new Date(pair.resolvedAt!).toISOString(),
      pairAttempts.filter((attempt) => attempt.correct).length,
      pairAttempts.length
    ]);
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function formatRelativeDue(timestamp: number, now = Date.now()): string {
  const delta = timestamp - now;
  if (delta <= 0) return 'Due now';
  const minutes = Math.ceil(delta / 60_000);
  if (minutes < 60) return `Due in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Due in ${hours} hr`;
  const days = Math.ceil(hours / 24);
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}
