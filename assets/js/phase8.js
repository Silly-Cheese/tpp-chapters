import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");
const ADMIN_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin", "supportAgent"]);
const HEALTH_ROUTE = "/admin/system-health";
const SETTINGS_REF = doc(db, "systemSettings", "portal");
const REQUIRED_ASSETS = [
  "index.html",
  "assets/styles.css",
  "assets/phase2.css",
  "assets/phase3.css",
  "assets/phase4.css",
  "assets/phase5.css",
  "assets/phase6.css",
  "assets/phase7-1.css",
  "assets/phase7-2.css",
  "assets/phase7-3.css",
  "assets/phase7-4.css",
  "assets/phase8.css",
  "assets/js/app.js",
  "assets/js/firebase.js",
  "assets/js/phase3.js",
  "assets/js/phase4.js",
  "assets/js/phase5.js",
  "assets/js/phase6-loader.js",
  "assets/js/phase7.js",
  "assets/js/phase8.js"
];
const COLLECTION_CHECKS = [
  "publicChapterRegistry",
  "chapters",
  "systemUsers",
  "chapterMemberships",
  "chapterSubmissions",
  "supportTickets",
  "unauthorizedChapterReports",
  "auditLogs"
];

const DEFAULT_SETTINGS = Object.freeze({
  organizationName: "The Prayer Project",
  registryTitle: "Chapter Registry & Operations Portal",
  supportEmail: "pray@ask4prayers.com",
  renewalWindowDays: 60,
  bannerTone: "info",
  maintenanceMode: false,
  publicBanner: "",
  registryEnabled: true,
  activationEnabled: true,
  supportEnabled: true
});

const state = {
  authReady: false,
  user: null,
  profile: null,
  settings: { ...DEFAULT_SETTINGS },
  settingsLoaded: false,
  rendering: false,
  diagnostics: [],
  diagnosticsRunning: false,
  lastFocusedRoute: "",
  errors: []
};

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  return (path.startsWith("/") ? path : `/${path}`).replace(/\/+$/, "") || "/";
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isAdmin() {
  return state.profile?.accountStatus === "active" && ADMIN_ROLES.has(state.profile?.systemRole);
}

function roleLabel(role = "") {
  return ({
    owner: "Owner",
    chapterAdmin: "Chapter Administrator",
    complianceAdmin: "Compliance Administrator",
    supportAgent: "Support Agent"
  })[role] || "Portal User";
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not available";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", includeTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function currentFeature() {
  const route = routeFromHash();
  if (route === "/activate" || route.startsWith("/activate/")) return "activation";
  if (
    route.startsWith("/chapter/support") ||
    route.startsWith("/chapter/communications") ||
    route.startsWith("/admin/support")
  ) return "support";
  if (
    route === "/verify" || route.startsWith("/verify/") ||
    route === "/chapters" || route.startsWith("/chapters/") ||
    route === "/report-chapter"
  ) return "registry";
  return null;
}

function featureEnabled(feature) {
  if (feature === "activation") return state.settings.activationEnabled !== false;
  if (feature === "support") return state.settings.supportEnabled !== false;
  if (feature === "registry") return state.settings.registryEnabled !== false;
  return true;
}

async function loadSettings() {
  try {
    const snapshot = await getDoc(SETTINGS_REF);
    state.settings = snapshot.exists()
      ? { ...DEFAULT_SETTINGS, ...snapshot.data() }
      : { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.warn("Unable to load public portal settings; safe defaults are active.", error);
    state.settings = { ...DEFAULT_SETTINGS };
  } finally {
    state.settingsLoaded = true;
    applyPublicBanner();
  }
}

async function loadProfile(user) {
  state.profile = null;
  if (!user) return;
  try {
    const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
    if (snapshot.exists()) state.profile = { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.warn("Unable to load the current portal profile.", error);
  }
}

function brandMarkup(subtitle = "Production Portal") {
  return `<a class="p8-brand" href="#/"><img src="assets/brand-mark.svg" alt=""><span><strong>${escapeHTML(state.settings.organizationName)}</strong><small>${escapeHTML(subtitle)}</small></span></a>`;
}

function maintenancePage() {
  return `<main class="p8-gate" id="main-content" data-phase8-page>
    <section class="p8-gate-card">
      ${brandMarkup("Scheduled maintenance")}
      <div class="p8-gate-icon" aria-hidden="true">✦</div>
      <p class="p8-kicker">Temporarily unavailable</p>
      <h1>We are preparing the chapter portal.</h1>
      <p>${escapeHTML(state.settings.publicBanner || "The portal is undergoing scheduled maintenance. Please return shortly.")}</p>
      <div class="p8-gate-actions">
        <button class="btn btn-primary" type="button" data-p8-action="refresh">Check again</button>
        <a class="btn btn-secondary" href="#/login">Administrator sign in</a>
      </div>
      <small>For urgent assistance, contact ${escapeHTML(state.settings.supportEmail)}.</small>
    </section>
  </main>`;
}

function featureGatePage(feature) {
  const copy = {
    registry: ["Chapter verification is temporarily unavailable.", "The official registry has been paused by Prayer Project administration."],
    activation: ["Account activation is temporarily unavailable.", "New Director and Adviser activations have been paused by Prayer Project administration."],
    support: ["Portal support is temporarily unavailable.", "New and existing support conversations have been paused by Prayer Project administration."]
  }[feature] || ["This area is temporarily unavailable.", "Prayer Project administration has temporarily paused this feature."];
  return `<main class="p8-gate" id="main-content" data-phase8-page>
    <section class="p8-gate-card">
      ${brandMarkup("Feature notice")}
      <div class="p8-gate-icon" aria-hidden="true">!</div>
      <p class="p8-kicker">Feature paused</p>
      <h1>${escapeHTML(copy[0])}</h1>
      <p>${escapeHTML(copy[1])}</p>
      <div class="p8-gate-actions"><a class="btn btn-primary" href="#/">Return home</a><button class="btn btn-secondary" type="button" data-p8-action="refresh">Check again</button></div>
      <small>For assistance, contact ${escapeHTML(state.settings.supportEmail)}.</small>
    </section>
  </main>`;
}

function statusTone(status) {
  return status === "pass" ? "success" : status === "warning" ? "warning" : "danger";
}

function healthPage() {
  const checks = state.diagnostics.length
    ? state.diagnostics.map((item) => `<article class="p8-check p8-${statusTone(item.status)}">
        <span class="p8-check-mark" aria-hidden="true">${item.status === "pass" ? "✓" : item.status === "warning" ? "!" : "×"}</span>
        <div><strong>${escapeHTML(item.name)}</strong><p>${escapeHTML(item.detail)}</p></div>
      </article>`).join("")
    : `<div class="p8-empty"><h3>No diagnostic run yet.</h3><p>Run the production checks to inspect Firebase access, required assets, browser capabilities, and deployment configuration.</p></div>`;

  const passed = state.diagnostics.filter((item) => item.status === "pass").length;
  const warnings = state.diagnostics.filter((item) => item.status === "warning").length;
  const failed = state.diagnostics.filter((item) => item.status === "fail").length;

  return `<div class="p8-admin-shell" data-phase8-page>
    <aside class="p8-admin-sidebar">
      ${brandMarkup("System administration")}
      <nav aria-label="System health navigation">
        <a href="#/admin/dashboard">Admin dashboard</a>
        <a class="active" href="#/admin/system-health">System health</a>
        <a href="#/admin/settings">Portal settings</a>
        <a href="#/admin/audit">Audit history</a>
        <a href="#/">Public portal</a>
      </nav>
      <div class="p8-admin-user"><strong>${escapeHTML(state.profile?.displayName || state.user?.email || "Administrator")}</strong><span>${escapeHTML(roleLabel(state.profile?.systemRole))}</span></div>
    </aside>
    <main class="p8-admin-main" id="main-content">
      <header class="p8-health-header"><div><p class="p8-kicker">Phase 8 production controls</p><h1>System health</h1><p>Verify the static deployment, Firebase access, public settings, and browser environment from one place.</p></div><div class="p8-health-actions"><button class="btn btn-primary" type="button" data-p8-action="diagnostics" ${state.diagnosticsRunning ? "disabled" : ""}>${state.diagnosticsRunning ? "Running checks…" : "Run diagnostics"}</button><button class="btn btn-secondary" type="button" data-p8-action="copy-report" ${state.diagnostics.length ? "" : "disabled"}>Copy report</button></div></header>
      <section class="p8-health-summary" aria-label="Diagnostic summary">
        <article><strong>${passed}</strong><span>Passed</span></article>
        <article><strong>${warnings}</strong><span>Warnings</span></article>
        <article><strong>${failed}</strong><span>Failed</span></article>
        <article><strong>${state.diagnostics.length}</strong><span>Total checks</span></article>
      </section>
      <section class="p8-health-meta">
        <div><span>Environment</span><strong>${escapeHTML(location.hostname || "local")}</strong></div>
        <div><span>Current role</span><strong>${escapeHTML(roleLabel(state.profile?.systemRole))}</strong></div>
        <div><span>Settings updated</span><strong>${escapeHTML(formatDate(state.settings.updatedAt, true))}</strong></div>
        <div><span>Browser status</span><strong>${navigator.onLine ? "Online" : "Offline"}</strong></div>
      </section>
      <section class="p8-check-list" aria-live="polite">${checks}</section>
      <section class="p8-health-guidance"><h2>Production reminders</h2><p>Passing browser checks do not replace Firebase Security Rules deployment or multi-account permission testing. Complete the Phase 8 production checklist after every rules or authentication change.</p><div><a class="btn btn-secondary" href="#/admin/audit">Review audit history</a><a class="btn btn-secondary" href="#/admin/settings">Review settings</a></div></section>
    </main>
  </div>`;
}

function accessDeniedPage() {
  return `<main class="p8-gate" id="main-content" data-phase8-page><section class="p8-gate-card">${brandMarkup("System health")}<div class="p8-gate-icon" aria-hidden="true">×</div><p class="p8-kicker">Restricted area</p><h1>Administrative access is required.</h1><p>Sign in with an active Owner, Chapter Administrator, Compliance Administrator, or Support Agent account.</p><a class="btn btn-primary" href="#/login">Return to sign in</a></section></main>`;
}

async function runDiagnostics() {
  state.diagnosticsRunning = true;
  state.diagnostics = [];
  renderPhase8();
  const results = [];
  const add = (name, status, detail) => results.push({ name, status, detail });

  add("Network connection", navigator.onLine ? "pass" : "warning", navigator.onLine ? "The browser reports an active network connection." : "The browser is offline; live Firebase operations will fail until connectivity returns.");
  add("Secure context", window.isSecureContext ? "pass" : "warning", window.isSecureContext ? "The portal is running in a secure browser context." : "The portal is not running in a secure context. Use HTTPS in production.");
  add("Production hostname", location.hostname === "chapter.ask4prayers.com" ? "pass" : "warning", location.hostname === "chapter.ask4prayers.com" ? "The official custom domain is active." : `Current hostname is ${location.hostname || "unknown"}; confirm the production custom domain before launch.`);
  add("Firebase Authentication", state.user ? "pass" : "fail", state.user ? `Authenticated as ${state.user.email || state.user.uid}.` : "No authenticated administrator was found.");
  add("Administrator profile", isAdmin() ? "pass" : "fail", isAdmin() ? `${roleLabel(state.profile.systemRole)} profile is active.` : "The signed-in account does not have an active administrative profile.");
  add("Public portal settings", state.settingsLoaded ? "pass" : "warning", state.settingsLoaded ? "The public systemSettings/portal document was read successfully or safe defaults were applied." : "Portal settings are still loading.");
  add("Local storage", (() => { try { localStorage.setItem("tpp-p8-test", "1"); localStorage.removeItem("tpp-p8-test"); return true; } catch { return false; } })() ? "pass" : "warning", "Persistent browser storage is used for selected chapter and appearance preferences.");

  const assetChecks = await Promise.all(REQUIRED_ASSETS.map(async (asset) => {
    try {
      const response = await fetch(asset, { cache: "no-store" });
      return { asset, ok: response.ok, status: response.status };
    } catch {
      return { asset, ok: false, status: 0 };
    }
  }));
  const missingAssets = assetChecks.filter((item) => !item.ok);
  add("Production assets", missingAssets.length ? "fail" : "pass", missingAssets.length ? `Missing or inaccessible: ${missingAssets.map((item) => item.asset).join(", ")}.` : `${assetChecks.length} required HTML, CSS, and JavaScript assets are accessible.`);

  for (const collectionName of COLLECTION_CHECKS) {
    try {
      await getDocs(query(collection(db, collectionName), limit(1)));
      add(`Firestore: ${collectionName}`, "pass", "The current administrator can read this collection.");
    } catch (error) {
      add(`Firestore: ${collectionName}`, "fail", error?.message || "Firestore denied or failed this collection read.");
    }
  }

  state.diagnostics = results;
  state.diagnosticsRunning = false;
  renderPhase8();
}

function diagnosticReport() {
  const header = [
    "The Prayer Project — Phase 8 Diagnostic Report",
    `Generated: ${new Date().toISOString()}`,
    `Host: ${location.hostname}`,
    `Role: ${roleLabel(state.profile?.systemRole)}`,
    ""
  ];
  return header.concat(state.diagnostics.map((item) => `[${item.status.toUpperCase()}] ${item.name}: ${item.detail}`)).join("\n");
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(diagnosticReport());
    showToast("Diagnostic report copied.");
  } catch {
    showToast("The report could not be copied. Check browser clipboard permissions.", "warning");
  }
}

function showToast(message, tone = "success") {
  let region = document.querySelector("#phase8-toast-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "phase8-toast-region";
    region.className = "p8-toast-region";
    region.setAttribute("aria-live", "assertive");
    document.body.append(region);
  }
  const toast = document.createElement("div");
  toast.className = `p8-toast p8-${tone}`;
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => toast.remove(), 4500);
}

function applyPublicBanner() {
  const existing = document.querySelector("#phase8-public-banner");
  const text = String(state.settings.publicBanner || "").trim();
  if (!text || state.settings.maintenanceMode) {
    existing?.remove();
    return;
  }
  const banner = existing || document.createElement("aside");
  banner.id = "phase8-public-banner";
  banner.className = `p8-public-banner p8-${state.settings.bannerTone || "info"}`;
  banner.setAttribute("role", state.settings.bannerTone === "urgent" ? "alert" : "status");
  banner.innerHTML = `<span>${escapeHTML(text)}</span><button type="button" aria-label="Dismiss announcement" data-p8-action="dismiss-banner">×</button>`;
  if (!existing) document.body.insertBefore(banner, app);
  banner.querySelector("[data-p8-action='dismiss-banner']")?.addEventListener("click", () => {
    sessionStorage.setItem("tpp-phase8-banner-dismissed", text);
    banner.remove();
  });
  if (sessionStorage.getItem("tpp-phase8-banner-dismissed") === text) banner.remove();
}

function updateConnectionBanner() {
  let banner = document.querySelector("#phase8-connection-banner");
  if (navigator.onLine) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "phase8-connection-banner";
    banner.className = "p8-connection-banner";
    banner.setAttribute("role", "alert");
    banner.textContent = "You are offline. Live portal data and submissions are temporarily unavailable.";
    document.body.append(banner);
  }
}

function captureError(error, source = "runtime") {
  const id = `P8-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const message = error?.message || String(error || "Unknown error");
  state.errors.push({ id, source, message, at: new Date().toISOString(), route: routeFromHash() });
  state.errors = state.errors.slice(-10);
  try { sessionStorage.setItem("tpp-phase8-errors", JSON.stringify(state.errors)); } catch {}
  if (document.querySelector("#phase8-error-panel")) return;
  const panel = document.createElement("aside");
  panel.id = "phase8-error-panel";
  panel.className = "p8-error-panel";
  panel.setAttribute("role", "alert");
  panel.innerHTML = `<div><strong>Something did not load correctly.</strong><p>Reference ${escapeHTML(id)}. Refresh the page; if the issue continues, include this reference in a support request.</p></div><button type="button" data-p8-action="reload">Reload</button><button type="button" aria-label="Dismiss error" data-p8-action="dismiss-error">×</button>`;
  document.body.append(panel);
  panel.querySelector("[data-p8-action='reload']")?.addEventListener("click", () => location.reload());
  panel.querySelector("[data-p8-action='dismiss-error']")?.addEventListener("click", () => panel.remove());
}

function focusMainContent() {
  const route = routeFromHash();
  if (state.lastFocusedRoute === route) return;
  const main = document.querySelector("#main-content, main");
  if (!main) return;
  state.lastFocusedRoute = route;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => main.focus({ preventScroll: true }));
}

function bindPhase8Actions() {
  document.querySelectorAll('[data-p8-action="refresh"]').forEach((button) => {
    button.addEventListener("click", async () => {
      state.settingsLoaded = false;
      await loadSettings();
      renderPhase8();
    });
  });
  document.querySelectorAll('[data-p8-action="diagnostics"]').forEach((button) => button.addEventListener("click", runDiagnostics));
  document.querySelectorAll('[data-p8-action="copy-report"]').forEach((button) => button.addEventListener("click", copyReport));
}

function augmentAdminNavigation() {
  if (!isAdmin() || routeFromHash() === HEALTH_ROUTE || document.querySelector("[data-phase8-health-link]")) return;
  const selectors = [".p7-sidebar nav", ".p6-admin-nav", ".p4-admin-sidebar nav", ".phase3-admin-sidebar nav", ".p4a-nav", ".phase3-admin-nav"];
  const nav = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!nav) return;
  const link = document.createElement("a");
  link.href = `#${HEALTH_ROUTE}`;
  link.dataset.phase8HealthLink = "true";
  link.className = "p8-injected-health-link";
  link.innerHTML = `<span aria-hidden="true">✓</span><span>System health</span>`;
  nav.append(link);
}

function shouldShowMaintenance() {
  const route = routeFromHash();
  if (!state.settings.maintenanceMode || isAdmin()) return false;
  return route !== "/login" && route !== "/forgot-password";
}

function renderPhase8() {
  if (!state.authReady || !state.settingsLoaded || state.rendering) return;
  state.rendering = true;
  try {
    const route = routeFromHash();
    if (route === HEALTH_ROUTE) {
      app.innerHTML = isAdmin() ? healthPage() : accessDeniedPage();
      bindPhase8Actions();
      document.title = `System Health | ${state.settings.organizationName}`;
      focusMainContent();
      return;
    }
    if (shouldShowMaintenance()) {
      app.innerHTML = maintenancePage();
      bindPhase8Actions();
      document.title = `Maintenance | ${state.settings.organizationName}`;
      focusMainContent();
      return;
    }
    const feature = currentFeature();
    if (feature && !featureEnabled(feature) && !isAdmin()) {
      app.innerHTML = featureGatePage(feature);
      bindPhase8Actions();
      document.title = `Temporarily Unavailable | ${state.settings.organizationName}`;
      focusMainContent();
      return;
    }
    applyPublicBanner();
    augmentAdminNavigation();
    focusMainContent();
  } finally {
    state.rendering = false;
  }
}

window.addEventListener("error", (event) => captureError(event.error || event.message, "window.error"));
window.addEventListener("unhandledrejection", (event) => captureError(event.reason, "unhandledrejection"));
window.addEventListener("online", () => { updateConnectionBanner(); showToast("Connection restored."); });
window.addEventListener("offline", updateConnectionBanner);
window.addEventListener("hashchange", () => queueMicrotask(renderPhase8));

const observer = new MutationObserver(() => {
  if (!state.rendering) queueMicrotask(() => {
    augmentAdminNavigation();
    focusMainContent();
    if (shouldShowMaintenance() || (currentFeature() && !featureEnabled(currentFeature()) && !isAdmin())) renderPhase8();
  });
});
observer.observe(app, { childList: true, subtree: true });

try {
  state.errors = JSON.parse(sessionStorage.getItem("tpp-phase8-errors") || "[]");
} catch {
  state.errors = [];
}

updateConnectionBanner();
await authPersistenceReady;
await loadSettings();
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  await loadProfile(user);
  state.authReady = true;
  renderPhase8();
});
