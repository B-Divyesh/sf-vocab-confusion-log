import './style.css';
import { activateSkipLink } from './skip-link';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('The page could not open. Reload and try again.');

app.innerHTML = `
  <header class="site-header landing-header">
    <a class="brand" href="/" aria-label="Vocab Confusion Log home" aria-current="page">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
      <span>Vocab Confusion Log</span>
    </a>
    <nav aria-label="Main navigation">
      <a class="nav-link" href="/demo/">Demo</a>
      <a class="nav-link" href="/log/">My log</a>
      <a class="nav-link" href="/privacy/">Privacy</a>
    </nav>
  </header>
  <main id="main-content" tabindex="-1">
    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero-copy">
        <p class="eyebrow">For repeated vocabulary mix-ups</p>
        <h1 id="landing-title">Practise the words you mix up</h1>
        <p class="lede">For language learners who need focused text and audio practice for repeated mix-ups.</p>
        <div class="hero-actions landing-actions">
          <a class="button primary" href="/demo/">Try it with sample data</a>
          <a class="button secondary" href="/log/">Open my log</a>
        </div>
        <p class="action-note">Three sample pairs open right away.</p>
        <ul class="plain-facts" aria-label="Product facts">
          <li>Your words and recordings stay in this browser.</li>
          <li>It works offline after your first visit.</li>
          <li>Free for eight active pairs. Pro is US$9 once.</li>
        </ul>
      </div>
      <figure class="hero-art landing-art">
        <img src="/assets/repair-collage.webp" alt="Two paper cards connect listening and speaking practice" width="1200" height="800" decoding="async" fetchpriority="high" />
        <figcaption>Compare one pair at a time.</figcaption>
      </figure>
    </section>

    <section class="landing-preview" aria-labelledby="preview-title">
      <div class="preview-intro">
        <p class="eyebrow">Sample log</p>
        <h2 id="preview-title">See the exact words that need practice</h2>
        <p>Each pair keeps a contrast cue, its next practice time, and its correct-attempt count.</p>
      </div>
      <div class="preview-sheet" aria-label="Sample confusion pair">
        <div class="pair-words"><span>affect</span><i aria-hidden="true">≠</i><span>effect</span></div>
        <p>Affect is usually an action; effect is usually a result.</p>
        <div class="pair-meta"><span>Due now</span><span>0 of 3 correct attempts</span><span class="audio-tag">● Audio ready</span></div>
      </div>
    </section>

    <section class="landing-method" aria-labelledby="how-title">
      <p class="eyebrow">How it works</p>
      <h2 id="how-title">Resolve one confusing pair in three steps</h2>
      <ol>
        <li><span>01</span><div><h3>Log the two words</h3><p>Add the exact mix-up and one short contrast cue.</p></div></li>
        <li><span>02</span><div><h3>Practise both ways</h3><p>Say a written word. With recordings, listen and type it too.</p></div></li>
        <li><span>03</span><div><h3>Complete three attempts</h3><p>Correct attempts return after one day and then three days.</p></div></li>
      </ol>
    </section>

    <section class="limits-section" aria-labelledby="limits-title">
      <div>
        <p class="eyebrow">Scope and privacy</p>
        <h2 id="limits-title">Focused practice, not a full course</h2>
      </div>
      <div>
        <p>The app does not score speech, measure proficiency, or schedule a full vocabulary deck.</p>
        <p>Ordinary logging and practice send no personal data. Your browser stores the log and recordings.</p>
        <p><a href="/privacy/">Read the privacy policy</a></p>
      </div>
    </section>

    <section class="price-section" aria-labelledby="price-title">
      <div class="price-stamp" aria-label="US$9 one-time price"><span>US$9</span><small>one time</small></div>
      <div>
        <p class="eyebrow">Free and Pro</p>
        <h2 id="price-title">Use eight active pairs for free</h2>
        <p>Pro removes the active-pair limit. Practice, recordings, offline use, accessibility, and every export remain free.</p>
        <p class="billing-status"><strong>New checkout is pending billing registration.</strong> You can use the free app now or restore an existing license.</p>
        <a class="button secondary" href="/log/data/">View data and license options</a>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <p>Practise the word pairs you repeatedly confuse.</p>
    <p><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><span>Built by Param Factory</span><span>Version 1.1.0 · original AI-assisted collage</span></p>
  </footer>
`;

activateSkipLink();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register('/sw.js');
}
