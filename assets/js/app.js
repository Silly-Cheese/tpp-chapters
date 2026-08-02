import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, firebaseConfig, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");

const state = {
  authReady: false,
  user: null,
  profile: null,
  profileError: null,
  currentRoute: "",
  mobileNavOpen: false
};

const ROLE_LABELS = Object.freeze({
  owner: "Owner",
  chapterAdmin: "Chapter Administrator",
  complianceAdmin: "Compliance Administrator",
  supportAgent: "Support Agent",
  director: "Chapter Director",
  adviser: "Chapter Adviser"
});

const ACTIVE_STATUSES = new Set(["active"]);

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
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 2 21h20z"/><path d="M12 9v5m0 3h.01"/></svg>`
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
  const route = raw.startsWith("/") ? raw : `/${raw}`;
  return route.split("?")[0].replace(/\/+$/, "") || "/";
}

function navigate(route) {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  if (location.hash === `#${normalized}`) render();
  else location.hash = normalized;
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

function publicLayout(content) {
  return `
    <header class="public-header">
      <div class="header-inner">
        ${brand()}
        <div class="header-actions">
          ${themeButton()}
          ${state.user ? `<a class="btn btn-primary" href="#/dashboard">Open portal</a>` : `<a class="btn btn-primary" href="#/login">Sign in</a>`}
        </div>
      </div>
    </header>
    <main class="public-main" id="main-content">${content}</main>
    <footer class="public-footer">
      <div class="footer-inner">
        <span>© ${new Date().getFullYear()} The Prayer Project</span>
        <span>Faith • Hope • Community</span>
      </div>
    </footer>
    <div class="toast-region" id="toast-region" aria-live="assertive"></div>`;
}

function publicHome() {
  return publicLayout(`
    <section class="hero">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">Chapter Registry & Operations</p>
          <h1>Serving every chapter with <span>clarity and care.</span></h1>
          <p class="hero-copy">The official home for Prayer Project chapter access, administration, standing, and future public verification.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="${state.user ? "#/dashboard" : "#/login"}">${state.user ? "Open your dashboard" : "Portal sign in"} ${icons.arrow}</a>
            <a class="btn btn-secondary" href="#/system-status">View system status</a>
          </div>
        </div>
        <aside class="hero-panel" aria-label="Platform status">
          <p class="panel-kicker">Phase 1 Foundation</p>
          <h2>Secure access begins here.</h2>
          <p>The core authentication, role routing, account profile, responsive application shell, and Firebase connection are now established.</p>
          <ul class="status-list">
            <li><span class="status-dot"></span> Firebase Authentication connected</li>
            <li><span class="status-dot"></span> Role-protected portal routes</li>
            <li><span class="status-dot"></span> Mobile-ready design system</li>
          </ul>
        </aside>
      </div>
    </section>
    <section class="section">
      <div class="section-inner">
        <div class="section-heading">
          <p class="eyebrow">One shared foundation</p>
          <h2>Built for public trust and private operations.</h2>
          <p>The platform is structured to support a public registry, chapter leadership accounts, administrative review, and internal support without making the experience feel fragmented.</p>
        </div>
        <div class="feature-grid">
          <article class="feature-card"><div class="feature-number">01</div><h3>Protected access</h3><p>Authentication and Firestore-based role checks keep each portal experience limited to the correct people.</p></article>
          <article class="feature-card"><div class="feature-number">02</div><h3>Unified design</h3><p>A single visual system establishes the black, cream, white, and gold identity across every future phase.</p></article>
          <article class="feature-card"><div class="feature-number">03</div><h3>Expandable structure</h3><p>The foundation is ready for verification, activation, chapter workflows, support conversations, and administration.</p></article>
        </div>
      </div>
    </section>`);
}

function authLayout(content) {
  return `
    <main class="auth-page" id="main-content">
      <section class="auth-brand-panel">
        ${brand({ light: true })}
        <div class="auth-message">
          <p class="eyebrow">Official Chapter Access</p>
          <h2>A trusted place for every chapter.</h2>
          <p>Secure access for Prayer Project administrators, Chapter Directors, and Chapter Advisers.</p>
        </div>
        <p class="auth-quote">“Devote yourselves to prayer, being watchful and thankful.” — Colossians 4:2</p>
      </section>
      <section class="auth-form-panel">
        <div class="auth-card">
          <div class="auth-topline">${themeButton()}</div>
          ${content}
        </div>
      </section>
    </main>
    <div class="toast-region" id="toast-region" aria-live="assertive"></div>`;
}

function loginPage() {
  if (state.user && state.profile && ACTIVE_STATUSES.has(state.profile.accountStatus)) {
    queueMicrotask(() => navigate("/dashboard"));
    return loadingScreen("Opening your dashboard…");
  }

  return authLayout(`
    <div class="auth-heading">
      <p class="page-kicker">Welcome back</p>
      <h1>Sign in</h1>
      <p>Use the account assigned to your Prayer Project role.</p>
    </div>
    <div id="auth-alert"></div>
    <form class="form" id="login-form" novalidate>
      <div class="field">
        <label for="email">Email address</label>
        <input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <div class="input-wrap">
          <input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" minlength="6" required>
          <button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password">${icons.eye}</button>
        </div>
      </div>
      <div class="form-meta"><a class="text-link" href="#/forgot-password">Forgot password?</a></div>
      <button class="btn btn-primary btn-block" id="login-submit" type="submit">Sign in securely</button>
    </form>
    <p class="auth-footer">Access is limited to approved Prayer Project accounts.</p>`);
}

function forgotPasswordPage() {
  return authLayout(`
    <div class="auth-heading">
      <p class="page-kicker">Account recovery</p>
      <h1>Reset password</h1>
      <p>Enter your account email and Firebase will send password-reset instructions.</p>
    </div>
    <div id="auth-alert"></div>
    <form class="form" id="reset-form" novalidate>
      <div class="field">
        <label for="reset-email">Email address</label>
        <input class="input" id="reset-email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required>
      </div>
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
          <a class="nav-link ${activeRoute === "/dashboard" ? "active" : ""}" href="#/dashboard">${icons.home}<span>Overview</span></a>
          <a class="nav-link ${activeRoute === "/profile" ? "active" : ""}" href="#/profile">${icons.user}<span>My profile</span></a>
          <a class="nav-link ${activeRoute === "/system-status" ? "active" : ""}" href="#/system-status">${icons.status}<span>System status</span></a>
          <p class="nav-label">Account</p>
          <button class="nav-link" type="button" data-action="sign-out">${icons.logout}<span>Sign out</span></button>
        </nav>
        <div class="sidebar-footer">
          <div class="user-mini">
            <div class="avatar">${escapeHTML(initials(displayName))}</div>
            <div class="user-mini-copy">
              <div class="user-mini-name">${escapeHTML(displayName)}</div>
              <div class="user-mini-role">${escapeHTML(role)}</div>
            </div>
          </div>
        </div>
      </aside>
      <div class="app-main">
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:12px">
            <button class="icon-btn mobile-menu" type="button" data-action="toggle-mobile-nav" aria-label="Open navigation">${icons.menu}</button>
            <div class="topbar-title">${escapeHTML(title)}</div>
          </div>
          <div class="topbar-actions">
            ${profileStatusBadge(profile)}
            ${themeButton()}
          </div>
        </header>
        <main class="page-content" id="main-content">${content}</main>
      </div>
    </div>
    <div class="toast-region" id="toast-region" aria-live="assertive"></div>`;
}

function ownerDashboard() {
  const profile = state.profile;
  const displayName = profile.displayName || state.user.email.split("@")[0];
  return appLayout(`
    <header class="page-heading">
      <div>
        <p class="page-kicker">Owner workspace</p>
        <h1>Welcome, ${escapeHTML(displayName)}.</h1>
        <p>The core platform is connected and protected. This dashboard confirms the Phase 1 foundation before chapter records and public verification are added.</p>
      </div>
      <span class="badge badge-success">Foundation operational</span>
    </header>

    <section class="grid grid-4" aria-label="Foundation metrics">
      <article class="card metric-card"><div class="metric-label">Account role</div><div class="metric-value">${escapeHTML(roleLabel(profile.systemRole))}</div><div class="metric-note">Loaded from Firestore</div></article>
      <article class="card metric-card"><div class="metric-label">Account status</div><div class="metric-value">${escapeHTML(titleCase(profile.accountStatus))}</div><div class="metric-note">Access is currently authorized</div></article>
      <article class="card metric-card"><div class="metric-label">Firebase project</div><div class="metric-value">${escapeHTML(firebaseConfig.projectId)}</div><div class="metric-note">Production configuration connected</div></article>
      <article class="card metric-card"><div class="metric-label">Current phase</div><div class="metric-value">Phase 1</div><div class="metric-note">Foundation and design system</div></article>
    </section>

    <section class="grid grid-2" style="margin-top:18px">
      <article class="card">
        <div class="card-header"><div><h2 class="card-title">Foundation checklist</h2><p class="card-subtitle">Every item below is active in this release.</p></div>${icons.shield}</div>
        <div class="card-body">
          <ul class="check-list">
            <li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Firebase Authentication</strong><span>Email-and-password login, persistent sessions, reset emails, and sign-out are wired.</span></div></li>
            <li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Role-protected routing</strong><span>Portal access depends on a valid Firestore profile and active account status.</span></div></li>
            <li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Responsive portal shell</strong><span>Public, authentication, desktop, tablet, and mobile layouts use one design system.</span></div></li>
            <li class="check-item"><span class="check-icon">${icons.check}</span><div class="check-copy"><strong>Safe profile editing</strong><span>Users may update only their own display name under the provided Firestore rules.</span></div></li>
          </ul>
        </div>
      </article>
      <article class="card">
        <div class="card-header"><div><h2 class="card-title">Available actions</h2><p class="card-subtitle">All actions shown here are working now.</p></div></div>
        <div class="card-body">
          <div class="action-list">
            <a class="action-link" href="#/profile"><div><strong>Review your account</strong><span>Confirm your identity, role, UID, and contact information.</span></div>${icons.arrow}</a>
            <a class="action-link" href="#/system-status"><div><strong>Check system status</strong><span>Verify the Firebase connection and deployment configuration.</span></div>${icons.arrow}</a>
            <button class="action-link" type="button" data-action="sign-out"><div><strong>Securely sign out</strong><span>End this browser session and return to the login page.</span></div>${icons.arrow}</button>
          </div>
        </div>
      </article>
    </section>

    <section class="card" style="margin-top:18px">
      <div class="card-header"><div><h2 class="card-title">Platform release record</h2><p class="card-subtitle">Phase 1 deployment details.</p></div><span class="badge badge-info">Production foundation</span></div>
      <div class="card-body">
        <dl class="detail-list">
          <div class="detail-row"><dt>Public domain</dt><dd>chapter.ask4prayers.com</dd></div>
          <div class="detail-row"><dt>Repository</dt><dd>Silly-Cheese/tpp-chapters</dd></div>
          <div class="detail-row"><dt>Authentication</dt><dd>Firebase Email/Password</dd></div>
          <div class="detail-row"><dt>Data authorization</dt><dd>Firestore Security Rules + systemUsers role records</dd></div>
          <div class="detail-row"><dt>Visual identity</dt><dd>Black, cream, white, and restrained gold</dd></div>
        </dl>
      </div>
    </section>`, "/dashboard", "Owner Dashboard");
}

function roleDashboard() {
  const profile = state.profile;
  const displayName = profile.displayName || state.user.email.split("@")[0];
  const role = roleLabel(profile.systemRole);
  const isChapterRole = ["director", "adviser"].includes(profile.systemRole);

  return appLayout(`
    <header class="page-heading">
      <div>
        <p class="page-kicker">Secure workspace</p>
        <h1>Welcome, ${escapeHTML(displayName)}.</h1>
        <p>Your ${escapeHTML(role)} account is active and correctly routed. Chapter assignments and operational records will be connected during the account-activation and portal phases.</p>
      </div>
      <span class="badge badge-success">Access confirmed</span>
    </header>
    <section class="grid grid-3">
      <article class="card metric-card"><div class="metric-label">Assigned role</div><div class="metric-value">${escapeHTML(role)}</div><div class="metric-note">Protected by Firestore</div></article>
      <article class="card metric-card"><div class="metric-label">Account status</div><div class="metric-value">${escapeHTML(titleCase(profile.accountStatus))}</div><div class="metric-note">Portal access authorized</div></article>
      <article class="card metric-card"><div class="metric-label">Workspace</div><div class="metric-value">${isChapterRole ? "Chapter" : "Administration"}</div><div class="metric-note">Role-specific routing active</div></article>
    </section>
    <section class="card" style="margin-top:18px">
      <div class="empty-state">
        <div class="empty-icon">${icons.shield}</div>
        <h2>Your account foundation is ready</h2>
        <p>The complete records, compliance tools, reports, and support areas assigned to this role will be introduced in their scheduled phases. Authentication, identity, profile management, and route protection are already usable.</p>
        <a class="btn btn-primary" href="#/profile">Review my profile</a>
      </div>
    </section>`, "/dashboard", `${role} Dashboard`);
}

function dashboardPage() {
  return state.profile?.systemRole === "owner" ? ownerDashboard() : roleDashboard();
}

function profilePage() {
  const profile = state.profile;
  const displayName = profile.displayName || "";
  return appLayout(`
    <header class="page-heading">
      <div>
        <p class="page-kicker">Account settings</p>
        <h1>My profile</h1>
        <p>Review your official portal identity. Only your display name is editable in Phase 1.</p>
      </div>
      ${profileStatusBadge(profile)}
    </header>
    <section class="grid grid-2">
      <article class="card">
        <div class="card-header"><div><h2 class="card-title">Profile details</h2><p class="card-subtitle">This name appears throughout the portal.</p></div></div>
        <div class="card-body">
          <div id="profile-alert"></div>
          <form class="form" id="profile-form" novalidate>
            <div class="field">
              <label for="display-name">Display name</label>
              <input class="input" id="display-name" name="displayName" type="text" autocomplete="name" maxlength="80" value="${escapeHTML(displayName)}" required>
              <span class="field-hint">Use the name Prayer Project administrators should recognize.</span>
            </div>
            <div class="field">
              <label for="profile-email">Email address</label>
              <input class="input" id="profile-email" type="email" value="${escapeHTML(state.user.email || "")}" disabled>
              <span class="field-hint">Email changes are managed through Firebase Authentication.</span>
            </div>
            <button class="btn btn-primary" id="profile-submit" type="submit">Save profile</button>
          </form>
        </div>
      </article>
      <article class="card">
        <div class="card-header"><div><h2 class="card-title">Access record</h2><p class="card-subtitle">Protected identity information for this account.</p></div></div>
        <div class="card-body">
          <dl class="detail-list">
            <div class="detail-row"><dt>Portal role</dt><dd>${escapeHTML(roleLabel(profile.systemRole))}</dd></div>
            <div class="detail-row"><dt>Account status</dt><dd>${escapeHTML(titleCase(profile.accountStatus))}</dd></div>
            <div class="detail-row"><dt>Firebase UID</dt><dd>${escapeHTML(state.user.uid)}</dd></div>
            <div class="detail-row"><dt>Email verified</dt><dd>${state.user.emailVerified ? "Yes" : "Not yet"}</dd></div>
            <div class="detail-row"><dt>Authentication provider</dt><dd>Email and password</dd></div>
          </dl>
        </div>
      </article>
    </section>`, "/profile", "My Profile");
}

function systemStatusContent({ authenticated = false } = {}) {
  const connected = Boolean(state.user && state.profile && !state.profileError);
  return `
    <header class="page-heading">
      <div>
        <p class="page-kicker">Platform health</p>
        <h1>System status</h1>
        <p>Current connection details for the Chapter Registry and Operations Portal.</p>
      </div>
      <span class="badge ${connected ? "badge-success" : "badge-info"}">${connected ? "Connected" : "Public site online"}</span>
    </header>
    <section class="grid grid-3">
      <article class="card metric-card"><div class="metric-label">Website</div><div class="metric-value">Online</div><div class="metric-note">GitHub Pages deployment</div></article>
      <article class="card metric-card"><div class="metric-label">Firebase project</div><div class="metric-value">${escapeHTML(firebaseConfig.projectId)}</div><div class="metric-note">Client configuration loaded</div></article>
      <article class="card metric-card"><div class="metric-label">Account connection</div><div class="metric-value">${authenticated ? (connected ? "Verified" : "Limited") : "Not signed in"}</div><div class="metric-note">${authenticated ? "Firestore profile check" : "Sign in for a private check"}</div></article>
    </section>
    <section class="card" style="margin-top:18px">
      <div class="card-header"><div><h2 class="card-title">Service details</h2><p class="card-subtitle">Phase 1 platform components.</p></div></div>
      <div class="card-body">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Component</th><th>Status</th><th>Purpose</th></tr></thead>
            <tbody>
              <tr><td>GitHub Pages</td><td><span class="badge badge-success">Configured</span></td><td>Static website deployment</td></tr>
              <tr><td>Firebase Authentication</td><td><span class="badge badge-success">Integrated</span></td><td>Email/password accounts and sessions</td></tr>
              <tr><td>Cloud Firestore</td><td><span class="badge ${connected ? "badge-success" : "badge-info"}">${connected ? "Verified" : "Configured"}</span></td><td>Role and account records</td></tr>
              <tr><td>Cloud Storage</td><td><span class="badge badge-neutral">Reserved</span></td><td>Future documents and attachments</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>`;
}

function systemStatusPage() {
  if (state.user && state.profile && ACTIVE_STATUSES.has(state.profile.accountStatus)) {
    return appLayout(systemStatusContent({ authenticated: true }), "/system-status", "System Status");
  }
  return publicLayout(`<section class="section"><div class="section-inner">${systemStatusContent()}</div></section>`);
}

function pendingAccessPage() {
  const signedIn = Boolean(state.user);
  return authLayout(`
    <div class="auth-heading">
      <p class="page-kicker">Access not assigned</p>
      <h1>Account pending</h1>
      <p>Your Firebase account is valid, but a matching active portal profile was not found.</p>
    </div>
    <div class="alert alert-warning" style="margin-top:26px">${icons.alert}<div><strong>Administrator action is required.</strong> Ask the Prayer Project Owner to create or correct the Firestore document <code>systemUsers/${escapeHTML(state.user?.uid || "YOUR_UID")}</code>.</div></div>
    <div class="form" style="margin-top:22px">
      ${signedIn ? `<button class="btn btn-primary btn-block" type="button" data-action="retry-profile">Retry access check</button><button class="btn btn-secondary btn-block" type="button" data-action="sign-out">Sign out</button>` : `<a class="btn btn-primary btn-block" href="#/login">Return to sign in</a>`}
    </div>`);
}

function disabledAccessPage() {
  return authLayout(`
    <div class="auth-heading">
      <p class="page-kicker">Access restricted</p>
      <h1>Account unavailable</h1>
      <p>This portal account is not currently active.</p>
    </div>
    <div class="alert alert-danger" style="margin-top:26px">${icons.alert}<div><strong>Sign-in succeeded, but portal access is disabled.</strong> Contact The Prayer Project for assistance.</div></div>
    <button class="btn btn-secondary btn-block" style="margin-top:22px" type="button" data-action="sign-out">Sign out</button>`);
}

function notFoundPage() {
  const content = `
    <div class="empty-state">
      <div class="empty-icon">${icons.info}</div>
      <h2>Page not found</h2>
      <p>The address does not match a page in the Chapter Portal.</p>
      <a class="btn btn-primary" href="${state.user ? "#/dashboard" : "#/"}">Return ${state.user ? "to dashboard" : "home"}</a>
    </div>`;
  if (state.user && state.profile && ACTIVE_STATUSES.has(state.profile.accountStatus)) {
    return appLayout(`<section class="card">${content}</section>`, "", "Page Not Found");
  }
  return publicLayout(`<section class="section"><div class="section-inner"><div class="card">${content}</div></div></section>`);
}

function isProtectedRoute(route) {
  return ["/dashboard", "/profile"].includes(route);
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
    if (!ACTIVE_STATUSES.has(state.profile.accountStatus)) {
      app.innerHTML = disabledAccessPage();
      bindEvents();
      return;
    }
  }

  const pages = {
    "/": publicHome,
    "/login": loginPage,
    "/forgot-password": forgotPasswordPage,
    "/dashboard": dashboardPage,
    "/profile": profilePage,
    "/system-status": systemStatusPage,
    "/access-pending": pendingAccessPage
  };

  const page = pages[route] || notFoundPage;
  app.innerHTML = page();
  bindEvents();
  document.title = pageTitle(route);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function pageTitle(route) {
  const titles = {
    "/": "The Prayer Project | Chapter Portal",
    "/login": "Sign In | The Prayer Project",
    "/forgot-password": "Reset Password | The Prayer Project",
    "/dashboard": "Dashboard | The Prayer Project",
    "/profile": "My Profile | The Prayer Project",
    "/system-status": "System Status | The Prayer Project",
    "/access-pending": "Account Pending | The Prayer Project"
  };
  return titles[route] || "Page Not Found | The Prayer Project";
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
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-disabled": "This Firebase Authentication account has been disabled.",
    "auth/too-many-requests": "Too many attempts were made. Wait a moment and try again.",
    "auth/network-request-failed": "The portal could not reach Firebase. Check your connection and try again."
  };
  return messages[code] || "The request could not be completed. Please try again.";
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
    navigate("/dashboard");
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
    await updateDoc(doc(db, "systemUsers", state.user.uid), {
      displayName,
      updatedAt: serverTimestamp()
    });
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

async function handleSignOut() {
  try {
    await signOut(auth);
    navigate("/login");
  } catch (error) {
    console.error("Unable to sign out.", error);
  }
}

function bindEvents() {
  document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
      render();
    });
  });

  document.querySelectorAll('[data-action="toggle-password"]').forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector("#password");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  document.querySelectorAll('[data-action="sign-out"]').forEach((button) => button.addEventListener("click", handleSignOut));

  document.querySelectorAll('[data-action="toggle-mobile-nav"]').forEach((button) => {
    button.addEventListener("click", () => document.querySelector("#sidebar")?.classList.toggle("open"));
  });

  document.querySelectorAll('[data-action="retry-profile"]').forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Checking…";
      await loadProfile(state.user);
      render();
    });
  });

  document.querySelector("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleLogin(event.currentTarget);
  });

  document.querySelector("#reset-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleReset(event.currentTarget);
  });

  document.querySelector("#profile-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleProfileSave(event.currentTarget);
  });
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
