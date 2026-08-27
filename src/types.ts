export type PracticeMode = 'text-audio' | 'audio-text';
export type WordSide = 'a' | 'b';

export interface WordPair {
  id: string;
  wordA: string;
  wordB: string;
  contrast: string;
  mnemonic: string;
  language: string;
  audioA?: Blob;
  audioB?: Blob;
  createdAt: number;
  updatedAt: number;
  dueAt: number;
  cleanStreak: number;
  resolvedAt?: number;
  lastMode?: PracticeMode;
}

export interface Attempt {
  id: string;
  pairId: string;
  mode: PracticeMode;
  target: WordSide;
  response?: string;
  correct: boolean;
  createdAt: number;
  scheduledDueAt: number;
}

export interface Backup {
  format: 'vocab-confusion-log';
  version: 1;
  exportedAt: string;
  pairs: SerializedPair[];
  attempts: Attempt[];
}

export type SerializedPair = Omit<WordPair, 'audioA' | 'audioB'> & {
  audioA?: string;
  audioB?: string;
};

export interface LicenseVerdict {
  valid: boolean;
  reason: 'ok' | 'invalid' | 'expired' | 'revoked' | 'wrong_product' | 'unreachable';
  expires_at?: string | null;
  checkedAt: number;
}
