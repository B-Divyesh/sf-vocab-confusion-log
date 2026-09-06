import './style.css';
import { activateSkipLink } from './skip-link';
import { deletePair, getAttempts, getPairs, importBackup, makeBackup, replaceAllData, saveAttemptAndPair, savePair, setDatabaseName } from './db';
import { applyGrade, DAY, formatRelativeDue, FREE_ACTIVE_LIMIT, nextMode, normalizeAnswer, resolvedCsv, samePair } from './model';
import {
  cachedVerdict,
  BILLING_AVAILABLE,
  CHECKOUT_URL,
  consumeReturnedLicense,
  storedToken,
  storeToken,
  setLicenseStoragePrefix,
  verificationDue,
  verifyLicense
} from './license';
import type { Attempt, LicenseVerdict, PracticeMode, WordPair, WordSide } from './types';

type View = 'desk' | 'practice' | 'pairs' | 'data';

const isDemo = window.location.pathname === '/demo' || window.location.pathname.startsWith('/demo/');
const routeBase = isDemo ? '/demo' : '/log';
const demoSeedKey = 'demo:vocab-confusion-log:seeded';
setDatabaseName(isDemo ? 'demo:vocab-confusion-log' : 'vocab-confusion-log');
setLicenseStoragePrefix(isDemo ? 'demo:' : '');

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
activateSkipLink();

const state: AppState = {
  loading: true,
  pairs: [],
  attempts: [],
  view: viewFromPath(),
  dialogOpen: false,
  online: navigator.onLine,
  license: cachedVerdict(),
  licenseChecking: false,
  updateReady: false
};

let draftAudio: { a?: Blob; b?: Blob } = {};
let draftFields: { wordA: string; wordB: string; contrast: string; mnemonic: string; language: string } | undefined;
let removedAudio = new Set<WordSide>();
let activeRecorder: { recorder: MediaRecorder; stream: MediaStream; side: WordSide } | null = null;
const audioUrls = new WeakMap<Blob, string>();
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let updateRequested = false;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function viewFromPath(): View {
  const value = window.location.pathname.replace(routeBase, '').replaceAll('/', '');
  return value === 'practice' || value === 'pairs' || value === 'data' ? value : 'desk';
}

function viewUrl(view: View): string {
  return view === 'desk' ? `${routeBase}/` : `${routeBase}/${view}/`;
}

function viewTitle(view: View): string {
  const labels: Record<View, string> = { desk: isDemo ? 'Demo' : 'Log', practice: 'Practice', pairs: 'Pairs', data: 'Data' };
  const label = labels[view];
  return `${label} — Vocab Confusion Log`;
}

function updateRouteMetadata(): void {
  const title = viewTitle(state.view);
  const absoluteUrl = `${window.location.origin}${viewUrl(state.view)}`;
  document.title = title;
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', absoluteUrl);
  document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute('content', absoluteUrl);
  document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute('content', title);
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
  return `<a class="nav-link${active ? ' is-active' : ''}" href="${viewUrl(view)}" data-view="${view}" ${active ? 'aria-current="page"' : ''}>${label}${count ? ` <span class="nav-count" aria-label="${count} due">${count}</span>` : ''}</a>`;
}

function render(): void {
  updateRouteMetadata();
  if (state.loading) {
    app.innerHTML = `<main class="loading-page" id="main-content" tabindex="-1"><div class="loading-mark" aria-hidden="true"></div><p>Opening your confusion log…</p></main>`;
    return;
  }
  if (state.error) {
    app.innerHTML = `<main class="error-page" id="main-content" tabindex="-1"><p class="eyebrow">Local storage error</p><h1>Your confusion log could not open</h1><p>${escapeHtml(state.error)}</p><button class="button primary" data-retry>Try again</button></main>`;
    app.querySelector('[data-retry]')?.addEventListener('click', () => void loadData());
    return;
  }

  const due = duePairs().length;
  app.innerHTML = `
    ${isDemo ? `<aside class="demo-banner" aria-label="Demo mode"><strong>Demo — sample data, nothing is saved</strong><span>Changes stay separate from your real log.</span><div><button class="text-button" data-reset-demo>Reset demo</button><a class="button small" href="/log/" data-leave-demo>Start for real</a></div></aside>` : ''}
    <header class="site-header">
      <a class="brand" href="/" ${isDemo ? 'data-leave-demo' : ''} aria-label="Vocab Confusion Log home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
        <span>Vocab Confusion Log</span>
      </a>
      <nav aria-label="Main navigation">
        ${navLink('desk', 'Log')}
        ${navLink('practice', 'Practice', due)}
        ${navLink('pairs', 'Pairs')}
        ${navLink('data', isPro() ? 'Data · Pro' : 'Data')}
      </nav>
    </header>
    <div class="sr-only" role="status" aria-live="polite">${escapeHtml(viewTitle(state.view))}</div>
    ${!state.online ? '<div class="offline-strip" role="status"><span aria-hidden="true">●</span> Offline — logging, recordings, and practice still work here.</div>' : ''}
    ${state.notice ? `<div class="notice-strip" role="status">${escapeHtml(state.notice)}<button class="icon-button" data-dismiss-notice aria-label="Dismiss notice">×</button></div>` : ''}
    <main id="main-content" tabindex="-1">${renderView()}</main>
    <footer class="site-footer">
      <p>Practise the word pairs you repeatedly confuse.</p>
      <p><a href="/privacy/" ${isDemo ? 'data-leave-demo' : ''}>Privacy</a><a href="/terms/" ${isDemo ? 'data-leave-demo' : ''}>Terms</a><span>Built by Param Factory</span><span>Version 1.1.0 · original AI-assisted collage</span></p>
    </footer>
    ${renderDialog()}
    ${state.updateReady ? '<div class="update-toast" role="status"><span>A fresh version is ready.</span><button class="button small" data-update>Update now</button></div>' : ''}
  `;
  bindEvents();
  if (state.dialogOpen) {
    const dialog = app.querySelector<HTMLDialogElement>('#pair-dialog');
    if (dialog && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => dialog.querySelector<HTMLInputElement>('#word-a')?.focus());
    }
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
        <p class="eyebrow">Focused practice for repeated word mix-ups</p>
        <h1 id="desk-title">Practise the words you mix up</h1>
        <p class="lede">Save two confusing words and one clear contrast. Then practise saying and spelling them until three delayed attempts are correct.</p>
        <div class="hero-actions">
          <button class="button primary" data-add>${canAdd ? 'Log a confusion pair' : 'Unlock more pairs'}</button>
          ${due.length ? `<a class="button secondary" href="${viewUrl('practice')}" data-view="practice">Practise what is due</a>` : ''}
        </div>
        <p class="microcopy">No general word lists. No speech scoring. No account.</p>
      </div>
      <figure class="hero-art">
        <img src="/assets/repair-collage.webp" alt="Two blank paper cards loop between a listening ear and a speaking mouth" width="1200" height="800" decoding="async" fetchpriority="high" />
        <figcaption>Text and audio practice for one confusing pair.</figcaption>
      </figure>
    </section>
    <section class="status-ledger" aria-label="Repair status">
      <div><strong>${due.length}</strong><span>due now</span></div>
      <div><strong>${active.length}</strong><span>active pairs</span></div>
      <div><strong>${resolved.length}</strong><span>resolved</span></div>
    </section>
    ${state.pairs.length === 0 ? renderEmptyState() : renderDeskQueue(due, active)}
    <section class="method-note" aria-labelledby="method-title">
      <p class="eyebrow">How practice works</p>
      <h2 id="method-title">Complete three delayed attempts</h2>
      <ol>
        <li><span>01</span><strong>Save the pair</strong><p>Add the exact mix-up and a short contrast cue.</p></li>
        <li><span>02</span><strong>Change the prompt</strong><p>Switch between written prompts and your own audio.</p></li>
        <li><span>03</span><strong>Complete the schedule</strong><p>Correct attempts return after one and three days.</p></li>
      </ol>
    </section>
  `;
}

function renderEmptyState(): string {
  return `
    <section class="empty-sheet" aria-labelledby="empty-title">
      <div class="crop-mark" aria-hidden="true"></div>
      <p class="eyebrow">No pairs yet</p>
      <h2 id="empty-title">Add the two words you confused today</h2>
      <p>For example, add <em>affect / effect</em>, one contrast cue, and optional recordings.</p>
      <button class="text-action" data-add>Log your first pair <span aria-hidden="true">→</span></button>
    </section>`;
}

function renderDeskQueue(due: WordPair[], active: WordPair[]): string {
  const queue = (due.length ? due : active).slice(0, 3);
  return `
    <section class="queue-section" aria-labelledby="queue-title">
      <div class="section-heading">
        <div><p class="eyebrow">${due.length ? 'Ready to practise' : 'Nothing due right now'}</p><h2 id="queue-title">${due.length ? 'Pairs due now' : 'Active pairs'}</h2></div>
        <a href="${viewUrl('pairs')}" data-view="pairs">See all pairs</a>
      </div>
      <ul class="pair-stack">
        ${queue.map((pair) => `<li>${pairSummary(pair, true)}</li>`).join('')}
      </ul>
    </section>`;
}

function progressDots(pair: WordPair): string {
  return `<span class="progress-dots" role="img" aria-label="${pair.cleanStreak} of 3 correct attempts">${[1, 2, 3].map((step) => `<i class="${step <= pair.cleanStreak ? 'filled' : ''}"></i>`).join('')}</span>`;
}

function pairSummary(pair: WordPair, compact = false): string {
  return `
    <article class="pair-card${pair.resolvedAt ? ' is-resolved' : ''}" data-pair-card="${escapeHtml(pair.id)}">
      <div class="pair-words"><span>${escapeHtml(pair.wordA)}</span><i aria-hidden="true">≠</i><span>${escapeHtml(pair.wordB)}</span></div>
      <p>${escapeHtml(pair.contrast)}</p>
      <div class="pair-meta">
        ${progressDots(pair)}
        <span>${pair.resolvedAt ? `Resolved ${new Date(pair.resolvedAt).toLocaleDateString()}` : formatRelativeDue(pair.dueAt)}</span>
        ${pair.audioA && pair.audioB ? '<span class="audio-tag">● Audio ready</span>' : '<span>Text practice</span>'}
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
        <p class="eyebrow">Practice</p>
        <h1>Nothing is due</h1>
        <p>${next ? `Your next pair returns ${escapeHtml(formatRelativeDue(next.dueAt).toLocaleLowerCase())}. Wait until then for the next attempt.` : 'Log a confusion pair first. Its first attempt is ready immediately.'}</p>
        <a class="button primary" href="${viewUrl('desk')}" data-view="desk">Back to your log</a>
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
        <div><p class="eyebrow">${session.mode === 'audio-text' ? 'Audio → text practice' : 'Text → audio practice'}</p><h1 id="practice-title">${session.mode === 'audio-text' ? 'Listen, then write' : 'Read, then say'}</h1></div>
        <span>${duePairs().length} due</span>
      </div>
      <div class="practice-card ${session.mode}">
        ${session.mode === 'audio-text' ? renderAudioTextPrompt(pair, targetAudio) : renderTextAudioPrompt(pair, targetWord, targetAudio, session.revealed)}
      </div>
      <aside class="contrast-slip"><strong>Contrast cue</strong><p>${escapeHtml(pair.contrast)}</p>${pair.mnemonic ? `<p class="mnemonic">Your hook: ${escapeHtml(pair.mnemonic)}</p>` : ''}</aside>
      <p class="practice-note">A wrong answer resets the count and schedules this pair again in ten minutes.</p>
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
      <h1>${result.resolved ? 'This pair is resolved' : result.correct ? `${pair.cleanStreak} of 3 correct` : 'The correct-attempt count starts again'}</h1>
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
      <div><p class="eyebrow">Your saved practice</p><h1>Review your confusion pairs</h1><p>Each pair keeps its attempt history after it is resolved.</p></div>
      <button class="button primary" data-add>${isPro() || active.length < FREE_ACTIVE_LIMIT ? 'Log a confusion pair' : 'Unlock more pairs'}</button>
    </section>
    ${state.pairs.length ? `
      <div class="search-field"><label for="pair-search">Find a word or cue</label><input type="search" id="pair-search" placeholder="Search your local log" /></div>
      <section class="pair-group" aria-labelledby="active-title"><div class="section-heading"><h2 id="active-title">Active <span>${active.length}</span></h2></div>${active.length ? `<ul class="pair-list">${active.map((pair) => `<li data-search-text="${escapeHtml(`${pair.wordA} ${pair.wordB} ${pair.contrast} ${pair.mnemonic}`.toLocaleLowerCase())}">${pairSummary(pair)}${attemptHistory(pair)}</li>`).join('')}</ul>` : '<p class="quiet-empty">No active pairs. Add a new pair when you confuse two words.</p>'}</section>
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
  const verdictCopy = !storedToken() ? 'Free plan' : state.licenseChecking ? 'Checking license…' : isPro() ? 'Pro is active' : state.license?.reason === 'unreachable' ? 'Could not check while offline' : 'License is not active';
  return `
    <section class="page-heading data-heading">
      <div><p class="eyebrow">Your data</p><h1>Export or restore your data</h1><p>Back up every record, or export resolved pairs as CSV.</p></div>
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
        <h2 id="unlock-title">Choose your active-pair limit</h2>
        <p>The free version holds eight active pairs at once—resolved pairs never count. Pro allows unlimited active pairs on this device. Practice, recordings, offline use, accessibility, and every export remain free.</p>
        ${isPro() ? `<p class="license-good"><span aria-hidden="true">✓</span> Pro is active. You have ${active} active pair${active === 1 ? '' : 's'} with no cap.</p>` : BILLING_AVAILABLE ? `
          <a class="button primary" href="${escapeHtml(CHECKOUT_URL)}">Buy Pro for US$9</a>
          <p class="microcopy">This is a one-time purchase through Sociobot/Dodo, the merchant of record. Refunds are handled there.</p>` : `
          <p class="billing-status"><strong>US$9 one time.</strong> New checkout is pending billing registration. The free app and existing license restore still work.</p>`}
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
  const fields = draftFields ?? {
    wordA: editing?.wordA ?? '',
    wordB: editing?.wordB ?? '',
    contrast: editing?.contrast ?? '',
    mnemonic: editing?.mnemonic ?? '',
    language: editing?.language ?? ''
  };
  return `
    <dialog id="pair-dialog" aria-labelledby="dialog-title">
      <form class="pair-form" data-pair-form>
        <div class="dialog-heading"><div><p class="eyebrow">Confusion pair</p><h2 id="dialog-title">${editing ? 'Edit this pair' : 'Log a confusion pair'}</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Close without saving">×</button></div>
        <p class="form-intro">Add both words and the shortest contrast that explains the difference.</p>
        <div class="word-fields">
          <div class="field"><label for="word-a">Word A <span aria-hidden="true">*</span></label><span class="field-help" id="word-a-help">The word you reached for</span><input id="word-a" name="wordA" value="${escapeHtml(fields.wordA)}" aria-describedby="word-a-help" required maxlength="80" autocomplete="off" /></div>
          <div class="not-equal" aria-hidden="true">≠</div>
          <div class="field"><label for="word-b">Word B <span aria-hidden="true">*</span></label><span class="field-help" id="word-b-help">The word you meant</span><input id="word-b" name="wordB" value="${escapeHtml(fields.wordB)}" aria-describedby="word-b-help" required maxlength="80" autocomplete="off" /></div>
        </div>
        <div class="field"><label for="contrast">Contrast cue <span aria-hidden="true">*</span></label><span class="field-help" id="contrast-help">One plain sentence: when does each word belong?</span><textarea id="contrast" name="contrast" aria-describedby="contrast-help" required maxlength="300" rows="3">${escapeHtml(fields.contrast)}</textarea></div>
        <div class="split-fields">
          <div class="field"><label for="mnemonic">Your mnemonic <span class="optional">Optional</span></label><input id="mnemonic" name="mnemonic" value="${escapeHtml(fields.mnemonic)}" maxlength="160" /></div>
          <div class="field"><label for="language">Language <span class="optional">Optional</span></label><input id="language" name="language" value="${escapeHtml(fields.language)}" maxlength="50" placeholder="e.g. English" /></div>
        </div>
        <fieldset class="recording-fieldset"><legend>My reference recordings <span class="optional">Optional</span></legend><p>Record your own voice. Audio stays in this browser and is never speech-scored or uploaded.</p>
          <div class="recording-grid">${recordingControl('a', 'Word A', editing?.audioA)}${recordingControl('b', 'Word B', editing?.audioB)}</div>
        </fieldset>
        <p class="form-error" id="pair-form-error" role="alert"></p>
        <div class="dialog-actions"><button class="button secondary" type="button" data-close-dialog>Cancel</button><button class="button primary" type="submit">${editing ? 'Save changes' : 'Add to log'}</button></div>
      </form>
    </dialog>`;
}

function recordingControl(side: WordSide, label: string, existing?: Blob): string {
  const draft = draftAudio[side];
  const current = draft ?? (!removedAudio.has(side) ? existing : undefined);
  return `<div class="recording-control"><strong>${label}</strong><button class="record-button" type="button" data-record="${side}"><span aria-hidden="true"></span> ${current ? 'Record again' : 'Record'}</button>${current ? `<audio controls preload="metadata" src="${escapeHtml(audioUrl(current))}"><a href="${escapeHtml(audioUrl(current))}">Play recording</a></audio><button class="text-button danger" type="button" data-remove-audio="${side}">Remove audio</button>` : ''}<span class="record-status" id="record-status-${side}" aria-live="polite"></span></div>`;
}

function bindEvents(): void {
  app.querySelectorAll<HTMLAnchorElement>('[data-view]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    navigateTo(link.dataset.view as View);
  }));
  app.querySelector('[data-reset-demo]')?.addEventListener('click', () => void resetDemo());
  app.querySelectorAll<HTMLAnchorElement>('[data-leave-demo]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    void leaveDemo(link.href);
  }));
  app.querySelectorAll<HTMLElement>('[data-add]').forEach((button) => button.addEventListener('click', openAddDialog));
  app.querySelectorAll<HTMLElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => openEditDialog(button.dataset.edit!)));
  app.querySelectorAll<HTMLElement>('[data-delete]').forEach((button) => button.addEventListener('click', () => void removePair(button.dataset.delete!)));
  app.querySelectorAll<HTMLElement>('[data-close-dialog]').forEach((button) => button.addEventListener('click', closeDialog));
  app.querySelector<HTMLFormElement>('[data-pair-form]')?.addEventListener('submit', (event) => void submitPair(event));
  app.querySelector<HTMLDialogElement>('#pair-dialog')?.addEventListener('close', () => {
    if (!state.dialogOpen) return;
    state.dialogOpen = false;
    state.editingId = undefined;
    render();
    window.requestAnimationFrame(() => app.querySelector<HTMLElement>('[data-add]')?.focus());
  });
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
    state.notice = `The free plan holds ${FREE_ACTIVE_LIMIT} active pairs. Resolve one or activate Pro.`;
    navigateTo('data');
    return;
  }
  draftAudio = {};
  draftFields = undefined;
  removedAudio = new Set();
  state.editingId = undefined;
  state.dialogOpen = true;
  render();
}

function openEditDialog(id: string): void {
  draftAudio = {};
  draftFields = undefined;
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
  draftFields = undefined;
  removedAudio = new Set();
  render();
  window.requestAnimationFrame(() => app.querySelector<HTMLElement>('[data-add]')?.focus());
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
    error.textContent = `That pair is already in your log as “${duplicate.wordA} / ${duplicate.wordB}”. Edit the existing pair instead.`;
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
    draftFields = undefined;
    removedAudio = new Set();
    state.notice = editing ? 'Pair updated on this device.' : 'Confusion logged. Its first practice is ready now.';
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
    if (status) status.textContent = 'Audio recording is not supported in this browser. You can still use text practice.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      captureDraftFields();
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
  captureDraftFields();
  delete draftAudio[side];
  removedAudio.add(side);
  render();
}

function captureDraftFields(): void {
  const form = app.querySelector<HTMLFormElement>('[data-pair-form]');
  if (!form) return;
  const data = new FormData(form);
  draftFields = {
    wordA: String(data.get('wordA') ?? ''),
    wordB: String(data.get('wordB') ?? ''),
    contrast: String(data.get('contrast') ?? ''),
    mnemonic: String(data.get('mnemonic') ?? ''),
    language: String(data.get('language') ?? '')
  };
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
  if (!duePairs().length) navigateTo('desk');
  else render();
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

function navigateTo(view: View, replace = false): void {
  state.view = view;
  state.practice = undefined;
  const url = viewUrl(view);
  if (replace) history.replaceState({ view }, '', url);
  else history.pushState({ view }, '', url);
  render();
  window.requestAnimationFrame(focusRouteHeading);
}

function focusRouteHeading(): void {
  const heading = document.querySelector<HTMLElement>('#main-content h1');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
}

async function sampleData(): Promise<{ pairs: WordPair[]; attempts: Attempt[] }> {
  const now = Date.now();
  const [audioA, audioB] = await Promise.all([
    fetch('/assets/sample-affect.wav').then((response) => response.ok ? response.blob() : undefined).catch(() => undefined),
    fetch('/assets/sample-effect.wav').then((response) => response.ok ? response.blob() : undefined).catch(() => undefined)
  ]);
  const pairs: WordPair[] = [
    {
      id: 'demo-affect-effect', wordA: 'affect', wordB: 'effect', language: 'English',
      contrast: 'Affect is usually an action; effect is usually a result.', mnemonic: 'A for action.',
      createdAt: now - 2 * DAY, updatedAt: now - DAY, dueAt: now - 60_000, cleanStreak: 0,
      lastMode: 'text-audio', ...(audioA ? { audioA } : {}), ...(audioB ? { audioB } : {})
    },
    {
      id: 'demo-desert-dessert', wordA: 'desert', wordB: 'dessert', language: 'English',
      contrast: 'A desert is dry land; dessert is the sweet course after a meal.', mnemonic: 'Dessert has two s letters because I want seconds.',
      createdAt: now - 6 * DAY, updatedAt: now - DAY, dueAt: now + DAY, cleanStreak: 1, lastMode: 'text-audio'
    },
    {
      id: 'demo-embarazada-embarrassed', wordA: 'embarazada', wordB: 'embarrassed', language: 'Spanish and English',
      contrast: 'Embarazada means pregnant in Spanish; embarrassed means ashamed in English.', mnemonic: 'The similar spelling hides a different meaning.',
      createdAt: now - 16 * DAY, updatedAt: now - 2 * DAY, dueAt: now - 2 * DAY, cleanStreak: 3,
      resolvedAt: now - 2 * DAY, lastMode: 'text-audio'
    }
  ];
  const attempts: Attempt[] = [
    { id: 'demo-attempt-1', pairId: 'demo-desert-dessert', mode: 'text-audio', target: 'b', correct: true, createdAt: now - DAY, scheduledDueAt: now - DAY },
    { id: 'demo-attempt-2', pairId: 'demo-embarazada-embarrassed', mode: 'text-audio', target: 'b', correct: true, createdAt: now - 8 * DAY, scheduledDueAt: now - 8 * DAY },
    { id: 'demo-attempt-3', pairId: 'demo-embarazada-embarrassed', mode: 'text-audio', target: 'a', correct: true, createdAt: now - 5 * DAY, scheduledDueAt: now - 5 * DAY },
    { id: 'demo-attempt-4', pairId: 'demo-embarazada-embarrassed', mode: 'text-audio', target: 'b', correct: true, createdAt: now - 2 * DAY, scheduledDueAt: now - 2 * DAY }
  ];
  return { pairs, attempts };
}

async function seedDemo(force = false): Promise<void> {
  if (!isDemo || (!force && localStorage.getItem(demoSeedKey) === '1')) return;
  const sample = await sampleData();
  await replaceAllData(sample.pairs, sample.attempts);
  localStorage.setItem(demoSeedKey, '1');
}

async function resetDemo(): Promise<void> {
  await seedDemo(true);
  state.practice = undefined;
  state.notice = 'Sample data reset.';
  await loadData(false);
}

async function leaveDemo(destination: string): Promise<void> {
  if (isDemo) {
    await replaceAllData([], []);
    localStorage.removeItem(demoSeedKey);
    localStorage.removeItem('demo:sb_license:vocab-confusion-log');
    localStorage.removeItem('demo:sb_license:vocab-confusion-log:verdict');
  }
  window.location.assign(destination);
}

async function loadData(showLoading = true): Promise<void> {
  if (showLoading) {
    state.loading = true;
    state.error = undefined;
    render();
  }
  try {
    await seedDemo();
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
  updateRequested = true;
  serviceWorkerRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
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
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateRequested) window.location.reload(); });
}

window.addEventListener('popstate', () => {
  state.view = viewFromPath();
  state.practice = undefined;
  render();
  window.requestAnimationFrame(focusRouteHeading);
});
window.addEventListener('online', () => { state.online = true; render(); void initializeLicense(); });
window.addEventListener('offline', () => { state.online = false; render(); });

void loadData().then(() => void initializeLicense());
void registerServiceWorker();
