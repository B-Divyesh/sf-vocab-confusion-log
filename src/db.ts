import type { Attempt, Backup, SerializedPair, WordPair } from './types';

const DB_NAME = 'vocab-confusion-log';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pairs')) db.createObjectStore('pairs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('attempts')) {
        const store = db.createObjectStore('attempts', { keyPath: 'id' });
        store.createIndex('pairId', 'pairId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The local database could not be opened.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('A local database request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('The local database change was cancelled.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('The local database change failed.'));
  });
}

export async function getPairs(): Promise<WordPair[]> {
  const db = await openDatabase();
  const result = await requestResult(db.transaction('pairs').objectStore('pairs').getAll() as IDBRequest<WordPair[]>);
  db.close();
  return result.sort((a, b) => a.dueAt - b.dueAt || b.updatedAt - a.updatedAt);
}

export async function getAttempts(): Promise<Attempt[]> {
  const db = await openDatabase();
  const result = await requestResult(db.transaction('attempts').objectStore('attempts').getAll() as IDBRequest<Attempt[]>);
  db.close();
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePair(pair: WordPair): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('pairs', 'readwrite');
  transaction.objectStore('pairs').put(pair);
  await transactionDone(transaction);
  db.close();
}

export async function saveAttemptAndPair(attempt: Attempt, pair: WordPair): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['pairs', 'attempts'], 'readwrite');
  transaction.objectStore('pairs').put(pair);
  transaction.objectStore('attempts').put(attempt);
  await transactionDone(transaction);
  db.close();
}

export async function deletePair(id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['pairs', 'attempts'], 'readwrite');
  transaction.objectStore('pairs').delete(id);
  const index = transaction.objectStore('attempts').index('pairId');
  const keys = await requestResult(index.getAllKeys(IDBKeyRange.only(id)));
  for (const key of keys) transaction.objectStore('attempts').delete(key);
  await transactionDone(transaction);
  db.close();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('A recording could not be included in the backup.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',');
  if (!header || !encoded || !header.startsWith('data:') || !header.includes(';base64')) throw new Error('A recording in this backup is invalid.');
  const mime = header.slice(5, header.indexOf(';')) || 'audio/webm';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

export async function makeBackup(pairs: WordPair[], attempts: Attempt[]): Promise<Backup> {
  const serialized: SerializedPair[] = [];
  for (const pair of pairs) {
    const { audioA, audioB, ...rest } = pair;
    serialized.push({
      ...rest,
      ...(audioA ? { audioA: await blobToDataUrl(audioA) } : {}),
      ...(audioB ? { audioB: await blobToDataUrl(audioB) } : {})
    });
  }
  return {
    format: 'vocab-confusion-log',
    version: 1,
    exportedAt: new Date().toISOString(),
    pairs: serialized,
    attempts
  };
}

function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Attempt>;
  return typeof item.id === 'string' && typeof item.pairId === 'string' &&
    (item.mode === 'text-audio' || item.mode === 'audio-text') &&
    (item.target === 'a' || item.target === 'b') && typeof item.correct === 'boolean' &&
    typeof item.createdAt === 'number' && typeof item.scheduledDueAt === 'number';
}

export async function importBackup(value: unknown): Promise<{ pairs: number; attempts: number }> {
  if (!value || typeof value !== 'object') throw new Error('Choose a Vocab Confusion Log JSON backup.');
  const backup = value as Partial<Backup>;
  if (backup.format !== 'vocab-confusion-log' || backup.version !== 1 || !Array.isArray(backup.pairs) || !Array.isArray(backup.attempts)) {
    throw new Error('This is not a supported Vocab Confusion Log backup.');
  }

  const pairs: WordPair[] = backup.pairs.map((value) => {
    if (!value || typeof value !== 'object') throw new Error('A pair in this backup is invalid.');
    const item = value as Partial<SerializedPair>;
    if (typeof item.id !== 'string' || typeof item.wordA !== 'string' || typeof item.wordB !== 'string' ||
      typeof item.contrast !== 'string' || typeof item.mnemonic !== 'string' || typeof item.language !== 'string' ||
      typeof item.createdAt !== 'number' || typeof item.updatedAt !== 'number' || typeof item.dueAt !== 'number' ||
      typeof item.cleanStreak !== 'number') throw new Error('A pair in this backup is missing required fields.');
    const { audioA, audioB, ...rest } = item;
    return {
      ...(rest as WordPair),
      ...(audioA ? { audioA: dataUrlToBlob(audioA) } : {}),
      ...(audioB ? { audioB: dataUrlToBlob(audioB) } : {})
    };
  });
  if (!backup.attempts.every(isAttempt)) throw new Error('An attempt in this backup is invalid.');

  const db = await openDatabase();
  const transaction = db.transaction(['pairs', 'attempts'], 'readwrite');
  for (const pair of pairs) transaction.objectStore('pairs').put(pair);
  for (const attempt of backup.attempts) transaction.objectStore('attempts').put(attempt);
  await transactionDone(transaction);
  db.close();
  return { pairs: pairs.length, attempts: backup.attempts.length };
}
