import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, firebaseConfig, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");

const state = {
  authReady: false,
  user: null,
  profile: null,
  profileError: null,
  currentRoute: "/",
  mobileNavOpen: false,
  directory: {
    records: [],
    cursor: null,
    hasMore: false,
    loading: false,
    loaded: false,
    error: null
  }
};

const ROLE_LABELS = Object.freeze({
  owner: "Owner",
  chapterAdmin: "Chapter Administrator",
  complianceAdmin: "Compliance Administrator",
  supportAgent: "Support Agent",
  director: "Chapter Director",
  adviser: "Chapter Adviser"
});

const AUTHORIZATION_LABELS = Object.freeze({
  active: "Active — Officially Approved",
  conditional: "Conditionally Approved",
  inactive: "Temporarily Inactive",
  suspended: "Suspended",
  expired: "Expired",
  closed: "Closed",
  revoked: "Authorization Revoked"
});

const STANDING_LABELS = Object.freeze({
  good_standing: "Good Standing",
  action_required: "Action Required",
  under_review: "Under Review",
  probationary: "Probationary Standing",
  not_in_good_standing: "Not in Good Standing"
});

const ACTIVE_ACCOUNT_STATUSES = new Set(["active"]);
const ADMIN_PORTAL_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin", "supportAgent"]);
const CHAPTER_PORTAL_ROLES = new Set(["director", "adviser", "chapterUser"]);
const DIRECT_ID_PATTERN = /^TPP-CH-[A-Z0-9]{1,32}$/;

const icons = {
  home: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>`,
  user: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  status: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 18V9m5 9V5m6 13v-7m5 7V3"/></svg>`,
  logout: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>`,
  menu: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  arrow: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
  eye: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  info: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>`,
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 2 21h20z"/><path d="M12 9v5m0 3h.01"/></svg>`,
  search: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
  building: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01"/></svg>`,
  map: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  calendar: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`,
  copy: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
  print: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>`,
  flag: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>`
};

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value = "") {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name = "User") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "TP").toUpperCase();
}

function currentTheme() {
  return document.documentElement.dataset.theme || "light";
}

function applyTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = safeTheme;
  localStorage.setItem("tpp-theme", safeTheme);
}

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  const route = path.startsWith("/") ? path : `/${path}`;
  return route.replace(/\/+$/, "") || "/";
}

function hashParams() {
  const raw = location.hash.replace(/^#/, "");
  const queryString = raw.includes("?") ? raw.split("?").slice(1).join("?") : "";
  return new URLSearchParams(queryString);
}

function navigate(route) {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  if (location.hash === `#${normalized}`) render();
  else location.hash = normalized;
}

function normalizeChapterId(value = "") {
  return String(value).trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeSearchToken(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)[0] || "";
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, fallback = "Not listed") {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date)
    : fallback;
}

function verificationUrl(chapterId) {
  return `${location.origin}/verify/${encodeURIComponent(chapterId)}`;
}

function authorizationLabel(value) {
  return AUTHORIZATION_LABELS[value] || titleCase(value || "Unknown");
}

function standingLabel(value) {
  return STANDING_LABELS[value] || titleCase(value || "Not Published");
}

function statusTone(status) {
  if (status === "active") return "success";
  if (["conditional", "inactive", "expired"].includes(status)) return "warning";
  if (["suspended", "closed", "revoked"].includes(status)) return "danger";
  return "info";
}

function standingTone(standing) {
  if (standing === "good_standing") return "success";
  if (["action_required", "under_review", "probationary"].includes(standing)) return "warning";
  if (standing === "not_in_good_standing") return "danger";
  return "info";
}

function verificationStatement(record) {
  const messages = {
    active: "This chapter is currently recognized and authorized to operate as an official chapter of The Prayer Project.",
    conditional: "This chapter has conditional authorization. Its permission to operate remains subject to the requirements shown in the official chapter record.",
    inactive: "This chapter remains on file but is not currently operating as an active Prayer Project chapter.",
    suspended: "This chapter's authorization is suspended. It may not represent itself as an active Prayer Project chapter while suspension remains in effect.",
    expired: "This chapter's prior authorization has expired and has not yet been renewed.",
    closed: "This chapter has closed and is no longer authorized to operate under The Prayer Project name.",
    revoked: "The Prayer Project has revoked this chapter's authorization. It may not represent itself as an official chapter."
  };
  return record.publicMessage || messages[record.authorizationStatus] || "The current authorization status is shown above.";
}

function brand({ light = false } = {}) {
  return `
    <a class="brand" href="#/" aria-label="The Prayer Project Chapter Portal home">
      <img class="brand-mark" src="assets/brand-mark.svg" alt="">
      <span class="brand-copy">
        <span class="brand-name" ${light ? 'style="color:#f7f2e7"' : ""}>The Prayer Project</span>
        <span class="brand-subtitle">Chapter Portal</span>
      </span>
    </a>`;
}

function themeButton() {
  const dark = currentTheme() === "dark";
  return `<button class="icon-btn" type="button" data-action="toggle-theme" aria-label="Use ${dark ? "light" : "dark"} theme" title="Use ${dark ? "light" : "dark"} theme">${dark ? icons.sun : icons.moon}</button>`;
}

function loadingScreen(message = "Preparing the Chapter Portal…") {
  return `
    <main class="loading-screen" id="main-content">
      <div class="loading-card">
        <img class="brand-mark" src="assets/brand-mark.svg" alt="" width="62" height="62">
        <div class="spinner" aria-hidden="true"></div>
        <strong>${escapeHTML(message)}</strong>
      </div>
    </main>`;
}

function publicNavigation() {
  return `
    <nav class="public-nav" aria-label="Public navigation">
      <a href="#/verify">Verify a chapter</a>
      <a href="#/chapters">Chapter directory</a>
      <a href="#/about-verification">About verification</a>
    </nav>`;
}

function publicLayout(content) {
  return `
    <header class="public-header">
      <div class="header-inner public-header-grid">
        ${brand()}
        ${publicNavigation()}
        <div class="header-actions">
          ${themeButton()}
          <a class="btn btn-primary" href="#/portal">${state.user ? portalButtonLabel() : "Portal access"}</a>
        </div>
      </div>
    </header>
    <main class="public-main" id="main-content">${content}</main>
    <footer class="public-footer">
      <div class="footer-inner footer-grid">
        <div><strong>The Prayer Project</strong><span>Faith • Hope • Community</span></div>
        <div class="footer-links"><a href="#/verify">Verify</a><a href="#/chapters">Directory</a><a href="#/report-chapter">Report misuse</a></div>
        <span>© ${new Date().getFullYear()} The Prayer Project</span>
      </div>
    </footer>
    <div class="toast-region" id="toast-region" aria-live="assertive"></div>`;
}

function registrySearchForm({ value = "", compact = false } = {}) {
  return `
    <form class="registry-search ${compact ? "registry-search-compact" : ""}" data-registry-search novalidate>
      <label class="sr-only" for="registry-query-${compact ? "compact" : "full"}">Chapter ID, chapter name, school, church, city, or state</label>
      <div class="registry-search-field">
        ${icons.search}
        <input id="registry-query-${compact ? "compact" : "full"}" name="query" type="search" value="${escapeHTML(value)}" placeholder="Enter Chapter ID, name, school, church, or location" autocomplete="off" required>
      </div>
      <button class="btn btn-primary" type="submit">Verify chapter</button>
    </form>`;
}

function publicHome() {
  return publicLayout(`
    <section class="registry-hero">
      <div class="registry-hero-inner">
        <p class="eyebrow">Official Chapter Registry</p>
        <h1>Verify a Prayer Project chapter.</h1>
        <p class="hero-copy">Confirm a chapter's official identity, authorization status, standing, host institution, and renewal information through the ministry's public source of truth.</p>
        ${registrySearchForm()}
        <p class="registry-search-note">Official Chapter IDs follow the format <strong>TPP-CH-A1B2C3</strong>.</p>
      </div>
    </section>

    <section class="section registry-trust-section">
      <div class="section-inner">
        <div class="trust-strip">
          <div>${icons.shield}<span><strong>Official records</strong>Published directly by The Prayer Project</span></div>
          <div>${icons.calendar}<span><strong>Current status</strong>Printed letters may become outdated</span></div>
          <div>${icons.flag}<span><strong>Misuse reporting</strong>Report unauthorized chapter claims</span></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-inner">
        <div class="section-heading">
          <p class="eyebrow">Clear public verification</p>
          <h2>Know what an approval document means today.</h2>
          <p>The registry preserves current and former chapter records so a school, church, parent, volunteer, or community member can determine whether a chapter is still authorized.</p>
        </div>
        <div class="feature-grid">
          <article class="feature-card"><div class="feature-number">01</div><h3>Search</h3><p>Look up a chapter by permanent ID, official name, host institution, or location.</p></article>
          <article class="feature-card"><div class="feature-number">02</div><h3>Confirm</h3><p>Review authorization, standing, approval dates, renewal dates, and public notices.</p></article>
          <article class="feature-card"><div class="feature-number">03</div><h3>Respond</h3><p>Report an organization using The Prayer Project name without current authorization.</p></article>
        </div>
      </div>
    </section>

    <section class="section registry-callout-section">
      <div class="section-inner">
        <div class="registry-callout">
          <div><p class="eyebrow">Browse all published records</p><h2>Looking for chapters in a community?</h2><p>Open the public directory to view active, inactive, expired, closed, and revoked records that remain published for verification.</p></div>
          <a class="btn btn-primary" href="#/chapters">Open chapter directory ${icons.arrow}</a>
        </div>
      </div>
    </section>`);
}

function verifySearchPage() {
  const searchValue = hashParams().get("q") || "";
  return publicLayout(`
    <section class="public-page-hero">
      <div class="section-inner narrow-wide">
        <p class="eyebrow">Official Registry Search</p>
        <h1>Verify a chapter</h1>
        <p>Search published chapter records. A direct Chapter ID provides the most precise result.</p>
        ${registrySearchForm({ value: searchValue })}
      </div>
    </section>
    <section class="section section-tight">
      <div class="section-inner narrow-wide">
        <div id="registry-search-results" aria-live="polite">
          ${searchValue ? registryLoading("Searching official chapter records…") : registrySearchHelp()}
        </div>
      </div>
    </section>`);
}

function registrySearchHelp() {
  return `
    <div class="registry-help-grid">
      <article class="card"><div class="card-body"><div class="registry-help-icon">${icons.shield}</div><h2 class="card-title">Best method</h2><p>Enter the permanent Chapter ID printed on the chapter's approval letter or certificate.</p></div></article>
      <article class="card"><div class="card-body"><div class="registry-help-icon">${icons.building}</div><h2 class="card-title">Other searches</h2><p>Search by a chapter name, school, church, organization, city, or state. Results use approved public search terms.</p></div></article>
    </div>`;
}

function registryLoading(message) {
  return `<div class="registry-inline-loading"><div class="spinner" aria-hidden="true"></div><strong>${escapeHTML(message)}</strong></div>`;
}

function verificationPage(chapterId) {
  return publicLayout(`
    <section class="public-page-hero public-page-hero-compact">
      <div class="section-inner narrow-wide">
        <a class="back-link" href="#/verify">← Return to registry search</a>
        <p class="eyebrow">Chapter Verification Record</p>
        <h1>Official verification</h1>
      </div>
    </section>
    <section class="section section-tight verification-section">
      <div class="section-inner narrow-wide" id="verification-root" aria-live="polite" data-chapter-id="${escapeHTML(chapterId)}">
        ${registryLoading("Checking the official registry…")}
      </div>
    </section>`);
}

function chapterDirectoryPage() {
  return publicLayout(`
    <section class="public-page-hero">
      <div class="section-inner">
        <p class="eyebrow">Published Chapter Records</p>
        <h1>Chapter directory</h1>
        <p>Browse official public records. Records may remain visible after inactivity, expiration, closure, or revocation so older documents can still be checked.</p>
        ${registrySearchForm({ compact: true })}
      </div>
    </section>
    <section class="section section-tight">
      <div class="section-inner">
        <div id="directory-results" aria-live="polite">${registryLoading("Loading published chapters…")}</div>
      </div>
    </section>`);
}

function aboutVerificationPage() {
  return publicLayout(`
    <section class="public-page-hero">
      <div class="section-inner narrow-wide">
        <p class="eyebrow">About the Registry</p>
        <h1>How chapter verification works</h1>
        <p>The online registry is The Prayer Project's current public record of chapter authorization.</p>
      </div>
    </section>
    <section class="section section-tight">
      <div class="section-inner narrow-wide content-stack">
        <article class="content-card">
          <h2>What a verified result confirms</h2>
          <p>A published record confirms that the chapter ID belongs to a chapter known to The Prayer Project. The authorization and standing fields explain whether the chapter may currently operate under the ministry's name.</p>
        </article>
        <article class="content-card">
          <h2>Why older records remain searchable</h2>
          <p>Approval letters, certificates, flyers, and screenshots can remain in circulation after a chapter changes status. Keeping closed, expired, suspended, or revoked records visible prevents an outdated document from being mistaken for current permission.</p>
        </article>
        <article class="content-card">
          <h2>What is intentionally private</h2>
          <p>The public registry does not disclose personal phone numbers, private email addresses, dates of birth, minor leaders' personal information, prayer requests, applications, internal reviews, disciplinary notes, or confidential institutional contacts.</p>
        </article>
        <article class="content-card">
          <h2>Printed approval documents</h2>
          <p>The current online record supersedes an outdated printed copy. A printed letter proves that approval existed when it was issued; the registry shows whether that approval remains current.</p>
        </article>
        <div class="content-actions"><a class="btn btn-primary" href="#/verify">Verify a chapter</a><a class="btn btn-secondary" href="#/report-chapter">Report unauthorized use</a></div>
      </div>
    </section>`);
}

function reportChapterPage() {
  const params = hashParams();
  const chapterId = params.get("chapterId") || "";
  const chapterName = params.get("chapterName") || "";
  return publicLayout(`
    <section class="public-page-hero">
      <div class="section-inner narrow-wide">
        <p class="eyebrow">Protect the Ministry Name</p>
        <h1>Report a chapter concern</h1>
        <p>Use this form when a group may be claiming to be an official Prayer Project chapter without current authorization or when its public claim conflicts with the registry.</p>
      </div>
    </section>
    <section class="section section-tight">
      <div class="section-inner narrow-form">
        <div class="alert alert-info">${icons.info}<div><strong>Do not use this form for emergencies.</strong> Contact local emergency services or an appropriate responsible adult when immediate safety is involved.</div></div>
        <article class="card report-card">
          <div class="card-header"><div><h2 class="card-title">Public registry report</h2><p class="card-subtitle">Provide enough detail for Prayer Project staff to review the claim.</p></div></div>
          <div class="card-body">
            <div id="report-alert"></div>
            <form class="form" id="unauthorized-report-form" novalidate>
              <div class="form-row">
                <div class="field"><label for="reporter-name">Your name</label><input class="input" id="reporter-name" name="reporterName" type="text" maxlength="100" autocomplete="name" required></div>
                <div class="field"><label for="reporter-email">Email address</label><input class="input" id="reporter-email" name="reporterEmail" type="email" maxlength="160" autocomplete="email" required></div>
              </div>
              <div class="field"><label for="relationship">Your relationship to the concern</label><select class="input" id="relationship" name="relationship" required><option value="">Select one</option><option>School or church leader</option><option>Parent or guardian</option><option>Volunteer or participant</option><option>Community member</option><option>Prayer Project chapter leader</option><option>Other</option></select></div>
              <div class="form-row">
                <div class="field"><label for="reported-chapter-name">Chapter or group name</label><input class="input" id="reported-chapter-name" name="chapterName" type="text" maxlength="160" value="${escapeHTML(chapterName)}" required></div>
                <div class="field"><label for="reported-chapter-id">Claimed Chapter ID <span class="optional">optional</span></label><input class="input" id="reported-chapter-id" name="chapterId" type="text" maxlength="39" value="${escapeHTML(chapterId)}" placeholder="TPP-CH-A1B2C3"></div>
              </div>
              <div class="form-row">
                <div class="field"><label for="reported-institution">School, church, or organization</label><input class="input" id="reported-institution" name="institution" type="text" maxlength="180" required></div>
                <div class="field"><label for="reported-location">City and state</label><input class="input" id="reported-location" name="location" type="text" maxlength="120" required></div>
              </div>
              <div class="field"><label for="report-details">What did you observe?</label><textarea class="input textarea" id="report-details" name="details" minlength="20" maxlength="2000" rows="7" placeholder="Explain where the claim appeared, when you saw it, and why it may conflict with the registry." required></textarea><span class="field-hint">Do not include prayer requests, medical information, or other unnecessary private details.</span></div>
              <div class="honeypot" aria-hidden="true"><label for="company-website">Company website</label><input id="company-website" name="companyWebsite" type="text" tabindex="-1" autocomplete="off"></div>
              <label class="check-control"><input name="consent" type="checkbox" required><span>I confirm that this report is truthful to the best of my knowledge and may be reviewed by authorized Prayer Project staff.</span></label>
              <button class="btn btn-primary" id="report-submit" type="submit">Submit report</button>
            </form>
          </div>
        </article>
      </div>
    </section>`);
}

function authLayout(content) {
  return `
    <main class="auth-page" id="main-content">
      <section class="auth-brand-panel">
        ${brand({ light: true })}
        <div class="auth-message"><p class="eyebrow">Official Chapter Access</p><h2>A trusted place for every chapter.</h2><p>Secure access for Prayer Project administrators, Chapter Directors, and Chapter Advisers.</p></div>
        <p class="auth-quote">“Devote yourselves to prayer, being watchful and thankful.” — Colossians 4:2</p>
      </section>
      <section class="auth-form-panel"><div class="auth-card"><div class="auth-topline">${themeButton()}</div>${content}</div></section>
    </main>
    <div class="toast-region" id="toast-region" aria-live="assertive"></div>`;
}

function portalAccessPage() {
  if (state.user && state.profile && ACTIVE_ACCOUNT_STATUSES.has(state.profile.accountStatus)) {
    const destination = portalHomeForRole();
    queueMicrotask(() => navigate(destination));
    return loadingScreen(destination.startsWith("/admin/") ? "Opening the administration console…" : "Opening your chapter workspace…");
  }
  return publicLayout(`
    <section class="portal-access-shell">
      <article class="portal-access-card">
        <p class="eyebrow">Chapter Registry & Operations Portal</p>
        <h1>One portal for every approved chapter.</h1>
        <p>The public registry is only the verification side of the system. Authorized accounts open the complete administration, Director, or Adviser workspace after sign-in.</p>
        <div class="portal-access-grid">
          <div class="portal-access-option"><strong>Administration</strong><span>Manage chapters, users, invitations, compliance, submissions, support, notices, registry records, settings, and audit history.</span></div>
          <div class="portal-access-option"><strong>Chapter leadership</strong><span>Review standing, requirements, leadership, documents, notices, reports, renewals, events, and support conversations.</span></div>
        </div>
        <div class="portal-access-actions"><a class="btn btn-primary" href="#/login">Sign in to the portal</a><a class="btn btn-secondary" href="#/activate">Activate an approved account</a><a class="btn btn-secondary" href="#/verify">Return to verification</a></div>
      </article>
    </section>`);
}

function loginPage() {
  if (state.user && state.profile && ACTIVE_ACCOUNT_STATUSES.has(state.profile.accountStatus)) {
    queueMicrotask(() => navigate("/portal"));
    return loadingScreen("Opening your dashboard…");
  }
  return authLayout(`
    <div class="auth-heading"><p class="page-kicker">Welcome back</p><h1>Sign in</h1><p>Use the account assigned to your Prayer Project role.</p></div>
    <div id="auth-alert"></div>
    <form class="form" id="login-form" novalidate>
      <div class="field"><label for="email">Email address</label><input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></div>
      <div class="field"><label for="password">Password</label><div class="input-wrap"><input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" minlength="6" required><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password">${icons.eye}</button></div></div>
      <div class="form-meta"><a class="text-link" href="#/forgot-password">Forgot password?</a></div>
      <button class="btn btn-primary btn-block" id="login-submit" type="submit">Sign in securely</button>
    </form>
    <p class="auth-footer">Access is limited to approved Prayer Project accounts.</p>`);
}

function forgotPasswordPage() {
  return authLayout(`
    <div class="auth-heading"><p class="page-kicker">Account recovery</p><h1>Reset password</h1><p>Enter your account email and Firebase will send password-reset instructions.</p></div>
    <div id="auth-alert"></div>
    <form class="form" id="reset-form" novalidate>
      <div class="field"><label for="reset-email">Email address</label><input class="input" id="reset-email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></div>
      <button class="btn btn-primary btn-block" id="reset-submit" type="submit">Send reset email</button>
      <a class="btn btn-secondary btn-block" href="#/login">Return to sign in</a>
    </form>`);
}

function roleLabel(role) {
  return ROLE_LABELS[role] || titleCase(role || "Unassigned");
}

function profileStatusBadge(profile) {
  const status = profile?.accountStatus || "pending";
  const className = status === "active" ? "badge-success" : status === "disabled" ? "badge-danger" : "badge-warning";
  return `<span class="badge ${className}">${escapeHTML(titleCase(status))}</span>`;
}

function portalHomeForRole(role = state.profile?.systemRole) {
  if (ADMIN_PORTAL_ROLES.has(role)) return "/admin/dashboard";
  if (CHAPTER_PORTAL_ROLES.has(role)) return "/chapter/overview";
  return "/dashboard";
}

function portalButtonLabel() {
  if (ADMIN_PORTAL_ROLES.has(state.profile?.systemRole)) return "Administration console";
  if (CHAPTER_PORTAL_ROLES.has(state.profile?.systemRole)) return "My chapter";
  return "Open portal";
}

function appLayout(content, activeRoute = "/dashboard", title = "Chapter Portal") {
  const profile = state.profile || {};
  const displayName = profile.displayName || state.user?.displayName || state.user?.email?.split("@")[0] || "Portal User";
  const role = roleLabel(profile.systemRole);
  return `
    <div class="app-shell">
      <aside class="sidebar ${state.mobileNavOpen ? "open" : ""}" id="sidebar">
        <div class="sidebar-brand">${brand()}</div>
        <nav class="sidebar-nav" aria-label="Portal navigation">
          <p class="nav-label">Workspace</p>
          <a class="nav-link ${activeRoute === "/dashboard" ? "active" : ""}" href="#${portalHomeForRole()}">${icons.home}<span>Overview</span></a>
          <a class="nav-link" href="#/verify">${icons.shield}<span>Public registry</span></a>
          <a class="nav-link ${activeRoute === "/profile" ? "active" : ""}" href="#/profile">${icons.user}<span>My profile</span></a>
          <a class="nav-link ${activeRoute === "/system-status" ? "active" : ""}" href="#/system-status">${icons.status}<span>System status</span></a>
          <p class="nav-label">Account</p>
          <button class="nav-link" type="button" data-action="sign-out">${icons.logout}<span>Sign out</span></button>
        </nav>
        <div class="sidebar-footer"><div class="user-mini"><div class="avatar">${escapeHTML(initials(displayName))}</div><div class="user-mini-copy"><div class="user-mini-name">${escapeHTML(displayName)}</div><div class="user-mini-role">${escapeHTML(role)}</div></div></div></div>
      </aside>
      <div class="app-main">
        <header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="icon-btn mobile-menu" type="button" data-action="toggle-mobile-nav" aria-label="Open navigation">${icons.menu}</button><div class="topbar-title">${escapeHTML(title)}</div></div><div class="topbar-actions">${profileStatusBadge(profile)}${themeButton()}</div></header>
        <main class="page-content" id="main-content">${content}</main>
      </div>
    </div>
    <div class="toast-region" id="toast-region" aria-live="assertive"></div>`;
}

function ownerDashboard() {
  const profile = state.profile;
  const displayName = profile.displayName || state.user.email.split("@")[0];
  return appLayout(`
    <header class="page-heading"><div><p class="page-kicker">Owner workspace</p><h1>Welcome, ${escapeHTML(displayName)}.</h1><p>The complete Chapter Registry & Operations Portal is available for public verification, chapter leadership, support, and administration.</p></div><span class="badge badge-success">Registry operational</span></header>
    <section class="grid grid-4" aria-label="Platform metrics">
      <article class="card metric-card"><div class="metric-label">Account role</div><div class="metric-value">${escapeHTML(roleLabel(profile.systemRole))}</div><div class="metric-note">Loaded from Firestore</div></article>
      <article class="card metric-card"><div class="metric-label">Public registry</div><div class="metric-value">Online</div><div class="metric-note">Published records are searchable</div></article>
      <article class="card metric-card"><div class="metric-label">Firebase project</div><div class="metric-value">${escapeHTML(firebaseConfig.projectId)}</div><div class="metric-note">Production configuration connected</div></article>
      <article class="card metric-card"><div class="metric-label">Platform</div><div class="metric-value">Complete</div><div class="metric-note">Phases 1–8 are available</div></article>
    </section>
    <section class="grid grid-2" style="margin-top:18px">
      <article class="card"><div class="card-header"><div><h2 class="card-title">Registry tools</h2><p class="card-subtitle">Public-facing features now available.</p></div>${icons.shield}</div><div class="card-body"><div class="action-list"><a class="action-link" href="#/verify"><div><strong>Verify a chapter</strong><span>Test direct-ID and general registry search.</span></div>${icons.arrow}</a><a class="action-link" href="#/chapters"><div><strong>Open the directory</strong><span>Review all currently published chapter records.</span></div>${icons.arrow}</a><a class="action-link" href="#/report-chapter"><div><strong>Test public reporting</strong><span>Review the unauthorized chapter reporting workflow.</span></div>${icons.arrow}</a></div></div></article>
      <article class="card"><div class="card-header"><div><h2 class="card-title">Phase 2 checklist</h2><p class="card-subtitle">The registry is complete when production rules and indexes are deployed.</p></div></div><div class="card-body"><ul class="check-list"><li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Public chapter records</strong><span>Published records are readable without authentication.</span></div></li><li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Direct verification</strong><span>Stable chapter links display status, standing, dates, and QR codes.</span></div></li><li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Directory and search</strong><span>Search tokens and ordered directory queries support public discovery.</span></div></li><li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Concern reports</strong><span>Structured public reports enter a protected administrative queue.</span></div></li></ul></div></article>
    </section>`, "/dashboard", "Owner Dashboard");
}

function roleDashboard() {
  const profile = state.profile;
  const displayName = profile.displayName || state.user.email.split("@")[0];
  const role = roleLabel(profile.systemRole);
  const isChapterRole = ["director", "adviser"].includes(profile.systemRole);
  return appLayout(`
    <header class="page-heading"><div><p class="page-kicker">Secure workspace</p><h1>Welcome, ${escapeHTML(displayName)}.</h1><p>Your ${escapeHTML(role)} account is active. Public chapter verification is now operational; chapter-specific records will connect to this workspace in Phase 4.</p></div><span class="badge badge-success">Access confirmed</span></header>
    <section class="grid grid-3"><article class="card metric-card"><div class="metric-label">Assigned role</div><div class="metric-value">${escapeHTML(role)}</div><div class="metric-note">Protected by Firestore</div></article><article class="card metric-card"><div class="metric-label">Account status</div><div class="metric-value">${escapeHTML(titleCase(profile.accountStatus))}</div><div class="metric-note">Portal access authorized</div></article><article class="card metric-card"><div class="metric-label">Workspace</div><div class="metric-value">${isChapterRole ? "Chapter" : "Administration"}</div><div class="metric-note">Role-specific routing active</div></article></section>
    <section class="card" style="margin-top:18px"><div class="empty-state"><div class="empty-icon">${icons.shield}</div><h2>Public verification is now available</h2><p>Use the official registry to review public chapter records. Your chapter standing, compliance, leadership, documents, workflows, notices, and support tools are available in your chapter workspace.</p><a class="btn btn-primary" href="#/chapter/overview">Open chapter workspace</a></div></section>`, "/dashboard", `${role} Dashboard`);
}

function dashboardPage() {
  const destination = portalHomeForRole();
  if (destination !== "/dashboard") {
    queueMicrotask(() => navigate(destination));
    return loadingScreen(destination.startsWith("/admin/") ? "Opening the administration console…" : "Opening your chapter workspace…");
  }
  return roleDashboard();
}

function profilePage() {
  const profile = state.profile;
  return appLayout(`
    <header class="page-heading"><div><p class="page-kicker">Account settings</p><h1>My profile</h1><p>Review your official portal identity.</p></div>${profileStatusBadge(profile)}</header>
    <section class="grid grid-2">
      <article class="card"><div class="card-header"><div><h2 class="card-title">Profile details</h2><p class="card-subtitle">This name appears throughout the portal.</p></div></div><div class="card-body"><div id="profile-alert"></div><form class="form" id="profile-form" novalidate><div class="field"><label for="display-name">Display name</label><input class="input" id="display-name" name="displayName" type="text" autocomplete="name" maxlength="80" value="${escapeHTML(profile.displayName || "")}" required><span class="field-hint">Use the name Prayer Project administrators should recognize.</span></div><div class="field"><label for="profile-email">Email address</label><input class="input" id="profile-email" type="email" value="${escapeHTML(state.user.email || "")}" disabled></div><button class="btn btn-primary" id="profile-submit" type="submit">Save profile</button></form></div></article>
      <article class="card"><div class="card-header"><div><h2 class="card-title">Access record</h2><p class="card-subtitle">Protected identity information for this account.</p></div></div><div class="card-body"><dl class="detail-list"><div class="detail-row"><dt>Portal role</dt><dd>${escapeHTML(roleLabel(profile.systemRole))}</dd></div><div class="detail-row"><dt>Account status</dt><dd>${escapeHTML(titleCase(profile.accountStatus))}</dd></div><div class="detail-row"><dt>Firebase UID</dt><dd>${escapeHTML(state.user.uid)}</dd></div><div class="detail-row"><dt>Activation method</dt><dd>Single-use invitation code</dd></div><div class="detail-row"><dt>Authentication provider</dt><dd>Email and password</dd></div></dl></div></article>
    </section>`, "/profile", "My Profile");
}

function systemStatusContent() {
  const connected = Boolean(state.user && state.profile && !state.profileError);
  return `<header class="page-heading"><div><p class="page-kicker">Platform health</p><h1>System status</h1><p>Current connection details for the Chapter Registry and Operations Portal.</p></div><span class="badge ${connected ? "badge-success" : "badge-info"}">${connected ? "Authenticated connection" : "Public site online"}</span></header><section class="grid grid-3"><article class="card metric-card"><div class="metric-label">Website</div><div class="metric-value">Online</div><div class="metric-note">GitHub Pages application loaded</div></article><article class="card metric-card"><div class="metric-label">Platform</div><div class="metric-value">Online</div><div class="metric-note">Public and protected portals enabled</div></article><article class="card metric-card"><div class="metric-label">Authentication</div><div class="metric-value">${state.user ? "Signed in" : "Available"}</div><div class="metric-note">Firebase Email/Password</div></article></section><section class="card" style="margin-top:18px"><div class="card-body"><dl class="detail-list"><div class="detail-row"><dt>Project ID</dt><dd>${escapeHTML(firebaseConfig.projectId)}</dd></div><div class="detail-row"><dt>Public domain</dt><dd>chapter.ask4prayers.com</dd></div><div class="detail-row"><dt>Public registry collection</dt><dd>publicChapterRegistry</dd></div><div class="detail-row"><dt>Concern report collection</dt><dd>unauthorizedChapterReports</dd></div></dl></div></section>`;
}

function systemStatusPage() {
  if (state.user && state.profile && ACTIVE_ACCOUNT_STATUSES.has(state.profile.accountStatus)) return appLayout(systemStatusContent(), "/system-status", "System Status");
  return publicLayout(`<section class="section"><div class="section-inner narrow-wide">${systemStatusContent()}</div></section>`);
}

function pendingAccessPage() {
  const signedIn = Boolean(state.user);
  return authLayout(`<div class="auth-heading"><p class="page-kicker">Account access</p><h1>${state.profileError ? "Access check failed" : "Approval required"}</h1><p>${state.profileError ? "The portal could not read your Firestore access record." : "Your Firebase account is signed in, but no active portal profile is assigned."}</p></div><div class="alert alert-warning" style="margin-top:26px">${icons.alert}<div><strong>${state.profileError ? "Firestore could not be reached or denied the request." : "A matching systemUsers record is required."}</strong>${signedIn ? ` Signed in as ${escapeHTML(state.user.email || state.user.uid)}.` : ""}</div></div>${signedIn ? `<button class="btn btn-primary btn-block" style="margin-top:22px" type="button" data-action="retry-profile">Retry access check</button><button class="btn btn-secondary btn-block" type="button" data-action="sign-out">Sign out</button>` : `<a class="btn btn-primary btn-block" href="#/login">Return to sign in</a>`}`);
}

function disabledAccessPage() {
  return authLayout(`<div class="auth-heading"><p class="page-kicker">Access restricted</p><h1>Account unavailable</h1><p>This portal account is not currently active.</p></div><div class="alert alert-danger" style="margin-top:26px">${icons.alert}<div><strong>Sign-in succeeded, but portal access is disabled.</strong> Contact The Prayer Project for assistance.</div></div><button class="btn btn-secondary btn-block" style="margin-top:22px" type="button" data-action="sign-out">Sign out</button>`);
}

function notFoundPage() {
  const content = `<div class="empty-state"><div class="empty-icon">${icons.info}</div><h2>Page not found</h2><p>The address does not match a page in the Chapter Portal.</p><a class="btn btn-primary" href="${state.user ? `#${portalHomeForRole()}` : "#/"}">Return ${state.user ? "to dashboard" : "home"}</a></div>`;
  if (state.user && state.profile && ACTIVE_ACCOUNT_STATUSES.has(state.profile.accountStatus)) return appLayout(`<section class="card">${content}</section>`, "", "Page Not Found");
  return publicLayout(`<section class="section"><div class="section-inner"><div class="card">${content}</div></div></section>`);
}

function isProtectedRoute(route) {
  return ["/dashboard", "/profile"].includes(route);
}

function routePage(route) {
  if (route.startsWith("/verify/")) {
    const chapterId = decodeURIComponent(route.slice("/verify/".length));
    return () => verificationPage(chapterId);
  }
  const pages = {
    "/": publicHome,
    "/verify": verifySearchPage,
    "/chapters": chapterDirectoryPage,
    "/about-verification": aboutVerificationPage,
    "/report-chapter": reportChapterPage,
    "/portal": portalAccessPage,
    "/login": loginPage,
    "/forgot-password": forgotPasswordPage,
    "/dashboard": dashboardPage,
    "/profile": profilePage,
    "/system-status": systemStatusPage,
    "/access-pending": pendingAccessPage
  };
  return pages[route] || notFoundPage;
}

function pageTitle(route) {
  if (route.startsWith("/verify/")) return "Chapter Verification | The Prayer Project";
  const titles = {
    "/": "The Prayer Project | Official Chapter Registry",
    "/verify": "Verify a Chapter | The Prayer Project",
    "/chapters": "Chapter Directory | The Prayer Project",
    "/about-verification": "About Chapter Verification | The Prayer Project",
    "/report-chapter": "Report a Chapter Concern | The Prayer Project",
    "/portal": "Portal Access | The Prayer Project",
    "/login": "Sign In | The Prayer Project",
    "/forgot-password": "Reset Password | The Prayer Project",
    "/dashboard": "Dashboard | The Prayer Project",
    "/profile": "My Profile | The Prayer Project",
    "/system-status": "System Status | The Prayer Project",
    "/access-pending": "Account Pending | The Prayer Project"
  };
  return titles[route] || "Page Not Found | The Prayer Project";
}

function render() {
  const route = routeFromHash();
  state.currentRoute = route;
  state.mobileNavOpen = false;
  if (!state.authReady) {
    app.innerHTML = loadingScreen();
    return;
  }
  if (isProtectedRoute(route)) {
    if (!state.user) {
      navigate("/login");
      return;
    }
    if (!state.profile) {
      app.innerHTML = pendingAccessPage();
      bindEvents();
      return;
    }
    if (!ACTIVE_ACCOUNT_STATUSES.has(state.profile.accountStatus)) {
      app.innerHTML = disabledAccessPage();
      bindEvents();
      return;
    }
  }
  app.innerHTML = routePage(route)();
  bindEvents();
  document.title = pageTitle(route);
  window.scrollTo({ top: 0, behavior: "auto" });
  hydratePublicRoute(route);
}

async function hydratePublicRoute(route) {
  if (route.startsWith("/verify/")) {
    const chapterId = decodeURIComponent(route.slice("/verify/".length));
    await loadVerificationRecord(chapterId);
  } else if (route === "/verify" && hashParams().get("q")) {
    await runRegistrySearch(hashParams().get("q"));
  } else if (route === "/chapters") {
    await loadDirectory({ reset: true });
  }
}

function recordFromSnapshot(snapshot) {
  return { id: snapshot.id, ...snapshot.data(), chapterId: snapshot.data().chapterId || snapshot.id };
}

async function fetchChapterById(rawId) {
  const chapterId = normalizeChapterId(rawId);
  if (!chapterId) return null;
  const snapshot = await getDoc(doc(db, "publicChapterRegistry", chapterId));
  return snapshot.exists() ? recordFromSnapshot(snapshot) : null;
}

async function loadVerificationRecord(rawId) {
  const root = document.querySelector("#verification-root");
  if (!root) return;
  const chapterId = normalizeChapterId(rawId);
  if (!DIRECT_ID_PATTERN.test(chapterId)) {
    root.innerHTML = registryError("Invalid Chapter ID", "The Chapter ID must begin with TPP-CH- and end with letters and/or numbers.");
    return;
  }
  try {
    const record = await fetchChapterById(chapterId);
    if (!record) {
      root.innerHTML = registryNotFound(chapterId);
      return;
    }
    root.innerHTML = verificationRecordMarkup(record);
    document.title = `${record.officialName || chapterId} | The Prayer Project`;
    renderQrCode(record.chapterId);
    bindDynamicRegistryEvents();
  } catch (error) {
    console.error("Unable to load chapter verification.", error);
    root.innerHTML = registryError("Registry unavailable", "The official record could not be loaded. Confirm that the Firestore rules are deployed and try again.");
  }
}

function verificationRecordMarkup(record) {
  const authTone = statusTone(record.authorizationStatus);
  const standing = record.standing || "under_review";
  const location = [record.city, record.state, record.country].filter(Boolean).join(", ") || "Not publicly listed";
  const host = record.hostInstitutionName || "Not publicly listed";
  const serviceArea = record.serviceArea || location;
  const lastVerified = formatDate(record.lastVerifiedAt || record.updatedAt, "Not listed");
  const url = verificationUrl(record.chapterId);
  return `
    <article class="verification-card verification-${authTone}">
      <div class="verification-banner">
        <div class="verification-seal">${authTone === "success" ? icons.check : icons.alert}</div>
        <div><span class="verification-overline">Official registry result</span><h2>${escapeHTML(authorizationLabel(record.authorizationStatus))}</h2><p>${escapeHTML(verificationStatement(record))}</p></div>
      </div>
      <div class="verification-body">
        <div class="verification-heading-row"><div><p class="chapter-id">${escapeHTML(record.chapterId)}</p><h1>${escapeHTML(record.officialName || "Official Prayer Project Chapter")}</h1><p class="chapter-summary">${escapeHTML(record.summary || `An official public chapter record for ${host}.`)}</p></div><div class="verification-badges"><span class="status-pill status-${authTone}">${escapeHTML(authorizationLabel(record.authorizationStatus))}</span><span class="status-pill status-${standingTone(standing)}">${escapeHTML(standingLabel(standing))}</span></div></div>
        <div class="verification-details-grid">
          <div class="verification-detail">${icons.building}<span><small>Host institution</small><strong>${escapeHTML(host)}</strong><em>${escapeHTML(titleCase(record.institutionType || "organization"))}</em></span></div>
          <div class="verification-detail">${icons.map}<span><small>Location</small><strong>${escapeHTML(location)}</strong><em>${escapeHTML(serviceArea)}</em></span></div>
          <div class="verification-detail">${icons.calendar}<span><small>Approval date</small><strong>${escapeHTML(formatDate(record.approvalDate))}</strong><em>Effective: ${escapeHTML(formatDate(record.effectiveDate || record.approvalDate))}</em></span></div>
          <div class="verification-detail">${icons.status}<span><small>Renewal or review</small><strong>${escapeHTML(formatDate(record.renewalDate))}</strong><em>Last verified: ${escapeHTML(lastVerified)}</em></span></div>
        </div>
        ${record.publicNotice ? `<div class="alert alert-${authTone}" style="margin-top:22px">${authTone === "success" ? icons.info : icons.alert}<div><strong>Public notice</strong>${escapeHTML(record.publicNotice)}</div></div>` : ""}
        <div class="verification-proof">
          <div class="qr-panel"><div id="verification-qr" data-url="${escapeHTML(url)}"></div><span>Scan to reopen this live record</span></div>
          <div class="proof-copy"><p class="eyebrow">Current online record</p><h2>Printed copies do not override this status.</h2><p>This registry entry is the current public source of truth for the chapter's authorization. A previously issued approval letter or certificate may no longer reflect the chapter's present status.</p><div class="verification-url">${escapeHTML(url)}</div></div>
        </div>
        <div class="verification-actions"><button class="btn btn-primary" type="button" data-copy-verification="${escapeHTML(url)}">${icons.copy} Copy verification link</button><button class="btn btn-secondary" type="button" data-print-verification>${icons.print} Print record</button><a class="btn btn-secondary" href="#/report-chapter?chapterId=${encodeURIComponent(record.chapterId)}&chapterName=${encodeURIComponent(record.officialName || "")}">${icons.flag} Report a concern</a></div>
      </div>
    </article>`;
}

function renderQrCode(chapterId) {
  const target = document.querySelector("#verification-qr");
  if (!target) return;
  const url = verificationUrl(chapterId);
  if (typeof window.QRCode !== "function") {
    target.innerHTML = `<div class="qr-fallback">QR</div>`;
    return;
  }
  target.innerHTML = "";
  new window.QRCode(target, {
    text: url,
    width: 156,
    height: 156,
    colorDark: "#171612",
    colorLight: "#fffdf8",
    correctLevel: window.QRCode.CorrectLevel.M
  });
}

async function runRegistrySearch(rawQuery) {
  const root = document.querySelector("#registry-search-results");
  if (!root) return;
  const searchTerm = String(rawQuery || "").trim();
  if (!searchTerm) {
    root.innerHTML = registrySearchHelp();
    return;
  }
  root.innerHTML = registryLoading("Searching official chapter records…");
  try {
    const possibleId = normalizeChapterId(searchTerm);
    if (DIRECT_ID_PATTERN.test(possibleId)) {
      const record = await fetchChapterById(possibleId);
      root.innerHTML = record ? searchResultsMarkup([record], searchTerm) : registryNotFound(possibleId);
      return;
    }
    const token = normalizeSearchToken(searchTerm);
    if (!token) {
      root.innerHTML = registryError("Search needs more detail", "Enter at least two letters or use a full Chapter ID.");
      return;
    }
    const snapshot = await getDocs(query(
      collection(db, "publicChapterRegistry"),
      where("isPublished", "==", true)
    ));
    const normalizedPhrase = searchTerm.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    const records = snapshot.docs
      .map(recordFromSnapshot)
      .filter((record) => {
        const searchable = [
          record.chapterId,
          record.officialName,
          record.hostInstitutionName,
          record.city,
          record.state,
          record.country,
          ...(Array.isArray(record.searchTokens) ? record.searchTokens : [])
        ].join(" ").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
        return searchable.includes(normalizedPhrase) || searchable.split(/\s+/).includes(token);
      })
      .sort((a, b) => String(a.officialName || a.chapterId).localeCompare(String(b.officialName || b.chapterId)))
      .slice(0, 20);
    root.innerHTML = records.length ? searchResultsMarkup(records, searchTerm) : registryNoMatches(searchTerm);
  } catch (error) {
    console.error("Registry search failed.", error);
    root.innerHTML = registryError("Search unavailable", "The registry query could not be completed. The public registry rules may not be deployed or the service may be temporarily unavailable.");
  }
}

function searchResultsMarkup(records, searchTerm) {
  return `<div class="results-heading"><div><p class="page-kicker">Registry results</p><h2>${records.length} ${records.length === 1 ? "record" : "records"} found</h2><p>Results for “${escapeHTML(searchTerm)}”</p></div></div><div class="registry-results-grid">${records.map(registryResultCard).join("")}</div>`;
}

function registryResultCard(record) {
  const authTone = statusTone(record.authorizationStatus);
  const location = [record.city, record.state].filter(Boolean).join(", ") || record.country || "Location not listed";
  return `<a class="registry-result-card" href="#/verify/${encodeURIComponent(record.chapterId)}"><div class="result-card-top"><span class="chapter-id">${escapeHTML(record.chapterId)}</span><span class="status-pill status-${authTone}">${escapeHTML(authorizationLabel(record.authorizationStatus))}</span></div><h3>${escapeHTML(record.officialName || record.chapterId)}</h3><p>${escapeHTML(record.hostInstitutionName || "Host institution not listed")}</p><div class="result-card-meta"><span>${icons.map}${escapeHTML(location)}</span><span>${icons.status}${escapeHTML(standingLabel(record.standing))}</span></div><span class="result-card-action">View official record ${icons.arrow}</span></a>`;
}

async function loadDirectory({ reset = false } = {}) {
  const root = document.querySelector("#directory-results");
  if (!root || state.directory.loading) return;
  if (reset) {
    state.directory = { records: [], cursor: null, hasMore: false, loading: false, loaded: false, error: null };
    root.innerHTML = registryLoading("Loading published chapters…");
  }
  state.directory.loading = true;
  try {
    const snapshot = await getDocs(query(
      collection(db, "publicChapterRegistry"),
      where("isPublished", "==", true)
    ));
    state.directory.records = snapshot.docs
      .map(recordFromSnapshot)
      .sort((a, b) => String(a.officialName || a.chapterId).localeCompare(String(b.officialName || b.chapterId)));
    state.directory.cursor = null;
    state.directory.hasMore = false;
    state.directory.loaded = true;
    root.innerHTML = directoryMarkup();
    bindDynamicRegistryEvents();
  } catch (error) {
    console.error("Unable to load chapter directory.", error);
    state.directory.error = error;
    root.innerHTML = registryError("Directory unavailable", "The directory could not be loaded. Confirm that the public registry rules are deployed.");
  } finally {
    state.directory.loading = false;
  }
}

function directoryMarkup() {
  if (!state.directory.records.length) {
    return `<div class="empty-state directory-empty"><div class="empty-icon">${icons.building}</div><h2>No published chapters yet</h2><p>The directory is operational, but no records are currently marked <code>isPublished: true</code> in the public registry.</p><a class="btn btn-secondary" href="#/about-verification">Learn about verification</a></div>`;
  }
  return `<div class="results-heading"><div><p class="page-kicker">Official directory</p><h2>${state.directory.records.length} published ${state.directory.records.length === 1 ? "record" : "records"}</h2><p>Sorted by official chapter name.</p></div></div><div class="registry-results-grid directory-grid">${state.directory.records.map(registryResultCard).join("")}</div>${state.directory.hasMore ? `<div class="load-more-wrap"><button class="btn btn-secondary" type="button" data-load-more-chapters>Load more chapters</button></div>` : ""}`;
}

function registryNotFound(chapterId) {
  return `<div class="registry-state-card registry-not-found"><div class="registry-state-icon">${icons.search}</div><p class="page-kicker">No published record</p><h2>Chapter not found</h2><p>No public Prayer Project chapter record matches <strong>${escapeHTML(chapterId)}</strong>. Confirm the ID carefully. A missing result does not verify a chapter.</p><div class="content-actions"><a class="btn btn-primary" href="#/verify">Search again</a><a class="btn btn-secondary" href="#/report-chapter?chapterId=${encodeURIComponent(chapterId)}">Report a concern</a></div></div>`;
}

function registryNoMatches(searchTerm) {
  return `<div class="registry-state-card"><div class="registry-state-icon">${icons.search}</div><p class="page-kicker">No matching search terms</p><h2>No chapters matched</h2><p>No published records matched “${escapeHTML(searchTerm)}.” Try the permanent Chapter ID, a shorter institution name, or a city or state.</p><a class="btn btn-secondary" href="#/chapters">Browse the directory</a></div>`;
}

function registryError(title, message) {
  return `<div class="registry-state-card registry-error"><div class="registry-state-icon">${icons.alert}</div><p class="page-kicker">Unable to complete request</p><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p><button class="btn btn-secondary" type="button" data-retry-route>Try again</button></div>`;
}

function alertMarkup(type, title, message) {
  const icon = type === "danger" || type === "warning" ? icons.alert : type === "success" ? icons.check : icons.info;
  return `<div class="alert alert-${type}" style="margin-top:20px">${icon}<div><strong>${escapeHTML(title)}</strong>${escapeHTML(message)}</div></div>`;
}

function setInlineAlert(targetId, type, title, message) {
  const target = document.querySelector(`#${targetId}`);
  if (target) target.innerHTML = alertMarkup(type, title, message);
}

function toast(title, message) {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `${icons.check}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

function friendlyAuthError(error) {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-disabled": "This Firebase Authentication account has been disabled.",
    "auth/too-many-requests": "Too many attempts were made. Wait a moment and try again.",
    "auth/network-request-failed": "The portal could not reach Firebase. Check your connection and try again."
  };
  return messages[error?.code || ""] || "The request could not be completed. Please try again.";
}

async function loadProfile(user) {
  state.profile = null;
  state.profileError = null;
  if (!user) return;
  try {
    const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
    if (snapshot.exists()) state.profile = { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error("Unable to load portal profile.", error);
    state.profileError = error;
  }
}

async function handleLogin(form) {
  const submit = form.querySelector("#login-submit");
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    setInlineAlert("auth-alert", "warning", "Missing information", "Enter both your email address and password.");
    return;
  }
  submit.disabled = true;
  submit.textContent = "Signing in…";
  try {
    await authPersistenceReady;
    await signInWithEmailAndPassword(auth, email, password);
    navigate("/portal");
  } catch (error) {
    setInlineAlert("auth-alert", "danger", "Sign-in failed", friendlyAuthError(error));
  } finally {
    submit.disabled = false;
    submit.textContent = "Sign in securely";
  }
}

async function handleReset(form) {
  const submit = form.querySelector("#reset-submit");
  const email = form.email.value.trim();
  if (!email) {
    setInlineAlert("auth-alert", "warning", "Email required", "Enter the email address associated with your portal account.");
    return;
  }
  submit.disabled = true;
  submit.textContent = "Sending…";
  try {
    await sendPasswordResetEmail(auth, email);
    setInlineAlert("auth-alert", "success", "Reset email sent", "Check your inbox and follow the instructions from Firebase Authentication.");
    form.reset();
  } catch (error) {
    setInlineAlert("auth-alert", "danger", "Unable to send reset", friendlyAuthError(error));
  } finally {
    submit.disabled = false;
    submit.textContent = "Send reset email";
  }
}

async function handleProfileSave(form) {
  const submit = form.querySelector("#profile-submit");
  const displayName = form.displayName.value.trim();
  if (displayName.length < 2) {
    setInlineAlert("profile-alert", "warning", "Name required", "Enter at least two characters.");
    return;
  }
  submit.disabled = true;
  submit.textContent = "Saving…";
  try {
    await updateDoc(doc(db, "systemUsers", state.user.uid), { displayName, updatedAt: serverTimestamp() });
    state.profile.displayName = displayName;
    toast("Profile updated", "Your display name has been saved.");
    render();
  } catch (error) {
    console.error(error);
    setInlineAlert("profile-alert", "danger", "Update failed", "Firestore denied or could not complete the profile update.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Save profile";
  }
}

async function handleUnauthorizedReport(form) {
  const submit = form.querySelector("#report-submit");
  if (form.companyWebsite.value) return;
  if (!form.reporterName.value.trim() || !form.reporterEmail.value.trim() || !form.relationship.value || !form.chapterName.value.trim() || !form.institution.value.trim() || !form.location.value.trim() || form.details.value.trim().length < 20 || !form.consent.checked) {
    setInlineAlert("report-alert", "warning", "Complete the required fields", "Provide your contact information, the reported group, at least 20 characters of detail, and the confirmation checkbox.");
    return;
  }
  const lastReport = Number(localStorage.getItem("tpp-last-public-report") || 0);
  if (Date.now() - lastReport < 60000) {
    setInlineAlert("report-alert", "warning", "Please wait", "A report was submitted from this browser recently. Wait one minute before trying again.");
    return;
  }
  submit.disabled = true;
  submit.textContent = "Submitting…";
  try {
    const reference = await addDoc(collection(db, "unauthorizedChapterReports"), {
      reportType: "unauthorized_chapter",
      reporterName: form.reporterName.value.trim(),
      reporterEmail: form.reporterEmail.value.trim().toLowerCase(),
      relationship: form.relationship.value,
      chapterName: form.chapterName.value.trim(),
      chapterId: normalizeChapterId(form.chapterId.value),
      institution: form.institution.value.trim(),
      location: form.location.value.trim(),
      details: form.details.value.trim(),
      consent: true,
      status: "new",
      source: "public_registry",
      pageUrl: window.location.href.slice(0, 500),
      createdAt: serverTimestamp()
    });
    localStorage.setItem("tpp-last-public-report", String(Date.now()));
    form.reset();
    setInlineAlert("report-alert", "success", "Report received", `Your reference number is ${reference.id}. Prayer Project staff can now review the concern.`);
    window.scrollTo({ top: document.querySelector("#report-alert")?.offsetTop || 0, behavior: "smooth" });
  } catch (error) {
    console.error("Unable to submit public report.", error);
    setInlineAlert("report-alert", "danger", "Report not submitted", "Firestore could not accept the report. Confirm that the Phase 2 security rules are published and try again.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Submit report";
  }
}

async function handleSignOut() {
  try {
    await signOut(auth);
    navigate("/login");
  } catch (error) {
    console.error("Unable to sign out.", error);
  }
}

function bindDynamicRegistryEvents() {
  document.querySelectorAll("[data-copy-verification]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copyVerification);
        toast("Link copied", "The official verification link is ready to share.");
      } catch {
        toast("Copy unavailable", "Select and copy the verification URL shown on the page.");
      }
    });
  });
  document.querySelectorAll("[data-print-verification]").forEach((button) => button.addEventListener("click", () => window.print()));
  document.querySelectorAll("[data-load-more-chapters]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Loading…";
    await loadDirectory({ reset: false });
  }));
  document.querySelectorAll("[data-retry-route]").forEach((button) => button.addEventListener("click", () => hydratePublicRoute(state.currentRoute)));
}

function bindEvents() {
  document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => button.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
    render();
  }));
  document.querySelectorAll('[data-action="toggle-password"]').forEach((button) => button.addEventListener("click", () => {
    const input = document.querySelector("#password");
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }));
  document.querySelectorAll('[data-action="sign-out"]').forEach((button) => button.addEventListener("click", handleSignOut));
  document.querySelectorAll('[data-action="toggle-mobile-nav"]').forEach((button) => button.addEventListener("click", () => document.querySelector("#sidebar")?.classList.toggle("open")));
  document.querySelectorAll('[data-action="retry-profile"]').forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Checking…";
    await loadProfile(state.user);
    render();
  }));
  document.querySelectorAll("[data-registry-search]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const searchTerm = new FormData(form).get("query")?.toString().trim() || "";
    if (!searchTerm) {
      form.querySelector("input")?.focus();
      return;
    }
    const possibleId = normalizeChapterId(searchTerm);
    if (DIRECT_ID_PATTERN.test(possibleId)) navigate(`/verify/${encodeURIComponent(possibleId)}`);
    else navigate(`/verify?q=${encodeURIComponent(searchTerm)}`);
  }));
  document.querySelector("#login-form")?.addEventListener("submit", (event) => { event.preventDefault(); handleLogin(event.currentTarget); });
  document.querySelector("#reset-form")?.addEventListener("submit", (event) => { event.preventDefault(); handleReset(event.currentTarget); });
  document.querySelector("#profile-form")?.addEventListener("submit", (event) => { event.preventDefault(); handleProfileSave(event.currentTarget); });
  document.querySelector("#unauthorized-report-form")?.addEventListener("submit", (event) => { event.preventDefault(); handleUnauthorizedReport(event.currentTarget); });
  bindDynamicRegistryEvents();
}

applyTheme(localStorage.getItem("tpp-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
window.addEventListener("hashchange", render);

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  await loadProfile(user);
  state.authReady = true;
  render();
});

app.innerHTML = loadingScreen();
