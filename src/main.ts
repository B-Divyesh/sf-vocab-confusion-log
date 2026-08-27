import './style.css';
import { deletePair, getAttempts, getPairs, importBackup, makeBackup, saveAttemptAndPair, savePair } from './db';
import { applyGrade, formatRelativeDue, FREE_ACTIVE_LIMIT, nextMode, normalizeAnswer, resolvedCsv, samePair } from './model';
import {
  cachedVerdict,
  CHECKOUT_URL,
  consumeReturnedLicense,
  storedToken,
  storeToken,
  verificationDue,
  verifyLicense
} from './license';
import type { Attempt, LicenseVerdict, PracticeMode, WordPair, WordSide } from './types';

type View = 'desk' | 'practice' | 'pairs' | 'data';

interface PracticeSession {
  pairId: string;
  mode: PracticeMode;
  target: WordSide;
  revealed: boolean;
  result?: { correct: boolean; response?: string; resolved: boolean; nextDue: number };
}

interface AppState {
  loading: boolean;
  error?: string;
  pairs: WordPair[];
  attempts: Attempt[];
  view: View;
  dialogOpen: boolean;
  editingId?: string;
  notice?: string;
  practice?: PracticeSession;
  online: boolean;
  license: LicenseVerdict | null;
  licenseChecking: boolean;
  updateReady: boolean;
}

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('The app mount point is missing.');

const state: AppState = {
  loading: true,
  pairs: [],
  attempts: [],
  view: viewFromHash(),
  dialogOpen: false,
  online: navigator.onLine,
  license: cachedVerdict(),
  licenseChecking: false,
  updateReady: false
};

let draftAudio: { a?: Blob; b?: Blob } = {};
let removedAudio = new Set<WordSide>();
let activeRecorder: { recorder: MediaRecorder; stream: MediaStream; side: WordSide } | null = null;
const audioUrls = new WeakMap<Blob, string>();
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function viewFromHash(): View {
  const value = window.location.hash.slice(1);
  return value === 'practice' || value === 'pairs' || value === 'data' ? value : 'desk';
}

function isPro(): boolean {
  return state.license?.valid === true;
}

function activePairs(): WordPair[] {
  return state.pairs.filter((pair) => !pair.resolvedAt);
}

function duePairs(): WordPair[] {
  const now = Date.now();
  return activePairs().filter((pair) => pair.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
}

function audioUrl(blob: Blob): string {
  const known = audioUrls.get(blob);
  if (known) return known;
  const url = URL.createObjectURL(blob);
  audioUrls.set(blob, url);
  return url;
}

function navLink(view: View, label: string, count?: number): string {
  const active = state.view === view;
  return `<a class="nav-link${active ? ' is-active' : ''}" href="#${view}" ${active ? 'aria-current="page"' : ''}>${label}${count ? ` <span class="nav-count" aria-label="${count} due">${count}</span>` : ''}</a>`;
}

function render(): void {
  if (state.loading) {
    app.innerHTML = `<main class="loading-page" id="main-content"><div class="loading-mark" aria-hidden="true"></div><p>Opening your local repair desk…</p></main>`;
    return;
  }
  if (state.error) {
    app.innerHTML = `<main class="error-page" id="main-content"><p class="eyebrow">Local storage error</p><h1>Your repair desk could not open.</h1><p>${escapeHtml(state.error)}</p><button class="button primary" data-retry>Try again</button></main>`;
    app.querySelector('[data-retry]')?.addEventListener('click', () => void loadData());
    return;
  }

  const due = duePairs().length;
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="#desk" aria-label="Vocab Confusion Log, desk">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
        <h1>Vocab Confusion Log</h1>
      </a>
      <nav aria-label="Main navigation">
        ${navLink('desk', 'Desk')}
        ${navLink('practice', 'Practice', due)}
        ${navLink('pairs', 'Pairs')}
        ${navLink('data', isPro() ? 'Data · Pro' : 'Data · Unlock')}
      </nav>
    </header>
    ${!state.online ? '<div class="offline-strip" role="status"><span aria-hidden="true">●</span> Offline — logging, recordings, and practice still work here.</div>' : ''}
    ${state.notice ? `<div class="notice-strip" role="status">${escapeHtml(state.notice)}<button class="icon-button" data-dismiss-notice aria-label="Dismiss notice">×</button></div>` : ''}
    <main id="main-content" tabindex="-1">${renderView()}</main>
    <footer class="site-footer">
      <p>Your words and recordings stay on this device.</p>
      <p><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><span>Original AI-assisted collage · no analytics</span></p>
    </footer>
    ${renderDialog()}
    ${state.updateReady ? '<div class="update-toast" role="status"><span>A fresh version is ready.</span><button class="button small" data-update>Update now</button></div>' : ''}
  `;
  bindEvents();
  if (state.dialogOpen) {
    const dialog = app.querySelector<HTMLDialogElement>('#pair-dialog');
    if (dialog && !dialog.open) dialog.showModal();
  }
}

function renderView(): string {
  if (state.view === 'practice') return renderPractice();
  if (state.view === 'pairs') return renderPairs();
  if (state.view === 'data') return renderData();
  return renderDesk();
}

function renderDesk(): string {
  const active = activePairs();
  const resolved = state.pairs.filter((pair) => pair.resolvedAt);
  const due = duePairs();
  const canAdd = isPro() || active.length < FREE_ACTIVE_LIMIT;
  return `
    <section class="hero-grid" aria-labelledby="desk-title">
      <div class="hero-copy">
        <p class="eyebrow">A repair bench for near-neighbor words</p>
        <h2 id="desk-title">Stop reviewing everything. Repair the mix-up.</h2>
        <p class="lede">Capture the two words, write one sharp contrast, then alternate between saying and spelling them until three delayed attempts come back clean.</p>
        <div class="hero-actions">
          <button class="button primary" data-add>${canAdd ? 'Log a confusion' : 'Unlock more pairs'}</button>
          ${due.length ? '<a class="button secondary" href="#practice">Practise what’s due</a>' : ''}
        </div>
        <p class="microcopy">No streaks. No speech scoring. No account.</p>
      </div>
      <figure class="hero-art">
        <img src="/assets/repair-collage.webp" alt="Two blank paper cards loop between a listening ear and a speaking mouth" width="1200" height="800" decoding="async" fetchpriority="high" />
        <figcaption>Hear it. Produce it. Contrast it.</figcaption>
      </figure>
    </section>
    <section class="status-ledger" aria-label="Repair status">
      <div><strong>${due.length}</strong><span>due now</span></div>
      <div><strong>${active.length}</strong><span>in repair</span></div>
      <div><strong>${resolved.length}</strong><span>resolved</span></div>
    </section>
    ${state.pairs.length === 0 ? renderEmptyState() : renderDeskQueue(due, active)}
    <section class="method-note" aria-labelledby="method-title">
      <p class="eyebrow">The repair loop</p>
      <h2 id="method-title">Three clean, spaced returns.</h2>
      <ol>
        <li><span>01</span><strong>Catch the pair</strong><p>Record the exact mix-up while it is fresh.</p></li>
        <li><span>02</span><strong>Switch the route</strong><p>Move between written production and your own audio.</p></li>
        <li><span>03</span><strong>Let it settle</strong><p>Clean attempts return after one and three days.</p></li>
      </ol>
    </section>
  `;
}

function renderEmptyState(): string {
  return `
    <section class="empty-sheet" aria-labelledby="empty-title">
      <div class="crop-mark" aria-hidden="true"></div>
      <p class="eyebrow">Your desk is clear</p>
      <h2 id="empty-title">Start with the pair that tripped you today.</h2>
      <p>Good entries are small: <em>affect / effect</em>, one contrast cue, and—if useful—your own quick recordings.</p>
      <button class="text-action" data-add>Log the first confusion <span aria-hidden="true">→</span></button>
    </section>`;
}

function renderDeskQueue(due: WordPair[], active: WordPair[]): string {
  const queue = (due.length ? due : active).slice(0, 3);
  return `
    <section class="queue-section" aria-labelledby="queue-title">
      <div class="section-heading">
        <div><p class="eyebrow">${due.length ? 'Ready for another route' : 'Nothing due right now'}</p><h2 id="queue-title">${due.length ? 'On today’s desk' : 'Pairs in repair'}</h2></div>
        <a href="#pairs">See all pairs</a>
      </div>
      <ul class="pair-stack">
        ${queue.map((pair) => `<li>${pairSummary(pair, true)}</li>`).join('')}
      </ul>
    </section>`;
}

function progressDots(pair: WordPair): string {
  return `<span class="progress-dots" aria-label="${pair.cleanStreak} of 3 clean attempts">${[1, 2, 3].map((step) => `<i class="${step <= pair.cleanStreak ? 'filled' : ''}"></i>`).join('')}</span>`;
}

function pairSummary(pair: WordPair, compact = false): string {
  return `
    <article class="pair-card${pair.resolvedAt ? ' is-resolved' : ''}" data-pair-card="${escapeHtml(pair.id)}">
      <div class="pair-words"><span>${escapeHtml(pair.wordA)}</span><i aria-hidden="true">≠</i><span>${escapeHtml(pair.wordB)}</span></div>
      <p>${escapeHtml(pair.contrast)}</p>
      <div class="pair-meta">
        ${progressDots(pair)}
        <span>${pair.resolvedAt ? `Resolved ${new Date(pair.resolvedAt).toLocaleDateString()}` : formatRelativeDue(pair.dueAt)}</span>
        ${pair.audioA && pair.audioB ? '<span class="audio-tag">● Audio ready</span>' : '<span>Text route</span>'}
      </div>
      ${compact ? '' : `<div class="pair-actions"><button class="text-button" data-edit="${escapeHtml(pair.id)}">Edit pair</button><button class="text-button danger" data-delete="${escapeHtml(pair.id)}">Delete</button></div>`}
    </article>`;
}

function ensurePracticeSession(): PracticeSession | undefined {
  if (state.practice) return state.practice;
  const pair = duePairs()[0];
  if (!pair) return undefined;
  const pairAttemptCount = state.attempts.filter((attempt) => attempt.pairId === pair.id).length;
  state.practice = {
    pairId: pair.id,
    mode: nextMode(pair),
    target: pairAttemptCount % 2 === 0 ? 'b' : 'a',
    revealed: false
  };
  return state.practice;
}

function renderPractice(): string {
  const session = ensurePracticeSession();
  if (!session) {
    const next = activePairs().sort((a, b) => a.dueAt - b.dueAt)[0];
    return `
      <section class="practice-empty">
        <div class="stamp success" aria-hidden="true">✓</div>
        <p class="eyebrow">Practice desk</p>
        <h2>Nothing is due.</h2>
        <p>${next ? `Your next pair returns ${escapeHtml(formatRelativeDue(next.dueAt).toLocaleLowerCase())}. Letting it wait is part of the repair.` : 'Log a confusion first; its opening attempt will be ready immediately.'}</p>
        <a class="button primary" href="#desk">Back to the desk</a>
      </section>`;
  }
  const pair = state.pairs.find((item) => item.id === session.pairId);
  if (!pair) {
    state.practice = undefined;
    return renderPractice();
  }
  const targetWord = session.target === 'a' ? pair.wordA : pair.wordB;
  const targetAudio = session.target === 'a' ? pair.audioA : pair.audioB;
  if (session.result) return renderPracticeResult(pair, targetWord, session);
  return `
    <section class="practice-shell" aria-labelledby="practice-title">
      <div class="practice-topline">
        <div><p class="eyebrow">${session.mode === 'audio-text' ? 'Route 2 · audio → text' : 'Route 1 · text → audio'}</p><h2 id="practice-title">${session.mode === 'audio-text' ? 'Listen, then write.' : 'Read, then say.'}</h2></div>
        <span>${duePairs().length} due</span>
      </div>
      <div class="practice-card ${session.mode}">
        ${session.mode === 'audio-text' ? renderAudioTextPrompt(pair, targetAudio) : renderTextAudioPrompt(pair, targetWord, targetAudio, session.revealed)}
      </div>
      <aside class="contrast-slip"><strong>Contrast cue</strong><p>${escapeHtml(pair.contrast)}</p>${pair.mnemonic ? `<p class="mnemonic">Your hook: ${escapeHtml(pair.mnemonic)}</p>` : ''}</aside>
      <p class="practice-note">A miss is useful evidence. It resets this pair’s clean run and brings it back in ten minutes.</p>
    </section>`;
}

function renderAudioTextPrompt(pair: WordPair, targetAudio?: Blob): string {
  return `
    <div class="route-icon ear-icon" aria-hidden="true"></div>
    <p class="prompt-label">Play your recording. Type the word you hear.</p>
    <button class="listen-button" data-play-audio="${targetAudio ? 'practice' : ''}" ${targetAudio ? '' : 'disabled'}><span aria-hidden="true">▶</span> Play recording</button>
    <form class="answer-form" data-answer-form>
      <label for="practice-answer">Write the word</label>
      <div class="answer-row"><input id="practice-answer" name="answer" autocomplete="off" autocapitalize="off" spellcheck="false" required /><button class="button primary" type="submit">Check spelling</button></div>
    </form>
    <p class="pair-hint">One of: <span>${escapeHtml(pair.wordA)}</span> / <span>${escapeHtml(pair.wordB)}</span></p>`;
}

function renderTextAudioPrompt(pair: WordPair, targetWord: string, targetAudio: Blob | undefined, revealed: boolean): string {
  return `
    <p class="prompt-label">Say this word aloud before you reveal the reference.</p>
    <div class="word-prompt">${escapeHtml(targetWord)}</div>
    ${!revealed ? '<button class="button secondary" data-reveal>Reveal reference</button>' : `
      <div class="reference-panel">
        ${targetAudio ? '<button class="listen-button compact" data-play-audio="practice"><span aria-hidden="true">▶</span> Play my recording</button>' : '<p>No recording attached—compare your production with the written pair and contrast cue.</p>'}
        <p>The other word is <strong>${escapeHtml(targetWord === pair.wordA ? pair.wordB : pair.wordA)}</strong>.</p>
        <div class="grade-actions"><button class="button success" data-grade="true">It came back clean</button><button class="button secondary" data-grade="false">I mixed it up</button></div>
      </div>`}`;
}

function renderPracticeResult(pair: WordPair, targetWord: string, session: PracticeSession): string {
  const result = session.result!;
  return `
    <section class="result-sheet ${result.correct ? 'correct' : 'incorrect'}" aria-live="polite">
      <div class="stamp ${result.correct ? 'success' : 'miss'}" aria-hidden="true">${result.correct ? '✓' : '↺'}</div>
      <p class="eyebrow">${result.correct ? 'Clean return logged' : 'Useful miss logged'}</p>
      <h2>${result.resolved ? 'This pair is resolved.' : result.correct ? `${pair.cleanStreak} of 3 clean.` : 'The clean run starts again.'}</h2>
      ${session.mode === 'audio-text' ? `<p>You wrote <strong>${escapeHtml(result.response || 'nothing')}</strong>. The recording was <strong>${escapeHtml(targetWord)}</strong>.</p>` : ''}
      <p>${result.resolved ? 'Three delayed attempts came back clean. The full history stays in your resolved list.' : result.correct ? `It will return ${escapeHtml(formatRelativeDue(result.nextDue).toLocaleLowerCase())}.` : 'It will return in about ten minutes, using the other route when audio is available.'}</p>
      <button class="button primary" data-next-practice>${duePairs().length > 1 ? 'Continue practice' : 'Finish this round'}</button>
    </section>`;
}

function renderPairs(): string {
  const active = activePairs();
  const resolved = state.pairs.filter((pair) => pair.resolvedAt);
  return `
    <section class="page-heading">
      <div><p class="eyebrow">The evidence, not another deck</p><h2>Every confusion pair.</h2><p>Attempt history stays attached, even when a pair is repaired.</p></div>
      <button class="button primary" data-add>${isPro() || active.length < FREE_ACTIVE_LIMIT ? 'Log a confusion' : 'Unlock more pairs'}</button>
    </section>
    ${state.pairs.length ? `
      <div class="search-field"><label for="pair-search">Find a word or cue</label><input type="search" id="pair-search" placeholder="Search your local log" /></div>
      <section class="pair-group" aria-labelledby="active-title"><div class="section-heading"><h2 id="active-title">In repair <span>${active.length}</span></h2></div>${active.length ? `<ul class="pair-list">${active.map((pair) => `<li data-search-text="${escapeHtml(`${pair.wordA} ${pair.wordB} ${pair.contrast} ${pair.mnemonic}`.toLocaleLowerCase())}">${pairSummary(pair)}${attemptHistory(pair)}</li>`).join('')}</ul>` : '<p class="quiet-empty">No active pairs. Your desk has been repaired.</p>'}</section>
      <section class="pair-group" aria-labelledby="resolved-title"><div class="section-heading"><h2 id="resolved-title">Resolved <span>${resolved.length}</span></h2></div>${resolved.length ? `<ul class="pair-list">${resolved.map((pair) => `<li data-search-text="${escapeHtml(`${pair.wordA} ${pair.wordB} ${pair.contrast} ${pair.mnemonic}`.toLocaleLowerCase())}">${pairSummary(pair)}${attemptHistory(pair)}</li>`).join('')}</ul>` : '<p class="quiet-empty">Three clean delayed attempts move a pair here.</p>'}</section>
      <p class="search-empty" hidden>No pairs match that search.</p>` : renderEmptyState()}
  `;
}

function attemptHistory(pair: WordPair): string {
  const history = state.attempts.filter((attempt) => attempt.pairId === pair.id);
  return `<details class="attempt-history"><summary>Attempt history (${history.length})</summary>${history.length ? `<ol>${history.map((attempt) => `<li><span class="attempt-result ${attempt.correct ? 'pass' : 'miss'}">${attempt.correct ? 'Clean' : 'Miss'}</span><span>${attempt.mode === 'audio-text' ? 'Audio → text' : 'Text → audio'}</span><time datetime="${new Date(attempt.createdAt).toISOString()}">${new Date(attempt.createdAt).toLocaleString()}</time></li>`).join('')}</ol>` : '<p>No attempts yet.</p>'}</details>`;
}

function renderData(): string {
  const resolved = state.pairs.filter((pair) => pair.resolvedAt).length;
  const active = activePairs().length;
  const verdictCopy = !storedToken() ? 'Free desk' : state.licenseChecking ? 'Checking license…' : isPro() ? 'Pro is active' : state.license?.reason === 'unreachable' ? 'Could not check while offline' : 'License is not active';
  return `
    <section class="page-heading data-heading">
      <div><p class="eyebrow">Portable by design</p><h2>Own the work you put in.</h2><p>Back up everything, or take a clean CSV of resolved pairs into your next tool.</p></div>
    </section>
    <div class="data-grid">
      <section class="data-panel" aria-labelledby="export-title">
        <span class="panel-number">01</span><h2 id="export-title">Export</h2>
        <p>JSON includes all ${state.pairs.length} pairs, attempt history, and local recordings. CSV includes the ${resolved} resolved text pairs and progress counts.</p>
        <div class="button-stack"><button class="button primary" data-export-json>Back up everything (JSON)</button><button class="button secondary" data-export-csv ${resolved ? '' : 'disabled'}>Export resolved pairs (CSV)</button></div>
      </section>
      <section class="data-panel" aria-labelledby="import-title">
        <span class="panel-number">02</span><h2 id="import-title">Restore</h2>
        <p>Import a JSON backup from this app. Matching record IDs are updated; other pairs stay in place.</p>
        <label class="file-button">Choose JSON backup<input type="file" data-import accept="application/json,.json" /></label>
        <p class="field-status" id="import-status" aria-live="polite"></p>
      </section>
    </div>
    <section class="unlock-sheet" aria-labelledby="unlock-title">
      <div class="price-stamp"><span>US$9</span><small>one time</small></div>
      <div>
        <p class="eyebrow">${escapeHtml(verdictCopy)}</p>
        <h2 id="unlock-title">Keep the free desk, or remove its one limit.</h2>
        <p>The free version holds eight active pairs at once—resolved pairs never count. Pro allows unlimited active pairs on this device. Practice, recordings, offline use, accessibility, and every export remain free.</p>
        ${isPro() ? `<p class="license-good"><span aria-hidden="true">✓</span> Pro is active. You have ${active} active pair${active === 1 ? '' : 's'} with no cap.</p>` : `
          <a class="button primary" href="${escapeHtml(CHECKOUT_URL)}">Buy Pro once</a>
          <p class="microcopy">Secure hosted checkout by Sociobot/Dodo, the merchant of record. Refunds are handled there and revoke the license.</p>`}
        <details class="restore-license" ${storedToken() && !isPro() ? 'open' : ''}>
          <summary>Have a license? Restore it here</summary>
          <form data-license-form><label for="license-token">License token</label><div class="answer-row"><input id="license-token" name="license" autocomplete="off" spellcheck="false" required /><button class="button secondary" type="submit">Verify license</button></div></form>
          <p class="field-status" id="license-status" aria-live="polite">${state.license?.reason === 'unreachable' ? 'The license check needs a connection. Your cached access is unchanged.' : state.license && !state.license.valid ? `This license is ${escapeHtml(state.license.reason.replace('_', ' '))}.` : ''}</p>
        </details>
        <p class="legal-line">Purchase is subject to the <a href="/terms/">terms</a> and <a href="/privacy/">privacy policy</a>.</p>
      </div>
    </section>`;
}

function renderDialog(): string {
  if (!state.dialogOpen) return '';
  const editing = state.editingId ? state.pairs.find((pair) => pair.id === state.editingId) : undefined;
  return `
    <dialog id="pair-dialog" aria-labelledby="dialog-title">
      <form class="pair-form" data-pair-form>
        <div class="dialog-heading"><div><p class="eyebrow">One mix-up, clearly caught</p><h2 id="dialog-title">${editing ? 'Edit this confusion' : 'Log a confusion'}</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Close without saving">×</button></div>
        <p class="form-intro">Both words matter. Add the shortest contrast that would have helped in the moment.</p>
        <div class="word-fields">
          <div class="field"><label for="word-a">Word A <span aria-hidden="true">*</span></label><span class="field-help" id="word-a-help">The word you reached for</span><input id="word-a" name="wordA" value="${escapeHtml(editing?.wordA)}" aria-describedby="word-a-help" required maxlength="80" autocomplete="off" /></div>
          <div class="not-equal" aria-hidden="true">≠</div>
          <div class="field"><label for="word-b">Word B <span aria-hidden="true">*</span></label><span class="field-help" id="word-b-help">The word you meant</span><input id="word-b" name="wordB" value="${escapeHtml(editing?.wordB)}" aria-describedby="word-b-help" required maxlength="80" autocomplete="off" /></div>
        </div>
        <div class="field"><label for="contrast">Contrast cue <span aria-hidden="true">*</span></label><span class="field-help" id="contrast-help">One plain sentence: when does each word belong?</span><textarea id="contrast" name="contrast" aria-describedby="contrast-help" required maxlength="300" rows="3">${escapeHtml(editing?.contrast)}</textarea></div>
        <div class="split-fields">
          <div class="field"><label for="mnemonic">Your mnemonic <span class="optional">Optional</span></label><input id="mnemonic" name="mnemonic" value="${escapeHtml(editing?.mnemonic)}" maxlength="160" /></div>
          <div class="field"><label for="language">Language <span class="optional">Optional</span></label><input id="language" name="language" value="${escapeHtml(editing?.language)}" maxlength="50" placeholder="e.g. English" /></div>
        </div>
        <fieldset class="recording-fieldset"><legend>My reference recordings <span class="optional">Optional</span></legend><p>Record your own voice. Audio stays in this browser and is never speech-scored or uploaded.</p>
          <div class="recording-grid">${recordingControl('a', 'Word A', editing?.audioA)}${recordingControl('b', 'Word B', editing?.audioB)}</div>
        </fieldset>
        <p class="form-error" id="pair-form-error" role="alert"></p>
        <div class="dialog-actions"><button class="button secondary" type="button" data-close-dialog>Cancel</button><button class="button primary" type="submit">${editing ? 'Save changes' : 'Add to repair desk'}</button></div>
      </form>
    </dialog>`;
}

function recordingControl(side: WordSide, label: string, existing?: Blob): string {
  const draft = draftAudio[side];
  const current = draft ?? (!removedAudio.has(side) ? existing : undefined);
  return `<div class="recording-control"><strong>${label}</strong><button class="record-button" type="button" data-record="${side}"><span aria-hidden="true"></span> ${current ? 'Record again' : 'Record'}</button>${current ? `<audio controls preload="metadata" src="${escapeHtml(audioUrl(current))}"><a href="${escapeHtml(audioUrl(current))}">Play recording</a></audio><button class="text-button danger" type="button" data-remove-audio="${side}">Remove audio</button>` : ''}<span class="record-status" id="record-status-${side}" aria-live="polite"></span></div>`;
}

function bindEvents(): void {
  app.querySelectorAll<HTMLElement>('[data-add]').forEach((button) => button.addEventListener('click', openAddDialog));
  app.querySelectorAll<HTMLElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => openEditDialog(button.dataset.edit!)));
  app.querySelectorAll<HTMLElement>('[data-delete]').forEach((button) => button.addEventListener('click', () => void removePair(button.dataset.delete!)));
  app.querySelectorAll<HTMLElement>('[data-close-dialog]').forEach((button) => button.addEventListener('click', closeDialog));
  app.querySelector<HTMLFormElement>('[data-pair-form]')?.addEventListener('submit', (event) => void submitPair(event));
  app.querySelector<HTMLDialogElement>('#pair-dialog')?.addEventListener('close', () => { state.dialogOpen = false; });
  app.querySelectorAll<HTMLElement>('[data-record]').forEach((button) => button.addEventListener('click', () => void toggleRecording(button.dataset.record as WordSide)));
  app.querySelectorAll<HTMLElement>('[data-remove-audio]').forEach((button) => button.addEventListener('click', () => removeRecording(button.dataset.removeAudio as WordSide)));
  app.querySelector('[data-reveal]')?.addEventListener('click', () => { if (state.practice) state.practice.revealed = true; render(); });
  app.querySelectorAll<HTMLElement>('[data-grade]').forEach((button) => button.addEventListener('click', () => void gradePractice(button.dataset.grade === 'true')));
  app.querySelector<HTMLFormElement>('[data-answer-form]')?.addEventListener('submit', (event) => void submitAnswer(event));
  app.querySelector('[data-play-audio]')?.addEventListener('click', () => void playPracticeAudio());
  app.querySelector('[data-next-practice]')?.addEventListener('click', nextPractice);
  app.querySelector('[data-export-json]')?.addEventListener('click', () => void exportJson());
  app.querySelector('[data-export-csv]')?.addEventListener('click', exportCsv);
  app.querySelector<HTMLInputElement>('[data-import]')?.addEventListener('change', (event) => void restoreBackup(event));
  app.querySelector<HTMLFormElement>('[data-license-form]')?.addEventListener('submit', (event) => void restoreLicense(event));
  app.querySelector('[data-dismiss-notice]')?.addEventListener('click', () => { state.notice = undefined; render(); });
  app.querySelector('[data-update]')?.addEventListener('click', applyUpdate);
  app.querySelector<HTMLInputElement>('#pair-search')?.addEventListener('input', filterPairs);
}

function openAddDialog(): void {
  if (!isPro() && activePairs().length >= FREE_ACTIVE_LIMIT) {
    state.view = 'data';
    state.notice = `The free desk holds ${FREE_ACTIVE_LIMIT} active pairs. Resolve one or unlock unlimited pairs.`;
    window.location.hash = 'data';
    render();
    return;
  }
  draftAudio = {};
  removedAudio = new Set();
  state.editingId = undefined;
  state.dialogOpen = true;
  render();
}

function openEditDialog(id: string): void {
  draftAudio = {};
  removedAudio = new Set();
  state.editingId = id;
  state.dialogOpen = true;
  render();
}

function closeDialog(): void {
  if (activeRecorder) {
    activeRecorder.recorder.stop();
    activeRecorder.stream.getTracks().forEach((track) => track.stop());
    activeRecorder = null;
  }
  state.dialogOpen = false;
  state.editingId = undefined;
  draftAudio = {};
  removedAudio = new Set();
  render();
}

async function submitPair(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const error = form.querySelector<HTMLElement>('#pair-form-error')!;
  const data = new FormData(form);
  const wordA = String(data.get('wordA') ?? '').trim();
  const wordB = String(data.get('wordB') ?? '').trim();
  const contrast = String(data.get('contrast') ?? '').trim();
  if (normalizeAnswer(wordA) === normalizeAnswer(wordB)) {
    error.textContent = 'The two words need to be different. Check the spelling and try again.';
    form.querySelector<HTMLInputElement>('#word-b')?.focus();
    return;
  }
  const duplicate = state.pairs.find((pair) => pair.id !== state.editingId && samePair(pair, { wordA, wordB }));
  if (duplicate) {
    error.textContent = `That pair is already on your desk as “${duplicate.wordA} / ${duplicate.wordB}”. Edit the existing pair instead.`;
    return;
  }
  const editing = state.editingId ? state.pairs.find((pair) => pair.id === state.editingId) : undefined;
  const now = Date.now();
  const pair: WordPair = {
    id: editing?.id ?? crypto.randomUUID(),
    wordA,
    wordB,
    contrast,
    mnemonic: String(data.get('mnemonic') ?? '').trim(),
    language: String(data.get('language') ?? '').trim(),
    createdAt: editing?.createdAt ?? now,
    updatedAt: now,
    dueAt: editing?.dueAt ?? now,
    cleanStreak: editing?.cleanStreak ?? 0,
    ...(editing?.resolvedAt ? { resolvedAt: editing.resolvedAt } : {}),
    ...(editing?.lastMode ? { lastMode: editing.lastMode } : {}),
    ...(draftAudio.a ? { audioA: draftAudio.a } : !removedAudio.has('a') && editing?.audioA ? { audioA: editing.audioA } : {}),
    ...(draftAudio.b ? { audioB: draftAudio.b } : !removedAudio.has('b') && editing?.audioB ? { audioB: editing.audioB } : {})
  };
  try {
    await savePair(pair);
    state.dialogOpen = false;
    state.editingId = undefined;
    draftAudio = {};
    removedAudio = new Set();
    state.notice = editing ? 'Pair updated on this device.' : 'Confusion logged. Its first route is ready now.';
    await loadData(false);
  } catch (reason) {
    error.textContent = reason instanceof Error ? reason.message : 'The pair could not be saved. Check local storage and try again.';
  }
}

async function removePair(id: string): Promise<void> {
  const pair = state.pairs.find((item) => item.id === id);
  if (!pair || !window.confirm(`Delete “${pair.wordA} / ${pair.wordB}” and its full attempt history from this device? This cannot be undone.`)) return;
  try {
    await deletePair(id);
    state.notice = `Deleted “${pair.wordA} / ${pair.wordB}”.`;
    await loadData(false);
  } catch (reason) {
    state.notice = reason instanceof Error ? reason.message : 'That pair could not be deleted.';
    render();
  }
}

async function toggleRecording(side: WordSide): Promise<void> {
  const status = app.querySelector<HTMLElement>(`#record-status-${side}`);
  const button = app.querySelector<HTMLButtonElement>(`[data-record="${side}"]`);
  if (activeRecorder) {
    if (activeRecorder.side !== side) {
      if (status) status.textContent = 'Stop the other recording first.';
      return;
    }
    activeRecorder.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    if (status) status.textContent = 'Audio recording is not supported in this browser. You can still use the text route.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      draftAudio[side] = blob;
      removedAudio.delete(side);
      stream.getTracks().forEach((track) => track.stop());
      activeRecorder = null;
      render();
      const updatedStatus = app.querySelector<HTMLElement>(`#record-status-${side}`);
      if (updatedStatus) updatedStatus.textContent = 'Recording saved locally. Save the pair to keep it.';
    };
    recorder.start();
    activeRecorder = { recorder, stream, side };
    if (button) button.innerHTML = '<span aria-hidden="true"></span> Stop recording';
    if (status) status.textContent = 'Recording now…';
  } catch {
    if (status) status.textContent = 'Microphone access was not granted. Allow it in browser settings or continue without audio.';
  }
}

function removeRecording(side: WordSide): void {
  delete draftAudio[side];
  removedAudio.add(side);
  render();
}

async function playPracticeAudio(): Promise<void> {
  const session = state.practice;
  const pair = session && state.pairs.find((item) => item.id === session.pairId);
  const blob = pair && session ? (session.target === 'a' ? pair.audioA : pair.audioB) : undefined;
  if (!blob) return;
  try {
    await new Audio(audioUrl(blob)).play();
  } catch {
    state.notice = 'The recording could not play. Try the play button again or re-record it from the pair editor.';
    render();
  }
}

async function submitAnswer(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const response = String(new FormData(form).get('answer') ?? '');
  const session = state.practice;
  const pair = session && state.pairs.find((item) => item.id === session.pairId);
  if (!session || !pair) return;
  const target = session.target === 'a' ? pair.wordA : pair.wordB;
  await gradePractice(normalizeAnswer(response) === normalizeAnswer(target), response.trim());
}

async function gradePractice(correct: boolean, response?: string): Promise<void> {
  const session = state.practice;
  const pair = session && state.pairs.find((item) => item.id === session.pairId);
  if (!session || !pair) return;
  const now = Date.now();
  const updated = applyGrade(pair, correct, session.mode, now);
  const attempt: Attempt = {
    id: crypto.randomUUID(),
    pairId: pair.id,
    mode: session.mode,
    target: session.target,
    ...(response !== undefined ? { response } : {}),
    correct,
    createdAt: now,
    scheduledDueAt: pair.dueAt
  };
  try {
    await saveAttemptAndPair(attempt, updated);
    state.pairs = state.pairs.map((item) => item.id === updated.id ? updated : item);
    state.attempts = [attempt, ...state.attempts];
    session.result = { correct, response, resolved: Boolean(updated.resolvedAt), nextDue: updated.dueAt };
    render();
  } catch (reason) {
    state.notice = reason instanceof Error ? reason.message : 'The attempt could not be saved. Try again.';
    render();
  }
}

function nextPractice(): void {
  state.practice = undefined;
  if (!duePairs().length) window.location.hash = 'desk';
  render();
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportJson(): Promise<void> {
  try {
    const backup = await makeBackup(state.pairs, state.attempts);
    download(`vocab-confusion-log-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    state.notice = 'Full JSON backup prepared on this device.';
    render();
  } catch (reason) {
    state.notice = reason instanceof Error ? reason.message : 'The backup could not be prepared.';
    render();
  }
}

function exportCsv(): void {
  const csv = resolvedCsv(state.pairs, state.attempts);
  download(`resolved-vocab-pairs-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  state.notice = 'Resolved-pairs CSV prepared.';
  render();
}

async function restoreBackup(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const status = app.querySelector<HTMLElement>('#import-status');
  const file = input.files?.[0];
  if (!file || !status) return;
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    const preview = parsed as { pairs?: unknown[]; attempts?: unknown[] };
    const pairCount = Array.isArray(preview.pairs) ? preview.pairs.length : 0;
    if (!window.confirm(`Import ${pairCount} pair${pairCount === 1 ? '' : 's'} from “${file.name}”? Matching IDs will be updated; your other pairs will stay.`)) {
      input.value = '';
      return;
    }
    const counts = await importBackup(parsed);
    status.textContent = `Restored ${counts.pairs} pairs and ${counts.attempts} attempts.`;
    state.notice = 'Backup restored into this device.';
    await loadData(false);
  } catch (reason) {
    status.textContent = reason instanceof Error ? reason.message : 'That file could not be imported.';
  }
}

async function restoreLicense(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const token = String(new FormData(form).get('license') ?? '').trim();
  if (!token) return;
  storeToken(token);
  state.licenseChecking = true;
  render();
  state.license = await verifyLicense(token);
  state.licenseChecking = false;
  state.notice = state.license.valid ? 'Pro restored on this device.' : state.license.reason === 'unreachable' ? 'The license could not be checked. Connect to the internet and try again.' : `This license is ${state.license.reason.replace('_', ' ')}.`;
  render();
}

function filterPairs(event: Event): void {
  const query = (event.currentTarget as HTMLInputElement).value.trim().toLocaleLowerCase();
  let shown = 0;
  app.querySelectorAll<HTMLElement>('[data-search-text]').forEach((item) => {
    const matches = !query || (item.dataset.searchText ?? '').includes(query);
    item.hidden = !matches;
    if (matches) shown += 1;
  });
  const empty = app.querySelector<HTMLElement>('.search-empty');
  if (empty) empty.hidden = shown !== 0;
}

async function loadData(showLoading = true): Promise<void> {
  if (showLoading) {
    state.loading = true;
    state.error = undefined;
    render();
  }
  try {
    [state.pairs, state.attempts] = await Promise.all([getPairs(), getAttempts()]);
    state.loading = false;
    state.error = undefined;
    render();
  } catch (reason) {
    state.loading = false;
    state.error = reason instanceof Error ? reason.message : 'This browser blocked local storage.';
    render();
  }
}

async function initializeLicense(): Promise<void> {
  const returned = consumeReturnedLicense();
  const token = returned ?? storedToken();
  if (!token || (!returned && !verificationDue(state.license)) || !navigator.onLine) return;
  state.licenseChecking = true;
  render();
  state.license = await verifyLicense(token);
  state.licenseChecking = false;
  if (returned) state.notice = state.license.valid ? 'Purchase verified. Pro is active on this device.' : 'The returned license could not be verified.';
  render();
}

function applyUpdate(): void {
  serviceWorkerRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
  if (serviceWorkerRegistration.waiting) {
    state.updateReady = true;
    render();
  }
  serviceWorkerRegistration.addEventListener('updatefound', () => {
    const worker = serviceWorkerRegistration?.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        state.updateReady = true;
        render();
      }
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) window.location.reload(); });
}

window.addEventListener('hashchange', () => {
  state.view = viewFromHash();
  state.practice = undefined;
  render();
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>('#main-content')?.focus());
});
window.addEventListener('online', () => { state.online = true; render(); void initializeLicense(); });
window.addEventListener('offline', () => { state.online = false; render(); });

void loadData().then(() => void initializeLicense());
void registerServiceWorker();
