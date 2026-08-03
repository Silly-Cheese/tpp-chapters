import {
  createUserWithEmailAndPassword,
  getIdToken,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");
const PHASE3_ROUTES = new Set([
  "/activate",
  "/verify-email",
  "/activation-complete",
  "/admin/invitations"
]);
const ADMIN_ROLES = new Set(["owner", "chapterAdmin"]);
const CHAPTER_ROLES = new Set(["director", "adviser", "chapterUser"]);
const CHAPTER_ID_PATTERN = /^TPP-CH-[A-Z0-9]{1,32}$/;
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_GROUPS = 4;
const INVITE_CODE_GROUP_LENGTH = 5;

const phase3State = {
  authReady: false,
  user: null,
  profile: null,
  invitations: [],
  invitationLoading: false,
  invitationError: null,
  selectedInvite: null,
  activationMode: "create",
  lastIssuedCode: null,
  lastIssuedUrl: null,
  rendering: false
};

const roleLabels = Object.freeze({
  director: "Chapter Director",
  adviser: "Chapter Adviser"
});

const icons = {
  key: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-2 2 2 2m-5 1 2 2"/></svg>`,
  user: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  mail: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`,
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 2 21h20z"/><path d="M12 9v5m0 3h.01"/></svg>`,
  copy: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
  logout: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>`,
  refresh: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M17.9 15A7 7 0 0 1 6 18l-2-5"/></svg>`,
  plus: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  home: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>`,
  arrow: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`
};

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
  location.hash = normalized;
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeChapterId(value = "") {
  return String(value).trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeInviteCode(value = "") {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/^TPP-/, "")
    .replace(/[^A-Z2-9]/g, "");
}

function formatInviteCode(raw) {
  const normalized = normalizeInviteCode(raw);
  const groups = [];
  for (let i = 0; i < normalized.length; i += INVITE_CODE_GROUP_LENGTH) {
    groups.push(normalized.slice(i, i + INVITE_CODE_GROUP_LENGTH));
  }
  return `TPP-${groups.join("-")}`;
}

function createInviteCode() {
  const totalLength = INVITE_CODE_GROUPS * INVITE_CODE_GROUP_LENGTH;
  const random = new Uint32Array(totalLength);
  crypto.getRandomValues(random);
  let raw = "";
  for (const value of random) raw += INVITE_CODE_ALPHABET[value % INVITE_CODE_ALPHABET.length];
  return formatInviteCode(raw);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, { withTime = false, fallback = "Not available" } = {}) {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {})
  }).format(date);
}

function isExpired(invite) {
  const expiresAt = toDate(invite?.expiresAt);
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

function effectiveInviteStatus(invite) {
  if (invite?.status === "pending" && isExpired(invite)) return "expired";
  return invite?.status || "unknown";
}

function roleLabel(role) {
  return roleLabels[role] || "Chapter Leader";
}

function brand() {
  return `
    <a class="brand" href="#/" aria-label="The Prayer Project Chapter Portal home">
      <img class="brand-mark" src="assets/brand-mark.svg" alt="">
      <span class="brand-copy">
        <span class="brand-name">The Prayer Project</span>
        <span class="brand-subtitle">Chapter Portal</span>
      </span>
    </a>`;
}

function phase3PublicLayout(content, { compact = false } = {}) {
  return `
    <div data-phase3-root class="phase3-root">
      <header class="phase3-header">
        <div class="phase3-header-inner">
          ${brand()}
          <nav class="phase3-header-actions" aria-label="Account activation navigation">
            <a class="btn btn-secondary" href="#/">Registry</a>
            ${phase3State.user ? `<a class="btn btn-secondary" href="#/dashboard">Dashboard</a>` : `<a class="btn btn-secondary" href="#/login">Sign in</a>`}
          </nav>
        </div>
      </header>
      <main class="phase3-main ${compact ? "phase3-main-compact" : ""}" id="main-content">${content}</main>
      <footer class="phase3-footer"><span>© ${new Date().getFullYear()} The Prayer Project</span><span>Faith • Hope • Community</span></footer>
      <div class="toast-region" id="phase3-toast-region" aria-live="assertive"></div>
    </div>`;
}

function phase3AdminLayout(content, active = "invitations") {
  const name = phase3State.profile?.displayName || phase3State.user?.email || "Administrator";
  return `
    <div data-phase3-root class="phase3-admin-shell">
      <aside class="phase3-admin-sidebar">
        <div class="phase3-admin-brand">${brand()}</div>
        <nav class="phase3-admin-nav" aria-label="Administrator navigation">
          <a class="phase3-admin-link" href="#/dashboard">${icons.home}<span>Dashboard</span></a>
          <a class="phase3-admin-link ${active === "invitations" ? "active" : ""}" href="#/admin/invitations">${icons.key}<span>Account invitations</span></a>
          <a class="phase3-admin-link" href="#/verify">${icons.shield}<span>Public registry</span></a>
        </nav>
        <div class="phase3-admin-user">
          <strong>${escapeHTML(name)}</strong>
          <span>${escapeHTML(phase3State.profile?.systemRole === "owner" ? "Owner" : "Chapter Administrator")}</span>
        </div>
      </aside>
      <div class="phase3-admin-main">
        <header class="phase3-admin-topbar">
          <div><span class="phase3-kicker">Phase 3</span><strong>Account Access</strong></div>
          <button class="btn btn-secondary" type="button" data-phase3-action="sign-out">${icons.logout} Sign out</button>
        </header>
        <main class="phase3-admin-content" id="main-content">${content}</main>
      </div>
      <div class="toast-region" id="phase3-toast-region" aria-live="assertive"></div>
    </div>`;
}

function alertMarkup(type, title, message) {
  const icon = type === "success" ? icons.check : type === "info" ? icons.shield : icons.alert;
  return `<div class="alert alert-${type}">${icon}<div><strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span></div></div>`;
}

function setAlert(targetId, type, title, message) {
  const target = document.querySelector(`#${targetId}`);
  if (target) target.innerHTML = alertMarkup(type, title, message);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function toast(title, message) {
  const region = document.querySelector("#phase3-toast-region") || document.querySelector("#toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `${icons.check}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

function activationIntro() {
  return `
    <section class="phase3-activation-grid">
      <div class="phase3-activation-copy">
        <p class="phase3-kicker">Approved chapter access</p>
        <h1>Activate your chapter account.</h1>
        <p>Use the private, single-use code issued by The Prayer Project. The code links your account only to the approved chapter and leadership role named in the invitation.</p>
        <div class="phase3-trust-list">
          <div>${icons.shield}<span><strong>Role protected</strong> Your access is assigned by the invitation, not by the browser.</span></div>
          <div>${icons.key}<span><strong>Single use</strong> A successful activation permanently closes the code.</span></div>
          <div>${icons.mail}<span><strong>Email verified</strong> Chapter accounts must verify their assigned email address.</span></div>
        </div>
      </div>
      <div class="phase3-card phase3-activation-card">
        <div class="phase3-card-heading">
          <span class="phase3-step">Step 1 of 3</span>
          <h2>Enter your activation code</h2>
          <p>Codes begin with <strong>TPP-</strong> and are provided only after chapter approval.</p>
        </div>
        <div id="activation-alert"></div>
        <form class="form" id="activation-code-form" novalidate>
          <div class="field">
            <label for="activation-code">Activation code</label>
            <input class="input phase3-code-input" id="activation-code" name="code" type="text" autocomplete="one-time-code" spellcheck="false" maxlength="32" placeholder="TPP-XXXXX-XXXXX-XXXXX-XXXXX" value="${escapeHTML(hashParams().get("code") || "")}" required>
          </div>
          <button class="btn btn-primary btn-block" id="activation-code-submit" type="submit">Review invitation ${icons.arrow}</button>
        </form>
        <p class="phase3-form-note">An activation code is not the same as a Chapter ID. Contact Prayer Project leadership if your code has expired or was not provided to you directly.</p>
      </div>
    </section>`;
}

function invitationReview(invite) {
  const assignedEmail = invite.email || "";
  const userMismatch = phase3State.user && normalizeEmail(phase3State.user.email) !== normalizeEmail(assignedEmail);
  return `
    <section class="phase3-activation-grid">
      <div class="phase3-activation-copy">
        <p class="phase3-kicker">Invitation confirmed</p>
        <h1>${escapeHTML(roleLabel(invite.role))} access</h1>
        <p>This invitation is assigned to <strong>${escapeHTML(invite.chapterName)}</strong>. Review the official assignment before creating or connecting an account.</p>
        <dl class="phase3-invite-details">
          <div><dt>Chapter</dt><dd>${escapeHTML(invite.chapterName)}</dd></div>
          <div><dt>Chapter ID</dt><dd>${escapeHTML(invite.chapterId)}</dd></div>
          <div><dt>Assigned role</dt><dd>${escapeHTML(roleLabel(invite.role))}</dd></div>
          <div><dt>Assigned email</dt><dd>${escapeHTML(assignedEmail)}</dd></div>
          <div><dt>Expires</dt><dd>${escapeHTML(formatDate(invite.expiresAt, { withTime: true }))}</dd></div>
        </dl>
      </div>
      <div class="phase3-card phase3-activation-card">
        <div class="phase3-card-heading">
          <span class="phase3-step">Step 2 of 3</span>
          <h2>Connect your account</h2>
          <p>The Firebase account email must exactly match the email assigned above.</p>
        </div>
        <div id="activation-alert">${userMismatch ? alertMarkup("warning", "Different account signed in", `Sign out of ${phase3State.user.email} before activating this invitation.`) : ""}</div>
        ${userMismatch ? `
          <button class="btn btn-primary btn-block" type="button" data-phase3-action="sign-out-for-activation">Sign out and continue</button>
        ` : `
          <div class="phase3-segmented" role="tablist" aria-label="Account option">
            <button class="${phase3State.activationMode === "create" ? "active" : ""}" type="button" data-phase3-action="activation-mode" data-mode="create">Create an account</button>
            <button class="${phase3State.activationMode === "existing" ? "active" : ""}" type="button" data-phase3-action="activation-mode" data-mode="existing">Use an existing account</button>
          </div>
          ${phase3State.activationMode === "create" ? createAccountForm(invite) : existingAccountForm(invite)}
        `}
        <button class="phase3-back-link" type="button" data-phase3-action="clear-invite">Use a different code</button>
      </div>
    </section>`;
}

function createAccountForm(invite) {
  return `
    <form class="form" id="activation-create-form" novalidate>
      <div class="field">
        <label for="activation-name">Your full name</label>
        <input class="input" id="activation-name" name="displayName" type="text" autocomplete="name" maxlength="80" value="${escapeHTML(invite.displayName || "")}" required>
      </div>
      <div class="field">
        <label for="activation-email">Assigned email</label>
        <input class="input" id="activation-email" name="email" type="email" value="${escapeHTML(invite.email || "")}" readonly>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="activation-password">Create password</label>
          <input class="input" id="activation-password" name="password" type="password" autocomplete="new-password" minlength="10" required>
        </div>
        <div class="field">
          <label for="activation-confirm">Confirm password</label>
          <input class="input" id="activation-confirm" name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required>
        </div>
      </div>
      <label class="phase3-consent"><input type="checkbox" name="acknowledgment" required><span>I confirm that I am the person assigned to this invitation and that I will protect my portal credentials.</span></label>
      <button class="btn btn-primary btn-block" id="activation-create-submit" type="submit">Create and activate account</button>
    </form>`;
}

function existingAccountForm(invite) {
  return `
    <form class="form" id="activation-existing-form" novalidate>
      <div class="field">
        <label for="existing-email">Assigned email</label>
        <input class="input" id="existing-email" name="email" type="email" value="${escapeHTML(invite.email || "")}" readonly>
      </div>
      <div class="field">
        <label for="existing-password">Existing password</label>
        <input class="input" id="existing-password" name="password" type="password" autocomplete="current-password" required>
      </div>
      <label class="phase3-consent"><input type="checkbox" name="acknowledgment" required><span>I confirm that this is my account and that I am authorized to accept this chapter role.</span></label>
      <button class="btn btn-primary btn-block" id="activation-existing-submit" type="submit">Sign in and accept invitation</button>
      <a class="text-link phase3-centered-link" href="#/forgot-password">Forgot your password?</a>
    </form>`;
}

function activationPage() {
  const content = phase3State.selectedInvite ? invitationReview(phase3State.selectedInvite) : activationIntro();
  return phase3PublicLayout(content);
}

function verifyEmailPage() {
  if (!phase3State.user) {
    queueMicrotask(() => navigate("/login"));
    return phase3PublicLayout(`<section class="phase3-card phase3-message-card"><div class="spinner"></div><h1>Opening sign in…</h1></section>`, { compact: true });
  }
  if (phase3State.user.emailVerified) {
    queueMicrotask(() => navigate("/activation-complete"));
    return phase3PublicLayout(`<section class="phase3-card phase3-message-card"><div class="spinner"></div><h1>Verification confirmed…</h1></section>`, { compact: true });
  }
  return phase3PublicLayout(`
    <section class="phase3-card phase3-message-card">
      <div class="phase3-message-icon">${icons.mail}</div>
      <p class="phase3-kicker">Step 3 of 3</p>
      <h1>Verify your email address.</h1>
      <p>A verification email was sent to <strong>${escapeHTML(phase3State.user.email || "your assigned address")}</strong>. Open that message, select the verification link, and then return here.</p>
      <div id="verification-alert"></div>
      <div class="phase3-button-stack">
        <button class="btn btn-primary" id="check-verification" type="button" data-phase3-action="check-verification">${icons.refresh} I verified my email</button>
        <button class="btn btn-secondary" id="resend-verification" type="button" data-phase3-action="resend-verification">${icons.mail} Resend verification email</button>
        <button class="btn btn-secondary" type="button" data-phase3-action="sign-out">${icons.logout} Sign out</button>
      </div>
      <p class="phase3-form-note">The portal will not open chapter records until Firebase confirms that this email is verified.</p>
    </section>`, { compact: true });
}

async function getOwnMemberships() {
  if (!phase3State.user) return [];
  const snapshot = await getDocs(query(
    collection(db, "chapterMemberships"),
    where("uid", "==", phase3State.user.uid),
    limit(50)
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function activationCompletePage() {
  if (!phase3State.user) {
    queueMicrotask(() => navigate("/login"));
    return phase3PublicLayout(`<section class="phase3-card phase3-message-card"><div class="spinner"></div><h1>Opening sign in…</h1></section>`, { compact: true });
  }
  if (CHAPTER_ROLES.has(phase3State.profile?.systemRole) && !phase3State.user.emailVerified) {
    queueMicrotask(() => navigate("/verify-email"));
    return phase3PublicLayout(`<section class="phase3-card phase3-message-card"><div class="spinner"></div><h1>Checking verification…</h1></section>`, { compact: true });
  }
  return phase3PublicLayout(`
    <section class="phase3-card phase3-message-card phase3-success-card">
      <div class="phase3-message-icon phase3-success-icon">${icons.check}</div>
      <p class="phase3-kicker">Account activated</p>
      <h1>Your chapter access is ready.</h1>
      <p>Your account is connected to its approved chapter assignment. Sign in with this same email and password on any supported device.</p>
      <div id="activation-membership-summary" class="phase3-membership-summary"><div class="spinner"></div><span>Loading chapter assignment…</span></div>
      <div class="phase3-button-stack">
        <a class="btn btn-primary" href="#/dashboard">Open my dashboard ${icons.arrow}</a>
        <a class="btn btn-secondary" href="#/verify">Open public registry</a>
      </div>
    </section>`, { compact: true });
}

function invitationStatusBadge(invite) {
  const status = effectiveInviteStatus(invite);
  const tone = status === "claimed" ? "success" : status === "pending" ? "info" : status === "expired" ? "warning" : "danger";
  const label = status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return `<span class="badge badge-${tone}">${escapeHTML(label)}</span>`;
}

function invitationsTable() {
  if (phase3State.invitationLoading) return `<div class="phase3-table-state"><div class="spinner"></div><span>Loading invitations…</span></div>`;
  if (phase3State.invitationError) return `<div class="phase3-table-state">${alertMarkup("danger", "Unable to load invitations", phase3State.invitationError)}</div>`;
  if (!phase3State.invitations.length) return `<div class="phase3-table-state"><div class="phase3-message-icon">${icons.key}</div><strong>No invitations issued yet</strong><span>Create the first Director or Adviser invitation using the form on this page.</span></div>`;
  return `
    <div class="phase3-table-wrap">
      <table class="phase3-table">
        <thead><tr><th>Recipient</th><th>Chapter</th><th>Role</th><th>Status</th><th>Expires</th><th></th></tr></thead>
        <tbody>
          ${phase3State.invitations.map((invite) => `
            <tr>
              <td><strong>${escapeHTML(invite.displayName || invite.email)}</strong><span>${escapeHTML(invite.email)}</span></td>
              <td><strong>${escapeHTML(invite.chapterName)}</strong><span>${escapeHTML(invite.chapterId)}</span></td>
              <td>${escapeHTML(roleLabel(invite.role))}</td>
              <td>${invitationStatusBadge(invite)}</td>
              <td>${escapeHTML(formatDate(invite.expiresAt))}</td>
              <td>${effectiveInviteStatus(invite) === "pending" ? `<button class="btn btn-small btn-secondary" type="button" data-phase3-action="revoke-invite" data-invite-id="${escapeHTML(invite.id)}">Revoke</button>` : ""}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function issuedCodePanel() {
  if (!phase3State.lastIssuedCode) return "";
  return `
    <div class="phase3-issued-panel">
      <div>
        <p class="phase3-kicker">Invitation created</p>
        <h3>Copy this code now.</h3>
        <p>The plaintext code is displayed once and is never stored in Firestore.</p>
      </div>
      <div class="phase3-issued-code">${escapeHTML(phase3State.lastIssuedCode)}</div>
      <div class="phase3-issued-actions">
        <button class="btn btn-primary" type="button" data-phase3-action="copy-issued-code">${icons.copy} Copy code</button>
        <button class="btn btn-secondary" type="button" data-phase3-action="copy-issued-url">${icons.copy} Copy activation link</button>
        <button class="btn btn-secondary" type="button" data-phase3-action="dismiss-issued-code">Done</button>
      </div>
    </div>`;
}

function adminInvitationsPage() {
  if (!phase3State.user) {
    queueMicrotask(() => navigate("/login"));
    return phase3PublicLayout(`<section class="phase3-card phase3-message-card"><div class="spinner"></div><h1>Opening sign in…</h1></section>`, { compact: true });
  }
  if (!phase3State.profile || !ADMIN_ROLES.has(phase3State.profile.systemRole) || phase3State.profile.accountStatus !== "active") {
    return phase3PublicLayout(`
      <section class="phase3-card phase3-message-card">
        <div class="phase3-message-icon">${icons.alert}</div>
        <h1>Administrator access required.</h1>
        <p>This page is limited to the Owner and approved Chapter Administrators.</p>
        <a class="btn btn-primary" href="#/dashboard">Return to dashboard</a>
      </section>`, { compact: true });
  }

  return phase3AdminLayout(`
    <header class="phase3-admin-heading">
      <div>
        <p class="phase3-kicker">Account invitations</p>
        <h1>Issue secure chapter access.</h1>
        <p>Create single-use account invitations for approved Chapter Directors and Chapter Advisers.</p>
      </div>
      <span class="badge badge-success">Invitation workflow active</span>
    </header>

    ${issuedCodePanel()}

    <section class="phase3-admin-grid">
      <article class="phase3-card">
        <div class="phase3-card-heading">
          <span class="phase3-step">New invitation</span>
          <h2>Assign chapter access</h2>
          <p>The chapter must already have a published record in the public registry.</p>
        </div>
        <div id="invitation-alert"></div>
        <form class="form" id="invitation-create-form" novalidate>
          <div class="field">
            <label for="invite-chapter-id">Permanent Chapter ID</label>
            <input class="input" id="invite-chapter-id" name="chapterId" type="text" maxlength="39" placeholder="TPP-CH-A1B2C3" required>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="invite-name">Leader name</label>
              <input class="input" id="invite-name" name="displayName" type="text" maxlength="80" autocomplete="off" required>
            </div>
            <div class="field">
              <label for="invite-email">Leader email</label>
              <input class="input" id="invite-email" name="email" type="email" maxlength="160" autocomplete="off" required>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="invite-role">Assigned role</label>
              <select class="input" id="invite-role" name="role" required>
                <option value="director">Chapter Director</option>
                <option value="adviser">Chapter Adviser</option>
              </select>
            </div>
            <div class="field">
              <label for="invite-expiration">Code expires after</label>
              <select class="input" id="invite-expiration" name="expirationDays" required>
                <option value="3">3 days</option>
                <option value="7" selected>7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="invite-note">Internal note <span class="phase3-optional">Optional</span></label>
            <textarea class="input phase3-textarea" id="invite-note" name="note" maxlength="500" placeholder="Reason for replacement, approval condition, or other administrative context"></textarea>
          </div>
          <button class="btn btn-primary btn-block" id="invitation-create-submit" type="submit">${icons.plus} Create invitation</button>
        </form>
      </article>

      <article class="phase3-card phase3-security-card">
        <div class="phase3-message-icon">${icons.shield}</div>
        <h2>Security model</h2>
        <p>The portal generates a high-entropy code in your browser, stores only its SHA-256 hash, and requires the invited Firebase email to match before access can be claimed.</p>
        <ul>
          <li>The code is shown only once.</li>
          <li>Invitations expire automatically.</li>
          <li>Each invitation creates one chapter membership.</li>
          <li>Email verification is required before chapter data opens.</li>
          <li>Codes can be revoked before they are claimed.</li>
        </ul>
      </article>
    </section>

    <section class="phase3-card phase3-invitation-list-card">
      <div class="phase3-list-heading">
        <div><h2>Invitation history</h2><p>Latest 100 invitations, including pending, claimed, expired, and revoked records.</p></div>
        <button class="btn btn-secondary" type="button" data-phase3-action="refresh-invitations">${icons.refresh} Refresh</button>
      </div>
      ${invitationsTable()}
    </section>`, "invitations");
}

async function loadProfile(user) {
  phase3State.profile = null;
  if (!user) return;
  try {
    const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
    if (snapshot.exists()) phase3State.profile = { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error("Phase 3 profile load failed.", error);
  }
}

async function loadInvitations({ rerender = true } = {}) {
  if (!phase3State.user || !ADMIN_ROLES.has(phase3State.profile?.systemRole)) return;
  phase3State.invitationLoading = true;
  phase3State.invitationError = null;
  if (rerender) renderPhase3();
  try {
    const snapshot = await getDocs(query(collection(db, "chapterInvitations"), orderBy("createdAt", "desc"), limit(100)));
    phase3State.invitations = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.error(error);
    phase3State.invitationError = "Firestore could not return the invitation list. Confirm that the Phase 3 rules are deployed.";
  } finally {
    phase3State.invitationLoading = false;
    if (rerender) renderPhase3();
  }
}

async function lookupInvitation(code) {
  const normalized = normalizeInviteCode(code);
  if (normalized.length !== INVITE_CODE_GROUPS * INVITE_CODE_GROUP_LENGTH) {
    throw new Error("Enter the complete activation code exactly as it was provided.");
  }
  const inviteId = await sha256Hex(normalized);
  const snapshot = await getDoc(doc(db, "chapterInvitations", inviteId));
  if (!snapshot.exists()) throw new Error("This activation code is invalid, expired, revoked, or already used.");
  const invite = { id: snapshot.id, ...snapshot.data() };
  if (effectiveInviteStatus(invite) !== "pending") throw new Error("This activation code is no longer available.");
  phase3State.selectedInvite = invite;
  phase3State.activationMode = "create";
  sessionStorage.setItem("tppActivationInviteId", invite.id);
  sessionStorage.setItem("tppActivationCode", normalized);
  return invite;
}

async function restoreInvitationFromSession() {
  const code = sessionStorage.getItem("tppActivationCode");
  if (!code || phase3State.selectedInvite) return;
  try {
    await lookupInvitation(code);
  } catch {
    sessionStorage.removeItem("tppActivationInviteId");
    sessionStorage.removeItem("tppActivationCode");
  }
}

async function claimInvitation({ user, displayName }) {
  const invite = phase3State.selectedInvite;
  if (!invite) throw new Error("The invitation is no longer loaded. Enter the activation code again.");
  if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) throw new Error("The authenticated email does not match this invitation.");

  const membershipId = `${invite.chapterId}__${user.uid}`;
  const userRef = doc(db, "systemUsers", user.uid);
  const memberRef = doc(db, "chapterMemberships", membershipId);
  const inviteRef = doc(db, "chapterInvitations", invite.id);
  const existingProfile = await getDoc(userRef);
  const existingMembership = await getDoc(memberRef);
  if (existingMembership.exists()) throw new Error("This account already has access to the assigned chapter.");

  const batch = writeBatch(db);
  batch.update(inviteRef, {
    status: "claimed",
    claimedByUid: user.uid,
    claimedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (!existingProfile.exists()) {
    batch.set(userRef, {
      displayName,
      email: normalizeEmail(user.email),
      systemRole: invite.role,
      accountStatus: "active",
      primaryChapterId: invite.chapterId,
      primaryChapterRole: invite.role,
      activationInvitationId: invite.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  batch.set(memberRef, {
    uid: user.uid,
    email: normalizeEmail(user.email),
    displayName,
    chapterId: invite.chapterId,
    chapterName: invite.chapterName,
    role: invite.role,
    status: "active",
    invitationId: invite.id,
    grantedBy: "invitation",
    grantedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  await loadProfile(user);
  sessionStorage.removeItem("tppActivationInviteId");
  sessionStorage.removeItem("tppActivationCode");
}

async function handleActivationCode(form) {
  const submit = form.querySelector("#activation-code-submit");
  submit.disabled = true;
  submit.textContent = "Checking code…";
  try {
    await lookupInvitation(form.code.value);
    renderPhase3();
  } catch (error) {
    setAlert("activation-alert", "danger", "Code not accepted", error.message || "The activation code could not be verified.");
  } finally {
    submit.disabled = false;
    submit.innerHTML = `Review invitation ${icons.arrow}`;
  }
}

async function handleCreateActivation(form) {
  const invite = phase3State.selectedInvite;
  const submit = form.querySelector("#activation-create-submit");
  const displayName = form.displayName.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (displayName.length < 2) return setAlert("activation-alert", "warning", "Name required", "Enter your full name.");
  if (password.length < 10) return setAlert("activation-alert", "warning", "Stronger password required", "Use at least 10 characters.");
  if (password !== confirmPassword) return setAlert("activation-alert", "warning", "Passwords do not match", "Enter the same password in both fields.");
  if (!form.acknowledgment.checked) return setAlert("activation-alert", "warning", "Acknowledgment required", "Confirm that this invitation was assigned to you.");

  submit.disabled = true;
  submit.textContent = "Creating account…";
  let createdUser = null;
  try {
    if (phase3State.user) await signOut(auth);
    const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(invite.email), password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName });
    await claimInvitation({ user: createdUser, displayName });
    try {
      await sendEmailVerification(createdUser, { url: `${location.origin}/#/verify-email` });
    } catch (verificationError) {
      console.warn("Account activated, but the first verification email could not be sent.", verificationError);
    }
    navigate("/verify-email");
  } catch (error) {
    console.error(error);
    const message = error?.code === "auth/email-already-in-use"
      ? "An account already exists for this email. Choose “Use an existing account” instead."
      : error?.code === "auth/weak-password"
        ? "Firebase rejected the password. Use a stronger password with at least 10 characters."
        : error?.message || "The account could not be activated.";
    setAlert("activation-alert", "danger", "Activation failed", message);
    if (createdUser && !phase3State.profile) {
      phase3State.activationMode = "existing";
    }
  } finally {
    submit.disabled = false;
    submit.textContent = "Create and activate account";
  }
}

async function handleExistingActivation(form) {
  const invite = phase3State.selectedInvite;
  const submit = form.querySelector("#activation-existing-submit");
  if (!form.acknowledgment.checked) return setAlert("activation-alert", "warning", "Acknowledgment required", "Confirm that this account and invitation belong to you.");
  submit.disabled = true;
  submit.textContent = "Connecting account…";
  try {
    if (phase3State.user) await signOut(auth);
    const credential = await signInWithEmailAndPassword(auth, normalizeEmail(invite.email), form.password.value);
    const displayName = credential.user.displayName || invite.displayName || invite.email.split("@")[0];
    await claimInvitation({ user: credential.user, displayName });
    if (!credential.user.emailVerified) {
      try {
        await sendEmailVerification(credential.user, { url: `${location.origin}/#/verify-email` });
      } catch (verificationError) {
        console.warn("Invitation claimed, but the verification email could not be sent.", verificationError);
      }
      navigate("/verify-email");
    } else {
      navigate("/activation-complete");
    }
  } catch (error) {
    console.error(error);
    const message = error?.code === "auth/invalid-credential"
      ? "The password is incorrect for the assigned email address."
      : error?.message || "The invitation could not be connected to this account.";
    setAlert("activation-alert", "danger", "Unable to connect account", message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Sign in and accept invitation";
  }
}

async function handleCreateInvitation(form) {
  const submit = form.querySelector("#invitation-create-submit");
  const chapterId = normalizeChapterId(form.chapterId.value);
  const displayName = form.displayName.value.trim();
  const email = normalizeEmail(form.email.value);
  const role = form.role.value;
  const expirationDays = Number(form.expirationDays.value);
  const note = form.note.value.trim();

  if (!CHAPTER_ID_PATTERN.test(chapterId)) return setAlert("invitation-alert", "warning", "Invalid Chapter ID", "Use TPP-CH- followed by letters and/or numbers, such as TPP-CH-A1B2C3.");
  if (displayName.length < 2 || !email.includes("@")) return setAlert("invitation-alert", "warning", "Recipient information required", "Enter the leader's name and a valid email address.");
  if (!roleLabels[role]) return setAlert("invitation-alert", "warning", "Role required", "Choose Chapter Director or Chapter Adviser.");

  submit.disabled = true;
  submit.textContent = "Creating invitation…";
  try {
    const chapterSnapshot = await getDoc(doc(db, "publicChapterRegistry", chapterId));
    if (!chapterSnapshot.exists() || chapterSnapshot.data().isPublished !== true) throw new Error("No published registry record was found for this Chapter ID.");
    const chapter = chapterSnapshot.data();
    const code = createInviteCode();
    const normalizedCode = normalizeInviteCode(code);
    const inviteId = await sha256Hex(normalizedCode);
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    const inviteRef = doc(db, "chapterInvitations", inviteId);
    const batch = writeBatch(db);

    batch.set(inviteRef, {
      activationCodeHash: inviteId,
      codeHint: normalizedCode.slice(-5),
      email,
      displayName,
      chapterId,
      chapterName: chapter.officialName,
      role,
      status: "pending",
      expiresAt,
      note,
      version: 1,
      createdByUid: phase3State.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    batch.set(doc(collection(db, "auditLogs")), {
      actorUid: phase3State.user.uid,
      action: "chapter_invitation_created",
      targetType: "chapterInvitation",
      targetId: inviteId,
      summary: `${roleLabel(role)} invitation created for ${chapterId}`,
      createdAt: serverTimestamp()
    });
    await batch.commit();

    phase3State.lastIssuedCode = code;
    phase3State.lastIssuedUrl = `${location.origin}/#/activate?code=${encodeURIComponent(code)}`;
    form.reset();
    form.expirationDays.value = "7";
    await loadInvitations({ rerender: false });
    renderPhase3();
  } catch (error) {
    console.error(error);
    setAlert("invitation-alert", "danger", "Invitation not created", error.message || "Firestore rejected the invitation.");
  } finally {
    submit.disabled = false;
    submit.innerHTML = `${icons.plus} Create invitation`;
  }
}

async function revokeInvitation(inviteId, button) {
  const invite = phase3State.invitations.find((item) => item.id === inviteId);
  if (!invite || effectiveInviteStatus(invite) !== "pending") return;
  if (!confirm(`Revoke the invitation for ${invite.displayName || invite.email}? The activation code will stop working immediately.`)) return;
  button.disabled = true;
  button.textContent = "Revoking…";
  try {
    await updateDoc(doc(db, "chapterInvitations", inviteId), {
      status: "revoked",
      revokedAt: serverTimestamp(),
      revokedByUid: phase3State.user.uid,
      updatedAt: serverTimestamp()
    });
    toast("Invitation revoked", "The activation code can no longer be used.");
    await loadInvitations();
  } catch (error) {
    console.error(error);
    toast("Unable to revoke", "Firestore rejected the invitation update.");
    button.disabled = false;
    button.textContent = "Revoke";
  }
}

async function checkEmailVerification(button) {
  if (!phase3State.user) return;
  button.disabled = true;
  button.textContent = "Checking…";
  try {
    await reload(phase3State.user);
    await getIdToken(phase3State.user, true);
    if (phase3State.user.emailVerified) {
      await loadProfile(phase3State.user);
      navigate("/activation-complete");
    } else {
      setAlert("verification-alert", "warning", "Not verified yet", "Firebase has not confirmed the email verification. Open the verification link and try again.");
    }
  } catch (error) {
    console.error(error);
    setAlert("verification-alert", "danger", "Verification check failed", "The portal could not refresh your Firebase account.");
  } finally {
    button.disabled = false;
    button.innerHTML = `${icons.refresh} I verified my email`;
  }
}

async function resendVerification(button) {
  if (!phase3State.user) return;
  button.disabled = true;
  button.textContent = "Sending…";
  try {
    await sendEmailVerification(phase3State.user, { url: `${location.origin}/#/verify-email` });
    setAlert("verification-alert", "success", "Verification email sent", "Check your inbox and spam folder for a new Firebase verification message.");
  } catch (error) {
    console.error(error);
    setAlert("verification-alert", "danger", "Unable to send email", "Firebase may be limiting repeated verification messages. Wait briefly and try again.");
  } finally {
    button.disabled = false;
    button.innerHTML = `${icons.mail} Resend verification email`;
  }
}

async function loadMembershipSummary() {
  const target = document.querySelector("#activation-membership-summary");
  if (!target || !phase3State.user?.emailVerified) return;
  try {
    const memberships = await getOwnMemberships();
    if (!memberships.length) {
      target.innerHTML = `<span>No active chapter assignment was returned. Contact Prayer Project support.</span>`;
      return;
    }
    target.innerHTML = memberships.map((membership) => `
      <div class="phase3-membership-item">
        <div><strong>${escapeHTML(membership.chapterName)}</strong><span>${escapeHTML(membership.chapterId)}</span></div>
        <span class="badge badge-success">${escapeHTML(roleLabel(membership.role))}</span>
      </div>`).join("");
  } catch (error) {
    console.error(error);
    target.innerHTML = `<span>Chapter assignment is active, but the summary could not be loaded.</span>`;
  }
}

function augmentExistingPortal() {
  if (PHASE3_ROUTES.has(routeFromHash())) return;

  const loginFooter = document.querySelector(".auth-footer");
  if (loginFooter && !document.querySelector("[data-phase3-login-link]")) {
    const wrapper = document.createElement("div");
    wrapper.className = "phase3-login-link";
    wrapper.dataset.phase3LoginLink = "true";
    wrapper.innerHTML = `<span>Have an approval code?</span><a class="text-link" href="#/activate">Activate your account</a>`;
    loginFooter.after(wrapper);
  }

  const publicActions = document.querySelector(".header-actions");
  if (publicActions && !document.querySelector("[data-phase3-public-activate]")) {
    const link = document.createElement("a");
    link.className = "phase3-header-activate";
    link.href = "#/activate";
    link.dataset.phase3PublicActivate = "true";
    link.textContent = "Activate account";
    publicActions.prepend(link);
  }

  const sidebarNav = document.querySelector(".sidebar-nav");
  if (sidebarNav && ADMIN_ROLES.has(phase3State.profile?.systemRole) && !document.querySelector("[data-phase3-admin-nav]")) {
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = "#/admin/invitations";
    link.dataset.phase3AdminNav = "true";
    link.innerHTML = `${icons.key}<span>Account invitations</span>`;
    const accountLabel = Array.from(sidebarNav.querySelectorAll(".nav-label")).find((item) => item.textContent.trim() === "Account");
    sidebarNav.insertBefore(link, accountLabel || null);
  }

  if (phase3State.user && phase3State.profile && CHAPTER_ROLES.has(phase3State.profile.systemRole) && !phase3State.user.emailVerified) {
    const route = routeFromHash();
    if (["/dashboard", "/profile"].includes(route)) navigate("/verify-email");
  }
}

function bindPhase3Events() {
  document.querySelector("#activation-code-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleActivationCode(event.currentTarget);
  });

  document.querySelector("#activation-create-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleCreateActivation(event.currentTarget);
  });

  document.querySelector("#activation-existing-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleExistingActivation(event.currentTarget);
  });

  document.querySelector("#invitation-create-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleCreateInvitation(event.currentTarget);
  });

  document.querySelectorAll("[data-phase3-action]").forEach((element) => {
    element.addEventListener("click", async () => {
      const action = element.dataset.phase3Action;
      if (action === "activation-mode") {
        phase3State.activationMode = element.dataset.mode;
        renderPhase3();
      }
      if (action === "clear-invite") {
        phase3State.selectedInvite = null;
        sessionStorage.removeItem("tppActivationInviteId");
        sessionStorage.removeItem("tppActivationCode");
        renderPhase3();
      }
      if (action === "sign-out" || action === "sign-out-for-activation") {
        await signOut(auth);
        if (action === "sign-out") navigate("/login");
        else renderPhase3();
      }
      if (action === "check-verification") await checkEmailVerification(element);
      if (action === "resend-verification") await resendVerification(element);
      if (action === "refresh-invitations") await loadInvitations();
      if (action === "revoke-invite") await revokeInvitation(element.dataset.inviteId, element);
      if (action === "copy-issued-code") {
        await copyText(phase3State.lastIssuedCode || "");
        toast("Code copied", "Send it only to the approved recipient.");
      }
      if (action === "copy-issued-url") {
        await copyText(phase3State.lastIssuedUrl || "");
        toast("Activation link copied", "The link contains the private activation code.");
      }
      if (action === "dismiss-issued-code") {
        phase3State.lastIssuedCode = null;
        phase3State.lastIssuedUrl = null;
        renderPhase3();
      }
    });
  });
}

async function renderPhase3() {
  const route = routeFromHash();
  if (!PHASE3_ROUTES.has(route) || !phase3State.authReady || phase3State.rendering) {
    augmentExistingPortal();
    return;
  }
  phase3State.rendering = true;
  try {
    if (route === "/activate" && !phase3State.selectedInvite) await restoreInvitationFromSession();
    const pages = {
      "/activate": activationPage,
      "/verify-email": verifyEmailPage,
      "/activation-complete": activationCompletePage,
      "/admin/invitations": adminInvitationsPage
    };
    app.innerHTML = pages[route]();
    bindPhase3Events();
    document.title = route === "/admin/invitations"
      ? "Account Invitations | The Prayer Project"
      : route === "/verify-email"
        ? "Verify Email | The Prayer Project"
        : route === "/activation-complete"
          ? "Account Activated | The Prayer Project"
          : "Activate Account | The Prayer Project";
    if (route === "/admin/invitations" && !phase3State.invitationLoading && !phase3State.invitations.length && !phase3State.invitationError) {
      queueMicrotask(() => loadInvitations());
    }
    if (route === "/activation-complete") queueMicrotask(loadMembershipSummary);
  } finally {
    phase3State.rendering = false;
  }
}

window.addEventListener("hashchange", () => queueMicrotask(renderPhase3));
const observer = new MutationObserver(() => {
  const route = routeFromHash();
  if (PHASE3_ROUTES.has(route) && !document.querySelector("[data-phase3-root]")) queueMicrotask(renderPhase3);
  else queueMicrotask(augmentExistingPortal);
});
observer.observe(app, { childList: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  phase3State.user = user;
  await loadProfile(user);
  phase3State.authReady = true;
  await renderPhase3();
});
