import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");
const CHAPTER_PROFILE_ROLES = new Set(["director", "adviser", "chapterUser"]);
const CHAPTER_ROUTES = new Set([
  "/chapter",
  "/chapter/overview",
  "/chapter/compliance",
  "/chapter/leadership",
  "/chapter/documents",
  "/chapter/notices",
  "/chapter/adviser"
]);

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

const REQUIREMENT_LABELS = Object.freeze({
  complete: "Complete",
  due: "Due",
  overdue: "Overdue",
  under_review: "Under Review",
  not_required: "Not Required"
});

const state = {
  authReady: false,
  user: null,
  profile: null,
  memberships: [],
  selectedChapterId: null,
  chapter: null,
  publicChapter: null,
  requirements: [],
  leaders: [],
  documents: [],
  notices: [],
  receipts: new Map(),
  adviserCheckins: [],
  loading: false,
  error: null,
  rendering: false,
  mobileOpen: false
};

const icons = {
  home: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
  users: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0"/></svg>`,
  file: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>`,
  bell: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>`,
  adviser: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/><circle cx="12" cy="10" r="2"/><path d="M8.5 16a4 4 0 0 1 7 0"/></svg>`,
  user: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  logout: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>`,
  menu: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`,
  clock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`,
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 2 21h20z"/><path d="M12 9v5m0 3h.01"/></svg>`,
  external: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 3h7v7M10 14 21 3M21 14v7H3V3h7"/></svg>`,
  refresh: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M17.9 15A7 7 0 0 1 6 18l-2-5"/></svg>`
};

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const route = (raw.split("?")[0].startsWith("/") ? raw.split("?")[0] : `/${raw.split("?")[0]}`)
    .replace(/\/+$/, "");
  return route || "/";
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value = "") {
  return String(value).replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, fallback = "Not listed") {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date) : fallback;
}

function daysUntil(value) {
  const date = toDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function currentTheme() {
  return document.documentElement.dataset.theme || "light";
}

function applyTheme(theme) {
  const safe = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = safe;
  localStorage.setItem("tpp-theme", safe);
}

function roleLabel(role) {
  return role === "director" ? "Chapter Director" : role === "adviser" ? "Chapter Adviser" : titleCase(role || "Chapter Member");
}

function selectedMembership() {
  return state.memberships.find((item) => item.chapterId === state.selectedChapterId) || null;
}

function statusTone(status) {
  if (["active", "good_standing", "complete", "confirmed"].includes(status)) return "success";
  if (["conditional", "inactive", "action_required", "under_review", "probationary", "due", "pending"].includes(status)) return "warning";
  if (["suspended", "expired", "closed", "revoked", "not_in_good_standing", "overdue"].includes(status)) return "danger";
  return "info";
}

function requirementStatus(requirement) {
  if (["complete", "not_required", "under_review"].includes(requirement.status)) return requirement.status;
  const due = toDate(requirement.dueDate);
  if (due && due.getTime() < Date.now()) return "overdue";
  return requirement.status || "due";
}

function initials(value = "TP") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "TP").toUpperCase();
}

function brand() {
  return `<a class="p4-brand" href="#/chapter/overview"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Chapter Operations</small></span></a>`;
}

function activeRoute() {
  const route = routeFromHash();
  return route === "/dashboard" || route === "/chapter" ? "/chapter/overview" : route;
}

function shouldHandle(route) {
  if (CHAPTER_ROUTES.has(route)) return true;
  return route === "/dashboard" && CHAPTER_PROFILE_ROLES.has(state.profile?.systemRole);
}

async function loadProfile(user) {
  state.profile = null;
  if (!user) return;
  const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
  if (snapshot.exists()) state.profile = { id: snapshot.id, ...snapshot.data() };
}

async function loadMemberships() {
  state.memberships = [];
  if (!state.user?.emailVerified) return;
  const snapshot = await getDocs(query(collection(db, "chapterMemberships"), where("uid", "==", state.user.uid)));
  state.memberships = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status === "active")
    .sort((a, b) => String(a.chapterName).localeCompare(String(b.chapterName)));

  const saved = localStorage.getItem(`tpp-selected-chapter-${state.user.uid}`);
  const preferred = saved || state.profile?.primaryChapterId;
  state.selectedChapterId = state.memberships.some((item) => item.chapterId === preferred)
    ? preferred
    : state.memberships[0]?.chapterId || null;

  await Promise.all(state.memberships.map(ensureOwnLeaderRecord));
}

async function ensureOwnLeaderRecord(membership) {
  const ref = doc(db, "chapters", membership.chapterId, "leaders", state.user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;
  try {
    await setDoc(ref, {
      uid: state.user.uid,
      chapterId: membership.chapterId,
      displayName: membership.displayName || state.profile?.displayName || state.user.email,
      email: membership.email || state.user.email,
      role: membership.role,
      status: "active",
      agreementStatus: "pending",
      trainingStatus: "pending",
      startDate: membership.grantedAt || serverTimestamp(),
      visibleToChapter: true,
      source: "self_activation",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Unable to create the user's chapter leader record.", error);
  }
}

async function loadChapterWorkspace(chapterId, { rerender = true } = {}) {
  if (!chapterId) return;
  state.loading = true;
  state.error = null;
  if (rerender) renderPhase4();
  try {
    const chapterRef = doc(db, "chapters", chapterId);
    const [chapterSnapshot, publicSnapshot, requirementsSnapshot, leadersSnapshot, documentsSnapshot, noticesSnapshot] = await Promise.all([
      getDoc(chapterRef),
      getDoc(doc(db, "publicChapterRegistry", chapterId)),
      getDocs(collection(chapterRef, "requirements")),
      getDocs(collection(chapterRef, "leaders")),
      getDocs(collection(chapterRef, "documents")),
      getDocs(collection(chapterRef, "notices"))
    ]);

    state.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;
    state.publicChapter = publicSnapshot.exists() ? { id: publicSnapshot.id, ...publicSnapshot.data() } : null;
    state.requirements = requirementsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || String(a.title).localeCompare(String(b.title)));
    state.leaders = leadersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.visibleToChapter !== false && item.status !== "removed")
      .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.displayName).localeCompare(String(b.displayName)));
    state.documents = documentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status !== "archived")
      .sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
    state.notices = noticesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.active !== false && (!toDate(item.expiresAt) || toDate(item.expiresAt).getTime() > Date.now()))
      .sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));

    state.receipts = new Map();
    await Promise.all(state.notices.map(async (notice) => {
      const receiptId = `${notice.id}__${state.user.uid}`;
      const receipt = await getDoc(doc(chapterRef, "noticeReceipts", receiptId));
      if (receipt.exists()) state.receipts.set(notice.id, receipt.data());
    }));

    if (selectedMembership()?.role === "adviser") {
      const checkins = await getDocs(query(collection(chapterRef, "adviserCheckins"), where("createdByUid", "==", state.user.uid)));
      state.adviserCheckins = checkins.docs.map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    } else {
      state.adviserCheckins = [];
    }
  } catch (error) {
    console.error("Unable to load chapter workspace.", error);
    state.error = error;
  } finally {
    state.loading = false;
    if (rerender) renderPhase4();
  }
}

function portalData() {
  const publicRecord = state.publicChapter || {};
  const privateRecord = state.chapter || {};
  return {
    chapterId: state.selectedChapterId,
    officialName: privateRecord.officialName || publicRecord.officialName || selectedMembership()?.chapterName || "Prayer Project Chapter",
    hostInstitutionName: privateRecord.hostInstitutionName || publicRecord.hostInstitutionName || "Not listed",
    institutionType: privateRecord.institutionType || publicRecord.institutionType || "organization",
    city: privateRecord.city || publicRecord.city || "",
    state: privateRecord.state || publicRecord.state || "",
    country: privateRecord.country || publicRecord.country || "",
    serviceArea: privateRecord.serviceArea || publicRecord.serviceArea || "Not listed",
    authorizationStatus: privateRecord.authorizationStatus || publicRecord.authorizationStatus || "under_review",
    standing: privateRecord.standing || publicRecord.standing || "under_review",
    approvalDate: privateRecord.approvalDate || publicRecord.approvalDate,
    effectiveDate: privateRecord.effectiveDate || publicRecord.effectiveDate,
    renewalDate: privateRecord.renewalDate || publicRecord.renewalDate,
    lastReviewDate: privateRecord.lastReviewDate || publicRecord.lastVerifiedAt,
    portalSummary: privateRecord.portalSummary || publicRecord.summary || "This chapter workspace contains the official operational information available to approved chapter leadership.",
    meetingSchedule: privateRecord.meetingSchedule || "Not listed",
    primaryContactEmail: privateRecord.primaryContactEmail || "Not listed",
    institutionalApprovalStatus: privateRecord.institutionalApprovalStatus || "pending",
    adviserConfirmationStatus: privateRecord.adviserConfirmationStatus || "pending",
    adviserConfirmationDueDate: privateRecord.adviserConfirmationDueDate || null
  };
}

function loadingPage() {
  return `<main class="p4-loading" id="main-content"><img src="assets/brand-mark.svg" alt=""><div class="spinner"></div><strong>Loading your chapter workspace…</strong></main>`;
}

function noAccessPage(message = "No active chapter assignment was found for this account.") {
  return `<main class="p4-gate" id="main-content"><section class="p4-gate-card"><img src="assets/brand-mark.svg" alt=""><p class="p4-kicker">Chapter access</p><h1>Workspace unavailable.</h1><p>${escapeHTML(message)}</p><div class="p4-actions"><a class="btn btn-primary" href="#/activate">Activate an account</a><button class="btn btn-secondary" type="button" data-p4-action="sign-out">Sign out</button></div></section></main>`;
}

function chapterSelector() {
  if (state.memberships.length < 2) return `<div class="p4-chapter-static"><strong>${escapeHTML(portalData().officialName)}</strong><span>${escapeHTML(state.selectedChapterId || "")}</span></div>`;
  return `<label class="p4-chapter-select"><span>Current chapter</span><select id="p4-chapter-selector">${state.memberships.map((item) => `<option value="${escapeHTML(item.chapterId)}" ${item.chapterId === state.selectedChapterId ? "selected" : ""}>${escapeHTML(item.chapterName)} · ${escapeHTML(item.chapterId)}</option>`).join("")}</select></label>`;
}

function themeButton() {
  const dark = currentTheme() === "dark";
  return `<button class="p4-icon-button" type="button" data-p4-action="theme" aria-label="Use ${dark ? "light" : "dark"} theme">${dark ? icons.sun : icons.moon}</button>`;
}

function chapterLayout(content, active = "/chapter/overview", title = "Chapter Portal") {
  const membership = selectedMembership();
  const userName = state.profile?.displayName || state.user?.displayName || state.user?.email || "Chapter Leader";
  const adviserLink = membership?.role === "adviser"
    ? `<a class="p4-nav-link ${active === "/chapter/adviser" ? "active" : ""}" href="#/chapter/adviser">${icons.adviser}<span>Adviser oversight</span></a>`
    : "";
  return `
    <div class="p4-shell" data-phase4-root>
      <aside class="p4-sidebar ${state.mobileOpen ? "open" : ""}" id="p4-sidebar">
        <div class="p4-sidebar-brand">${brand()}</div>
        <div class="p4-sidebar-chapter">${chapterSelector()}</div>
        <nav class="p4-nav" aria-label="Chapter workspace navigation">
          <span class="p4-nav-label">Chapter workspace</span>
          <a class="p4-nav-link ${active === "/chapter/overview" ? "active" : ""}" href="#/chapter/overview">${icons.home}<span>Overview</span></a>
          <a class="p4-nav-link ${active === "/chapter/compliance" ? "active" : ""}" href="#/chapter/compliance">${icons.shield}<span>Standing & compliance</span></a>
          <a class="p4-nav-link ${active === "/chapter/leadership" ? "active" : ""}" href="#/chapter/leadership">${icons.users}<span>Leadership</span></a>
          <a class="p4-nav-link ${active === "/chapter/documents" ? "active" : ""}" href="#/chapter/documents">${icons.file}<span>Documents</span></a>
          <a class="p4-nav-link ${active === "/chapter/notices" ? "active" : ""}" href="#/chapter/notices">${icons.bell}<span>Notices</span>${unacknowledgedCount() ? `<em>${unacknowledgedCount()}</em>` : ""}</a>
          ${adviserLink}
          <span class="p4-nav-label">Account</span>
          <a class="p4-nav-link" href="#/profile">${icons.user}<span>My profile</span></a>
          <a class="p4-nav-link" href="#/verify/${encodeURIComponent(state.selectedChapterId || "")}">${icons.external}<span>Public verification</span></a>
          <button class="p4-nav-link" type="button" data-p4-action="sign-out">${icons.logout}<span>Sign out</span></button>
        </nav>
        <div class="p4-sidebar-user"><div>${escapeHTML(initials(userName))}</div><span><strong>${escapeHTML(userName)}</strong><small>${escapeHTML(roleLabel(membership?.role))}</small></span></div>
      </aside>
      <div class="p4-main">
        <header class="p4-topbar"><button class="p4-icon-button p4-menu" type="button" data-p4-action="mobile">${icons.menu}</button><div><span>Chapter Operations</span><strong>${escapeHTML(title)}</strong></div><div class="p4-topbar-actions">${themeButton()}<span class="p4-role-badge">${escapeHTML(roleLabel(membership?.role))}</span></div></header>
        <main class="p4-content" id="main-content">${content}</main>
      </div>
      <div class="toast-region" id="p4-toast-region" aria-live="assertive"></div>
    </div>`;
}

function badge(value, label = null) {
  return `<span class="p4-badge p4-${statusTone(value)}">${escapeHTML(label || titleCase(value || "Unknown"))}</span>`;
}

function pageHeading(kicker, title, description, action = "") {
  return `<header class="p4-page-heading"><div><p class="p4-kicker">${escapeHTML(kicker)}</p><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>${action}</header>`;
}

function unacknowledgedCount() {
  return state.notices.filter((notice) => notice.requireAcknowledgment && !state.receipts.has(notice.id)).length;
}

function requirementMetrics() {
  const normalized = state.requirements.map((item) => requirementStatus(item));
  return {
    complete: normalized.filter((item) => item === "complete" || item === "not_required").length,
    total: normalized.length,
    due: normalized.filter((item) => item === "due").length,
    overdue: normalized.filter((item) => item === "overdue").length,
    review: normalized.filter((item) => item === "under_review").length
  };
}

function workspaceMissing() {
  const data = portalData();
  return `<section class="p4-card p4-missing"><div>${icons.alert}</div><div><h2>Private chapter workspace not initialized</h2><p>Your account and public verification record are active, but an administrator has not initialized the private operational record yet. The public chapter details are shown where available.</p><dl><div><dt>Chapter</dt><dd>${escapeHTML(data.officialName)}</dd></div><div><dt>Chapter ID</dt><dd>${escapeHTML(data.chapterId)}</dd></div></dl></div></section>`;
}

function overviewPage() {
  const data = portalData();
  const metrics = requirementMetrics();
  const renewalDays = daysUntil(data.renewalDate);
  const progress = metrics.total ? Math.round((metrics.complete / metrics.total) * 100) : 0;
  const recentNotices = state.notices.slice(0, 3);
  return chapterLayout(`
    ${pageHeading("Chapter overview", data.officialName, data.portalSummary, badge(data.authorizationStatus, AUTHORIZATION_LABELS[data.authorizationStatus]))}
    ${!state.chapter ? workspaceMissing() : ""}
    <section class="p4-metric-grid">
      <article><span>Authorization</span><strong>${escapeHTML(AUTHORIZATION_LABELS[data.authorizationStatus] || titleCase(data.authorizationStatus))}</strong>${badge(data.authorizationStatus)}</article>
      <article><span>Standing</span><strong>${escapeHTML(STANDING_LABELS[data.standing] || titleCase(data.standing))}</strong>${badge(data.standing)}</article>
      <article><span>Compliance</span><strong>${progress}% complete</strong><small>${metrics.complete} of ${metrics.total || 0} requirements satisfied</small></article>
      <article><span>Renewal</span><strong>${renewalDays == null ? "Not scheduled" : renewalDays < 0 ? `${Math.abs(renewalDays)} days overdue` : `${renewalDays} days`}</strong><small>${escapeHTML(formatDate(data.renewalDate))}</small></article>
    </section>

    <section class="p4-grid p4-grid-2">
      <article class="p4-card">
        <div class="p4-card-head"><div><p class="p4-kicker">Official record</p><h2>Chapter information</h2></div>${icons.shield}</div>
        <dl class="p4-detail-list">
          <div><dt>Permanent Chapter ID</dt><dd>${escapeHTML(data.chapterId)}</dd></div>
          <div><dt>Host institution</dt><dd>${escapeHTML(data.hostInstitutionName)}</dd></div>
          <div><dt>Service area</dt><dd>${escapeHTML(data.serviceArea)}</dd></div>
          <div><dt>Location</dt><dd>${escapeHTML([data.city, data.state, data.country].filter(Boolean).join(", ") || "Not listed")}</dd></div>
          <div><dt>Approved</dt><dd>${escapeHTML(formatDate(data.approvalDate))}</dd></div>
          <div><dt>Last compliance review</dt><dd>${escapeHTML(formatDate(data.lastReviewDate))}</dd></div>
          <div><dt>Meeting schedule</dt><dd>${escapeHTML(data.meetingSchedule)}</dd></div>
        </dl>
      </article>
      <article class="p4-card">
        <div class="p4-card-head"><div><p class="p4-kicker">Next actions</p><h2>Compliance snapshot</h2></div>${icons.clock}</div>
        <div class="p4-progress"><div><span style="width:${progress}%"></span></div><strong>${progress}%</strong></div>
        <div class="p4-action-stats"><div><strong>${metrics.due}</strong><span>Due</span></div><div><strong>${metrics.overdue}</strong><span>Overdue</span></div><div><strong>${metrics.review}</strong><span>Under review</span></div></div>
        <a class="p4-inline-link" href="#/chapter/compliance">Review all requirements ${icons.external}</a>
      </article>
    </section>

    <section class="p4-grid p4-grid-2">
      <article class="p4-card">
        <div class="p4-card-head"><div><p class="p4-kicker">Recent communication</p><h2>Latest notices</h2></div>${icons.bell}</div>
        ${recentNotices.length ? `<div class="p4-mini-list">${recentNotices.map(noticeMini).join("")}</div><a class="p4-inline-link" href="#/chapter/notices">View all notices</a>` : `<div class="p4-empty"><strong>No current notices</strong><span>New organization-wide and chapter-specific notices will appear here.</span></div>`}
      </article>
      <article class="p4-card">
        <div class="p4-card-head"><div><p class="p4-kicker">Leadership access</p><h2>Approved leaders</h2></div>${icons.users}</div>
        ${state.leaders.length ? `<div class="p4-leader-preview">${state.leaders.slice(0, 4).map((leader) => `<div><span>${escapeHTML(initials(leader.displayName))}</span><p><strong>${escapeHTML(leader.displayName)}</strong><small>${escapeHTML(roleLabel(leader.role))}</small></p></div>`).join("")}</div><a class="p4-inline-link" href="#/chapter/leadership">View leadership roster</a>` : `<div class="p4-empty"><strong>No leadership roster published</strong><span>Activated leaders will appear as their records are confirmed.</span></div>`}
      </article>
    </section>`, "/chapter/overview", "Overview");
}

function noticeMini(notice) {
  const acknowledged = state.receipts.has(notice.id);
  return `<div><span class="p4-priority p4-priority-${escapeHTML(notice.priority || "normal")}"></span><p><strong>${escapeHTML(notice.title)}</strong><small>${escapeHTML(formatDate(notice.publishedAt))}${notice.requireAcknowledgment ? acknowledged ? " · Acknowledged" : " · Acknowledgment required" : ""}</small></p></div>`;
}

function compliancePage() {
  const data = portalData();
  const metrics = requirementMetrics();
  return chapterLayout(`
    ${pageHeading("Standing & compliance", "Know exactly where your chapter stands.", "This page separates official authorization from ongoing compliance and shows every requirement currently visible to chapter leadership.", badge(data.standing, STANDING_LABELS[data.standing]))}
    <section class="p4-status-banner p4-${statusTone(data.standing)}"><div>${icons.shield}</div><div><span>Current chapter standing</span><h2>${escapeHTML(STANDING_LABELS[data.standing] || titleCase(data.standing))}</h2><p>${escapeHTML(state.chapter?.standingMessage || "The status shown here is the current internal standing recorded by The Prayer Project.")}</p></div></section>
    <section class="p4-metric-grid p4-metric-compact"><article><span>Complete</span><strong>${metrics.complete}</strong></article><article><span>Due</span><strong>${metrics.due}</strong></article><article><span>Overdue</span><strong>${metrics.overdue}</strong></article><article><span>Under review</span><strong>${metrics.review}</strong></article></section>
    <section class="p4-card">
      <div class="p4-card-head"><div><p class="p4-kicker">Compliance checklist</p><h2>Current requirements</h2></div><span>${state.requirements.length} items</span></div>
      ${state.requirements.length ? `<div class="p4-requirement-list">${state.requirements.map(requirementCard).join("")}</div>` : `<div class="p4-empty"><strong>No requirements have been published.</strong><span>An administrator can initialize the standard checklist from the Chapter Workspace Setup page.</span></div>`}
    </section>
    <section class="p4-grid p4-grid-2">
      <article class="p4-card"><div class="p4-card-head"><div><p class="p4-kicker">Authorization</p><h2>Approval record</h2></div>${badge(data.authorizationStatus)}</div><dl class="p4-detail-list"><div><dt>Authorization status</dt><dd>${escapeHTML(AUTHORIZATION_LABELS[data.authorizationStatus] || titleCase(data.authorizationStatus))}</dd></div><div><dt>Effective date</dt><dd>${escapeHTML(formatDate(data.effectiveDate))}</dd></div><div><dt>Renewal date</dt><dd>${escapeHTML(formatDate(data.renewalDate))}</dd></div></dl></article>
      <article class="p4-card"><div class="p4-card-head"><div><p class="p4-kicker">Institutional oversight</p><h2>Host approval</h2></div>${badge(data.institutionalApprovalStatus)}</div><dl class="p4-detail-list"><div><dt>Host institution</dt><dd>${escapeHTML(data.hostInstitutionName)}</dd></div><div><dt>Approval status</dt><dd>${escapeHTML(titleCase(data.institutionalApprovalStatus))}</dd></div><div><dt>Adviser confirmation</dt><dd>${escapeHTML(titleCase(data.adviserConfirmationStatus))}</dd></div></dl></article>
    </section>`, "/chapter/compliance", "Standing & Compliance");
}

function requirementCard(item) {
  const status = requirementStatus(item);
  const due = daysUntil(item.dueDate);
  return `<article class="p4-requirement"><div class="p4-requirement-icon p4-${statusTone(status)}">${status === "complete" ? icons.check : status === "overdue" ? icons.alert : icons.clock}</div><div><div class="p4-requirement-title"><h3>${escapeHTML(item.title)}</h3>${badge(status, REQUIREMENT_LABELS[status])}</div><p>${escapeHTML(item.description || "No additional instructions were provided.")}</p><div class="p4-requirement-meta"><span>${escapeHTML(titleCase(item.category || "General"))}</span><span>${item.dueDate ? `Due ${escapeHTML(formatDate(item.dueDate))}${due != null ? due < 0 ? ` · ${Math.abs(due)} days overdue` : ` · ${due} days remaining` : ""}` : "No due date"}</span></div></div></article>`;
}

function leadershipPage() {
  return chapterLayout(`
    ${pageHeading("Leadership", "Approved chapter leadership", "This roster reflects the leaders and oversight roles currently recognized in the private chapter record.")}
    <section class="p4-card">
      <div class="p4-card-head"><div><p class="p4-kicker">Official roster</p><h2>${state.leaders.length} active leader${state.leaders.length === 1 ? "" : "s"}</h2></div>${icons.users}</div>
      ${state.leaders.length ? `<div class="p4-leader-grid">${state.leaders.map(leaderCard).join("")}</div>` : `<div class="p4-empty"><strong>No leaders have been published.</strong><span>Each activated Director or Adviser can create their own initial roster record. Administrators can also synchronize all active memberships.</span></div>`}
    </section>
    <section class="p4-card p4-info-callout"><div>${icons.shield}</div><div><h2>Roster changes require review</h2><p>Chapter leaders cannot directly appoint, remove, or change official roles from this page. Formal leadership-change requests will be introduced with the operational submission workflows in Phase 5.</p></div></section>`, "/chapter/leadership", "Leadership");
}

function leaderCard(leader) {
  return `<article class="p4-leader-card"><div class="p4-avatar">${escapeHTML(initials(leader.displayName))}</div><div class="p4-leader-title"><h3>${escapeHTML(leader.displayName)}</h3><p>${escapeHTML(roleLabel(leader.role))}</p></div><dl><div><dt>Status</dt><dd>${badge(leader.status || "active")}</dd></div><div><dt>Agreement</dt><dd>${badge(leader.agreementStatus || "pending")}</dd></div><div><dt>Training</dt><dd>${badge(leader.trainingStatus || "pending")}</dd></div><div><dt>Start date</dt><dd>${escapeHTML(formatDate(leader.startDate))}</dd></div></dl></article>`;
}

function documentsPage() {
  const groups = new Map();
  state.documents.forEach((item) => {
    const key = item.category || "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return chapterLayout(`
    ${pageHeading("Document library", "Official chapter documents", "Download approval records, policies, forms, and current chapter materials published by Prayer Project administration.")}
    ${state.documents.length ? Array.from(groups.entries()).map(([category, documents]) => `<section class="p4-card p4-document-section"><div class="p4-card-head"><div><p class="p4-kicker">${escapeHTML(titleCase(category))}</p><h2>${documents.length} document${documents.length === 1 ? "" : "s"}</h2></div>${icons.file}</div><div class="p4-document-list">${documents.map(documentCard).join("")}</div></section>`).join("") : `<section class="p4-card"><div class="p4-empty"><strong>No documents are available yet.</strong><span>Administrators can publish official links through Chapter Workspace Setup. Secure file uploads will be expanded in Phase 5.</span></div></section>`}`, "/chapter/documents", "Documents");
}

function documentCard(item) {
  const safeUrl = /^https:\/\//i.test(item.url || "") ? item.url : "";
  return `<article class="p4-document"><div class="p4-document-icon">${icons.file}</div><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description || "Official chapter document")}</p><span>Version ${escapeHTML(item.version || "Current")} · Published ${escapeHTML(formatDate(item.publishedAt))}</span></div>${safeUrl ? `<a class="btn btn-secondary" href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer">Open ${icons.external}</a>` : `<span class="p4-badge p4-warning">Link unavailable</span>`}</article>`;
}

function noticesPage() {
  return chapterLayout(`
    ${pageHeading("Notices", "Chapter communications", "Official notices, policy updates, reminders, and action items published for your chapter.", unacknowledgedCount() ? badge("action_required", `${unacknowledgedCount()} acknowledgment${unacknowledgedCount() === 1 ? "" : "s"} required`) : badge("complete", "Up to date"))}
    <section class="p4-notice-list">${state.notices.length ? state.notices.map(noticeCard).join("") : `<div class="p4-card p4-empty"><strong>No active notices.</strong><span>Your chapter is currently caught up on published communications.</span></div>`}</section>`, "/chapter/notices", "Notices");
}

function noticeCard(notice) {
  const acknowledged = state.receipts.has(notice.id);
  return `<article class="p4-card p4-notice p4-notice-${escapeHTML(notice.priority || "normal")}"><div class="p4-notice-mark">${icons.bell}</div><div><div class="p4-notice-heading"><span>${escapeHTML(titleCase(notice.priority || "normal"))} notice</span><time>${escapeHTML(formatDate(notice.publishedAt))}</time></div><h2>${escapeHTML(notice.title)}</h2><p>${escapeHTML(notice.body || "")}</p>${notice.requireAcknowledgment ? acknowledged ? `<div class="p4-acknowledged">${icons.check}<span>Acknowledged ${escapeHTML(formatDate(state.receipts.get(notice.id)?.acknowledgedAt))}</span></div>` : `<button class="btn btn-primary" type="button" data-p4-action="acknowledge" data-notice-id="${escapeHTML(notice.id)}">Acknowledge notice</button>` : ""}</div></article>`;
}

function adviserPage() {
  const membership = selectedMembership();
  if (membership?.role !== "adviser") {
    return chapterLayout(`<section class="p4-card p4-empty"><strong>Adviser access required.</strong><span>This area is restricted to the approved Chapter Adviser for the selected chapter.</span></section>`, "", "Access Restricted");
  }
  const data = portalData();
  return chapterLayout(`
    ${pageHeading("Adviser oversight", "Institutional and adult oversight", "Review the chapter's oversight status and submit a confidential adviser check-in directly to authorized Prayer Project administrators.", badge(data.adviserConfirmationStatus))}
    <section class="p4-grid p4-grid-3">
      <article class="p4-card p4-oversight"><span>Institutional approval</span><strong>${escapeHTML(titleCase(data.institutionalApprovalStatus))}</strong>${badge(data.institutionalApprovalStatus)}</article>
      <article class="p4-card p4-oversight"><span>Annual adviser confirmation</span><strong>${escapeHTML(titleCase(data.adviserConfirmationStatus))}</strong>${badge(data.adviserConfirmationStatus)}</article>
      <article class="p4-card p4-oversight"><span>Confirmation due</span><strong>${escapeHTML(formatDate(data.adviserConfirmationDueDate))}</strong><small>${daysUntil(data.adviserConfirmationDueDate) == null ? "No date on file" : `${daysUntil(data.adviserConfirmationDueDate)} days remaining`}</small></article>
    </section>
    <section class="p4-grid p4-grid-2">
      <article class="p4-card">
        <div class="p4-card-head"><div><p class="p4-kicker">Private submission</p><h2>Submit an adviser check-in</h2></div>${icons.adviser}</div>
        <div id="p4-adviser-alert"></div>
        <form class="p4-form" id="p4-adviser-form" novalidate>
          <label><span>Check-in type</span><select name="category" required><option value="routine_checkin">Routine check-in</option><option value="institutional_change">Institutional change</option><option value="leadership_concern">Leadership concern</option><option value="privacy_concern">Privacy concern</option><option value="safety_concern">Safety concern</option></select></label>
          <label><span>Subject</span><input type="text" name="subject" maxlength="140" required></label>
          <label><span>Details</span><textarea name="details" rows="7" maxlength="3000" required></textarea></label>
          <label class="p4-checkbox"><input type="checkbox" name="confidential" required><span>I understand this submission is confidential and will be visible only to authorized Prayer Project administrators and me.</span></label>
          <button class="btn btn-primary" id="p4-adviser-submit" type="submit">Submit check-in</button>
        </form>
      </article>
      <article class="p4-card">
        <div class="p4-card-head"><div><p class="p4-kicker">Submission history</p><h2>Your adviser check-ins</h2></div><span>${state.adviserCheckins.length}</span></div>
        ${state.adviserCheckins.length ? `<div class="p4-checkin-list">${state.adviserCheckins.map((item) => `<article><div><strong>${escapeHTML(item.subject)}</strong><span>${escapeHTML(titleCase(item.category))} · ${escapeHTML(formatDate(item.createdAt))}</span></div>${badge(item.status || "submitted")}</article>`).join("")}</div>` : `<div class="p4-empty"><strong>No adviser check-ins submitted.</strong><span>Routine confirmations and confidential concerns will appear here after submission.</span></div>`}
      </article>
    </section>
    <section class="p4-card p4-warning-callout"><div>${icons.alert}</div><div><h2>Emergencies require immediate action</h2><p>This portal is not an emergency service. Contact local emergency services and responsible institutional leadership when someone is in immediate danger, then document the concern through the appropriate Prayer Project process.</p></div></section>`, "/chapter/adviser", "Adviser Oversight");
}

function errorPage() {
  return chapterLayout(`<section class="p4-card p4-empty"><div class="p4-large-icon">${icons.alert}</div><strong>Unable to load the chapter workspace.</strong><span>${escapeHTML(state.error?.message || "Firestore denied or could not complete the request.")}</span><button class="btn btn-primary" type="button" data-p4-action="retry">Try again</button></section>`, "", "Workspace Error");
}

function renderPage(route) {
  const normalized = route === "/dashboard" || route === "/chapter" ? "/chapter/overview" : route;
  const pages = {
    "/chapter/overview": overviewPage,
    "/chapter/compliance": compliancePage,
    "/chapter/leadership": leadershipPage,
    "/chapter/documents": documentsPage,
    "/chapter/notices": noticesPage,
    "/chapter/adviser": adviserPage
  };
  return (pages[normalized] || overviewPage)();
}

function renderPhase4() {
  const route = routeFromHash();
  if (!shouldHandle(route) || !state.authReady || state.rendering) {
    augmentBasePortal();
    return;
  }
  state.rendering = true;
  try {
    if (!state.user) {
      location.hash = "/login";
      return;
    }
    if (!state.user.emailVerified && CHAPTER_PROFILE_ROLES.has(state.profile?.systemRole)) {
      location.hash = "/verify-email";
      return;
    }
    if (!state.profile || state.profile.accountStatus !== "active") {
      app.innerHTML = noAccessPage("Your portal account is not currently active.");
    } else if (!state.memberships.length) {
      app.innerHTML = noAccessPage();
    } else if (state.loading) {
      app.innerHTML = loadingPage();
    } else if (state.error) {
      app.innerHTML = errorPage();
    } else {
      app.innerHTML = renderPage(route);
    }
    bindEvents();
    document.title = `${route === "/chapter/adviser" ? "Adviser Oversight" : route === "/chapter/compliance" ? "Standing & Compliance" : route === "/chapter/leadership" ? "Leadership" : route === "/chapter/documents" ? "Documents" : route === "/chapter/notices" ? "Notices" : "Chapter Overview"} | The Prayer Project`;
  } finally {
    state.rendering = false;
  }
}

function setInlineAlert(targetId, type, title, message) {
  const target = document.querySelector(`#${targetId}`);
  if (target) target.innerHTML = `<div class="alert alert-${type}">${type === "success" ? icons.check : icons.alert}<div><strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span></div></div>`;
}

function toast(title, message) {
  const region = document.querySelector("#p4-toast-region") || document.querySelector("#toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `${icons.check}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

async function acknowledgeNotice(noticeId, button) {
  const notice = state.notices.find((item) => item.id === noticeId);
  if (!notice || !notice.requireAcknowledgment) return;
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const receiptId = `${noticeId}__${state.user.uid}`;
    await setDoc(doc(db, "chapters", state.selectedChapterId, "noticeReceipts", receiptId), {
      noticeId,
      chapterId: state.selectedChapterId,
      uid: state.user.uid,
      acknowledgedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    state.receipts.set(noticeId, { noticeId, uid: state.user.uid, acknowledgedAt: new Date() });
    toast("Notice acknowledged", "Your acknowledgment has been recorded.");
    renderPhase4();
  } catch (error) {
    console.error(error);
    button.disabled = false;
    button.textContent = "Acknowledge notice";
    toast("Unable to save", "Firestore rejected the acknowledgment.");
  }
}

async function submitAdviserCheckin(form) {
  const submit = form.querySelector("#p4-adviser-submit");
  const subject = form.subject.value.trim();
  const details = form.details.value.trim();
  if (subject.length < 4 || details.length < 20) {
    setInlineAlert("p4-adviser-alert", "warning", "More detail required", "Enter a clear subject and at least 20 characters of detail.");
    return;
  }
  if (!form.confidential.checked) {
    setInlineAlert("p4-adviser-alert", "warning", "Acknowledgment required", "Confirm that you understand the confidential visibility of this submission.");
    return;
  }
  submit.disabled = true;
  submit.textContent = "Submitting…";
  try {
    await addDoc(collection(db, "chapters", state.selectedChapterId, "adviserCheckins"), {
      chapterId: state.selectedChapterId,
      createdByUid: state.user.uid,
      adviserName: state.profile?.displayName || state.user.email,
      category: form.category.value,
      subject,
      details,
      status: "submitted",
      confidential: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    form.reset();
    setInlineAlert("p4-adviser-alert", "success", "Check-in submitted", "Authorized Prayer Project administrators can now review this confidential record.");
    await loadChapterWorkspace(state.selectedChapterId, { rerender: false });
    renderPhase4();
  } catch (error) {
    console.error(error);
    setInlineAlert("p4-adviser-alert", "danger", "Submission failed", "Firestore denied or could not save the adviser check-in.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Submit check-in";
  }
}

function bindEvents() {
  document.querySelector("#p4-chapter-selector")?.addEventListener("change", async (event) => {
    state.selectedChapterId = event.target.value;
    localStorage.setItem(`tpp-selected-chapter-${state.user.uid}`, state.selectedChapterId);
    await loadChapterWorkspace(state.selectedChapterId);
  });
  document.querySelectorAll('[data-p4-action="sign-out"]').forEach((button) => button.addEventListener("click", async () => {
    await signOut(auth);
    location.hash = "/login";
  }));
  document.querySelectorAll('[data-p4-action="theme"]').forEach((button) => button.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
    renderPhase4();
  }));
  document.querySelectorAll('[data-p4-action="mobile"]').forEach((button) => button.addEventListener("click", () => {
    document.querySelector("#p4-sidebar")?.classList.toggle("open");
  }));
  document.querySelectorAll('[data-p4-action="acknowledge"]').forEach((button) => button.addEventListener("click", () => acknowledgeNotice(button.dataset.noticeId, button)));
  document.querySelectorAll('[data-p4-action="retry"]').forEach((button) => button.addEventListener("click", () => loadChapterWorkspace(state.selectedChapterId)));
  document.querySelector("#p4-adviser-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAdviserCheckin(event.currentTarget);
  });
}

function augmentBasePortal() {
  if (!state.authReady || !state.profile) return;
  const sidebar = document.querySelector(".sidebar-nav");
  if (sidebar && CHAPTER_PROFILE_ROLES.has(state.profile.systemRole) && !document.querySelector("[data-p4-chapter-link]")) {
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = "#/chapter/overview";
    link.dataset.p4ChapterLink = "true";
    link.innerHTML = `${icons.home}<span>My chapter</span>`;
    sidebar.prepend(link);
  }
}

window.addEventListener("hashchange", () => queueMicrotask(renderPhase4));
const observer = new MutationObserver(() => {
  const route = routeFromHash();
  if (shouldHandle(route) && !document.querySelector("[data-phase4-root]") && state.authReady) queueMicrotask(renderPhase4);
  else queueMicrotask(augmentBasePortal);
});
observer.observe(app, { childList: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.authReady = false;
  state.error = null;
  try {
    await loadProfile(user);
    if (user?.emailVerified) {
      await loadMemberships();
      if (state.selectedChapterId) await loadChapterWorkspace(state.selectedChapterId, { rerender: false });
    } else {
      state.memberships = [];
      state.selectedChapterId = null;
    }
  } catch (error) {
    console.error("Unable to initialize Phase 4.", error);
    state.error = error;
  } finally {
    state.authReady = true;
    renderPhase4();
  }
});
