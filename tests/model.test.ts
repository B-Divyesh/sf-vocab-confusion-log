import { describe, expect, it } from 'vitest';
import { applyGrade, DAY, formatRelativeDue, MISS_DELAY, nextMode, normalizeAnswer, resolvedCsv, samePair } from '../src/model';
import type { Attempt, WordPair } from '../src/types';

const basePair: WordPair = {
  id: 'pair-1',
  wordA: 'affect',
  wordB: 'effect',
  contrast: 'Affect is usually the action; effect is usually the result.',
  mnemonic: '',
  language: 'English',
  createdAt: 100,
  updatedAt: 100,
  dueAt: 100,
  cleanStreak: 0
};

describe('practice scheduling', () => {
  it('requires three clean delayed attempts before resolving', () => {
    const first = applyGrade(basePair, true, 'text-audio', 1_000);
    expect(first.cleanStreak).toBe(1);
    expect(first.dueAt).toBe(1_000 + DAY);
    expect(first.resolvedAt).toBeUndefined();

    const second = applyGrade(first, true, 'audio-text', first.dueAt);
    expect(second.cleanStreak).toBe(2);
    expect(second.dueAt).toBe(first.dueAt + 3 * DAY);

    const third = applyGrade(second, true, 'text-audio', second.dueAt);
    expect(third.cleanStreak).toBe(3);
    expect(third.resolvedAt).toBe(second.dueAt);
  });

  it('resets a clean run and returns the pair in ten minutes after a miss', () => {
    const started = { ...basePair, cleanStreak: 2 };
    const missed = applyGrade(started, false, 'audio-text', 10_000);
    expect(missed.cleanStreak).toBe(0);
    expect(missed.dueAt).toBe(10_000 + MISS_DELAY);
    expect(missed.lastMode).toBe('audio-text');
  });

  it('alternates routes only when both recordings exist', () => {
    expect(nextMode(basePair)).toBe('text-audio');
    const recorded = { ...basePair, audioA: new Blob(['a']), audioB: new Blob(['b']), lastMode: 'text-audio' as const };
    expect(nextMode(recorded)).toBe('audio-text');
  });
});

describe('pair and export helpers', () => {
  it('normalizes answers without erasing meaningful accents', () => {
    expect(normalizeAnswer('  CAFÉ  ')).toBe('café');
    expect(normalizeAnswer('resume')).not.toBe(normalizeAnswer('résumé'));
  });

  it('spots duplicate pairs regardless of order or case', () => {
    expect(samePair(basePair, { wordA: ' Effect ', wordB: 'AFFECT' })).toBe(true);
  });

  it('exports only resolved pairs and escapes CSV fields', () => {
    const resolved = { ...basePair, resolvedAt: 500, contrast: 'Action, usually; "result" follows.' };
    const attempt: Attempt = { id: 'a', pairId: basePair.id, mode: 'text-audio', target: 'a', correct: true, createdAt: 500, scheduledDueAt: 400 };
    const csv = resolvedCsv([resolved, { ...basePair, id: 'unresolved' }], [attempt]);
    expect(csv).toContain('affect,effect');
    expect(csv).toContain('"Action, usually; ""result"" follows."');
    expect(csv).not.toContain('unresolved');
  });

  it('describes near due dates in plain language', () => {
    expect(formatRelativeDue(1_000, 1_000)).toBe('Due now');
    expect(formatRelativeDue(61_000, 1_000)).toBe('Due in 1 min');
  });
});
