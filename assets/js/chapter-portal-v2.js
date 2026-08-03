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
const CHAPTER_ROLES = new Set(["director", "adviser", "chapterUser"]);
const ROUTES = new Set([
  "/chapter",
  "/chapter/overview",
  "/chapter/compliance",
  "/chapter/leadership",
  "/chapter/documents",
  "/chapter/notices",
  "/chapter/adviser"
]);

const state = {
  ready: false,
  rendering: false,
  user: null,
  profile: null,
  memberships: [],
  selectedChapterId: null,
  chapter: null,
  requirements: [],
  leaders: [],
  documents: [],
  notices: [],
  receipts: new Map(),
  adviserCheckins: [],
  loading: false,
  error: null,
  warnings: [],
  mobileOpen: false
};

const icons = {
  home: icon("M3 11 12 4l9 7v9H3z M9 20v-6h6v6"),
  shield: icon("M12 3 4 6v5c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6z M9 12l2 2 4-4"),
  users: icon("M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M17 11a2.5 2.5 0 1 0 0-5 M15 15a5 5 0 0 1 6 5"),
  file: icon("M6 3h8l4 4v14H6z M14 3v5h5 M9 12h6 M9 16h6"),
  bell: icon("M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4"),
  message: icon("M4 4h16v12H8l-4 4z M8 8h8 M8 12h5"),
  send: icon("M3 11.5 21 3l-6.5 18-3.5-7z M11 14 21 3"),
  clock: icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v6l4 2"),
  menu: icon("M4 7h16 M4 12h16 M4 17h16"),
  logout: icon("M10 17l5-5-5-5 M15 12H3 M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"),
  check: icon("M5 12l4 4L19 6"),
  alert: icon("M12 3 2 21h20z M12 9v5 M12 17h.01"),
  sun: icon("M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M19.1 4.9l-1.4 1.4 M6.3 17.7l-1.4 1.4"),
  moon: icon("M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z")
};

function icon(path) {
  return `<svg class="cp2-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  return (path.startsWith("/") ? path : `/${path}`).replace(/\/+$/, "") || "/";
}

function shouldHandle() {
  const route = routeFromHash();
  if (ROUTES.has(route)) return true;
  return route === "/dashboard" && CHAPTER_ROLES.has(state.profile?.systemRole);
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function titleCase(value = "") {
  return String(value).replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isPermissionError(error) {
  return error?.code === "permission-denied" || /missing or insufficient permissions|permission denied/i.test(error?.message || "");
}

function roleLabel(role) {
  return role === "director" ? "Chapter Director" : role === "adviser" ? "Chapter Adviser" : "Chapter Member";
}

function statusTone(value) {
  if (["active", "good_standing", "complete", "confirmed"].includes(value)) return "success";
  if (["suspended", "revoked", "expired", "closed", "overdue", "not_in_good_standing"].includes(value)) return "danger";
  return "warning";
}

function badge(value, label = titleCase(value || "Pending")) {
  return `<span class="cp2-badge cp2-${statusTone(value)}">${escapeHTML(label)}</span>`;
}

function selectedMembership() {
  return state.memberships.find((item) => item.chapterId === state.selectedChapterId) || null;
}

async function safeDoc(ref, label, { required = false } = {}) {
  try {
    return await getDoc(ref);
  } catch (error) {
    if (required || !isPermissionError(error)) throw error;
    state.warnings.push(label);
    return null;
  }
}

async function safeCollection(ref, label) {
  try {
    return await getDocs(ref);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    state.warnings.push(label);
    return null;
  }
}

async function loadProfile(user) {
  state.profile = null;
  if (!user) return;
  const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
  if (snapshot.exists()) state.profile = { id: snapshot.id, ...snapshot.data() };
}

async function loadMemberships() {
  state.memberships = [];
  const primaryChapterId = state.profile?.primaryChapterId;
  const records = [];

  if (primaryChapterId) {
    try {
      const direct = await getDoc(doc(db, "chapterMemberships", `${primaryChapterId}__${state.user.uid}`));
      if (direct.exists()) records.push({ id: direct.id, ...direct.data() });
    } catch (error) {
      if (!isPermissionError(error)) throw error;
      state.error = error;
    }
  }

  try {
    const snapshot = await getDocs(query(collection(db, "chapterMemberships"), where("uid", "==", state.user.uid)));
    snapshot.docs.forEach((item) => {
      if (!records.some((record) => record.id === item.id)) records.push({ id: item.id, ...item.data() });
    });
  } catch (error) {
    if (!records.length && !state.error) state.error = error;
  }

  state.memberships = records
    .filter((item) => item.status === "active" && item.uid === state.user.uid)
    .sort((a, b) => String(a.chapterName || a.chapterId).localeCompare(String(b.chapterName || b.chapterId)));

  const saved = localStorage.getItem(`tpp-selected-chapter-${state.user.uid}`);
  const preferred = saved || primaryChapterId;
  state.selectedChapterId = state.memberships.some((item) => item.chapterId === preferred)
    ? preferred
    : state.memberships[0]?.chapterId || null;
}

async function loadWorkspace() {
  if (!state.selectedChapterId) return;
  state.loading = true;
  state.error = null;
  state.warnings = [];
  render();
  try {
    const chapterRef = doc(db, "chapters", state.selectedChapterId);
    const chapterSnapshot = await safeDoc(chapterRef, "chapter record", { required: true });
    state.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;

    const [requirements, leaders, documents, notices] = await Promise.all([
      safeCollection(collection(chapterRef, "requirements"), "requirements"),
      safeCollection(collection(chapterRef, "leaders"), "leadership roster"),
      safeCollection(collection(chapterRef, "documents"), "document library"),
      safeCollection(collection(chapterRef, "notices"), "notices")
    ]);

    state.requirements = (requirements?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    state.leaders = (leaders?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status !== "removed" && item.visibleToChapter !== false)
      .sort((a, b) => String(a.role || "").localeCompare(String(b.role || "")));
    state.documents = (documents?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status !== "archived")
      .sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
    state.notices = (notices?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.active !== false && (!toDate(item.expiresAt) || toDate(item.expiresAt) > new Date()))
      .sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));

    state.receipts = new Map();
    await Promise.all(state.notices.map(async (notice) => {
      try {
        const receiptId = `${notice.id}__${state.user.uid}`;
        const receipt = await getDoc(doc(chapterRef, "noticeReceipts", receiptId));
        if (receipt.exists()) state.receipts.set(notice.id, receipt.data());
      } catch (error) {
        if (!isPermissionError(error)) throw error;
      }
    }));

    if (selectedMembership()?.role === "adviser") {
      const checkins = await safeCollection(query(collection(chapterRef, "adviserCheckins"), where("createdByUid", "==", state.user.uid)), "adviser check-ins");
      state.adviserCheckins = (checkins?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    } else {
      state.adviserCheckins = [];
    }
  } catch (error) {
    state.error = error;
  } finally {
    state.loading = false;
    render();
  }
}

function chapterData() {
  const chapter = state.chapter || {};
  const membership = selectedMembership() || {};
  return {
    chapterId: state.selectedChapterId || state.profile?.primaryChapterId || "",
    officialName: chapter.officialName || membership.chapterName || "Prayer Project Chapter",
    hostInstitutionName: chapter.hostInstitutionName || "Not listed",
    city: chapter.city || "",
    region: chapter.state || chapter.country || "",
    serviceArea: chapter.serviceArea || "Not listed",
    authorizationStatus: chapter.authorizationStatus || "under_review",
    standing: chapter.standing || "under_review",
    renewalDate: chapter.renewalDate,
    approvalDate: chapter.approvalDate,
    portalSummary: chapter.portalSummary || "Your official chapter workspace for standing, compliance, leadership, records, reports, and support."
  };
}

function layout(content, active = "/chapter/overview", title = "Overview") {
  const data = chapterData();
  const membership = selectedMembership();
  const adviserLink = membership?.role === "adviser"
    ? navLink("/chapter/adviser", "Adviser oversight", icons.shield, active)
    : "";
  return `<div class="cp2-shell" data-chapter-portal-v2>
    <aside class="cp2-sidebar ${state.mobileOpen ? "open" : ""}" id="cp2-sidebar">
      <a class="cp2-brand" href="#/chapter/overview"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Chapter Portal</small></span></a>
      <div class="cp2-current"><strong>${escapeHTML(data.officialName)}</strong><span>${escapeHTML(data.chapterId)}</span></div>
      <nav class="cp2-nav" aria-label="Chapter portal navigation">
        <span>Chapter</span>
        ${navLink("/chapter/overview", "Overview", icons.home, active)}
        ${navLink("/chapter/compliance", "Standing & compliance", icons.shield, active)}
        ${navLink("/chapter/leadership", "Leadership", icons.users, active)}
        ${navLink("/chapter/documents", "Documents", icons.file, active)}
        ${navLink("/chapter/notices", "Notices", icons.bell, active, state.notices.filter((n) => n.requireAcknowledgment && !state.receipts.has(n.id)).length)}
        ${adviserLink}
        <span>Operations</span>
        ${navLink("/chapter/workflows", "Reports & requests", icons.send, active)}
        ${navLink("/chapter/submissions", "Submission history", icons.clock, active)}
        ${navLink("/chapter/communications", "Communications", icons.message, active)}
        ${navLink("/chapter/support", "Support center", icons.shield, active)}
        <span>Account</span>
        ${navLink("/profile", "My profile", icons.users, active)}
        <button type="button" data-cp2-action="sign-out">${icons.logout}<span>Sign out</span></button>
      </nav>
    </aside>
    <section class="cp2-main">
      <header class="cp2-topbar"><button class="cp2-menu" type="button" data-cp2-action="menu">${icons.menu}</button><div><span>Chapter Portal</span><strong>${escapeHTML(title)}</strong></div><div><span class="cp2-role">${escapeHTML(roleLabel(membership?.role))}</span><button class="cp2-theme" type="button" data-cp2-action="theme">${document.documentElement.dataset.theme === "dark" ? icons.sun : icons.moon}</button></div></header>
      <main class="cp2-content" id="main-content">${content}</main>
    </section>
    <div class="cp2-toast-region" id="cp2-toast-region" aria-live="assertive"></div>
  </div>`;
}

function navLink(route, label, graphic, active, count = 0) {
  return `<a class="${route === active ? "active" : ""}" href="#${route}">${graphic}<span>${escapeHTML(label)}</span>${count ? `<em>${count}</em>` : ""}</a>`;
}

function heading(kicker, title, description, action = "") {
  return `<header class="cp2-heading"><div><p>${escapeHTML(kicker)}</p><h1>${escapeHTML(title)}</h1><span>${escapeHTML(description)}</span></div>${action}</header>`;
}

function warningPanel() {
  if (!state.warnings.length) return "";
  return `<section class="cp2-warning">${icons.alert}<div><strong>Some optional information is temporarily unavailable.</strong><span>${escapeHTML(Array.from(new Set(state.warnings)).join(", "))}. The rest of the portal remains available.</span></div></section>`;
}

function overviewPage() {
  const data = chapterData();
  const completed = state.requirements.filter((item) => ["complete", "not_required"].includes(item.status)).length;
  const progress = state.requirements.length ? Math.round((completed / state.requirements.length) * 100) : 0;
  return layout(`
    ${heading("Chapter overview", data.officialName, data.portalSummary, badge(data.authorizationStatus))}
    ${warningPanel()}
    <section class="cp2-actions">
      ${actionCard("/chapter/workflows", icons.send, "Reports & requests", "Submit reports, event proposals, changes, documents, and renewals.")}
      ${actionCard("/chapter/submissions", icons.clock, "Submission history", "Track drafts, reviews, decisions, and requested changes.")}
      ${actionCard("/chapter/communications", icons.message, "Communications", "Review notices and conversations with Prayer Project staff.")}
      ${actionCard("/chapter/support", icons.shield, "Support center", "Open and follow support requests for your chapter.")}
    </section>
    <section class="cp2-metrics">
      <article><span>Authorization</span><strong>${escapeHTML(titleCase(data.authorizationStatus))}</strong>${badge(data.authorizationStatus)}</article>
      <article><span>Standing</span><strong>${escapeHTML(titleCase(data.standing))}</strong>${badge(data.standing)}</article>
      <article><span>Compliance</span><strong>${progress}% complete</strong><small>${completed} of ${state.requirements.length} requirements complete</small></article>
      <article><span>Renewal</span><strong>${escapeHTML(formatDate(data.renewalDate, "Not scheduled"))}</strong><small>Official renewal date</small></article>
    </section>
    <section class="cp2-grid">
      <article class="cp2-card"><h2>Official chapter record</h2><dl>${detail("Permanent Chapter ID", data.chapterId)}${detail("Host institution", data.hostInstitutionName)}${detail("Service area", data.serviceArea)}${detail("Location", [data.city, data.region].filter(Boolean).join(", ") || "Not listed")}${detail("Approved", formatDate(data.approvalDate))}</dl></article>
      <article class="cp2-card"><h2>Current activity</h2><dl>${detail("Requirements", `${state.requirements.length}`)}${detail("Approved leaders", `${state.leaders.length}`)}${detail("Documents", `${state.documents.length}`)}${detail("Active notices", `${state.notices.length}`)}</dl></article>
    </section>`, "/chapter/overview", "Overview");
}

function actionCard(route, graphic, title, description) {
  return `<a href="#${route}"><span>${graphic}</span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></a>`;
}

function detail(label, value) {
  return `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`;
}

function compliancePage() {
  const data = chapterData();
  return layout(`
    ${heading("Standing & compliance", "Know exactly where your chapter stands.", "Authorization, standing, deadlines, and current chapter requirements are shown here.", badge(data.standing))}
    ${warningPanel()}
    <section class="cp2-card cp2-status"><div>${icons.shield}</div><div><span>Current standing</span><h2>${escapeHTML(titleCase(data.standing))}</h2><p>${escapeHTML(state.chapter?.standingMessage || "This is the current internal standing recorded by The Prayer Project.")}</p></div></section>
    <section class="cp2-list">${state.requirements.length ? state.requirements.map((item) => `<article><div>${["complete", "not_required"].includes(item.status) ? icons.check : icons.clock}</div><section><header><h3>${escapeHTML(item.title || "Requirement")}</h3>${badge(item.status)}</header><p>${escapeHTML(item.description || "No additional instructions were provided.")}</p><small>${item.dueDate ? `Due ${escapeHTML(formatDate(item.dueDate))}` : "No due date"}</small></section></article>`).join("") : empty("No requirements have been published.", "Your chapter currently has no visible compliance checklist items.")}</section>`, "/chapter/compliance", "Standing & Compliance");
}

function leadershipPage() {
  return layout(`
    ${heading("Leadership", "Approved chapter leadership", "The leaders and oversight roles currently recognized for this chapter.")}
    ${warningPanel()}
    <section class="cp2-people">${state.leaders.length ? state.leaders.map((leader) => `<article><div>${escapeHTML(initials(leader.displayName))}</div><h3>${escapeHTML(leader.displayName || "Chapter Leader")}</h3><p>${escapeHTML(roleLabel(leader.role))}</p>${badge(leader.status || "active")}</article>`).join("") : empty("No leadership roster is available.", "Activated leaders will appear after their records are synchronized.")}</section>
    <section class="cp2-card cp2-info"><div>${icons.send}</div><div><h2>Need to change leadership?</h2><p>Submit a formal leadership-change request through Reports & Requests.</p><a class="btn btn-secondary" href="#/chapter/workflows">Open reports & requests</a></div></section>`, "/chapter/leadership", "Leadership");
}

function documentsPage() {
  return layout(`
    ${heading("Documents", "Official chapter documents", "Approval records, policies, forms, and chapter materials published for your chapter.")}
    ${warningPanel()}
    <section class="cp2-documents">${state.documents.length ? state.documents.map((item) => `<article><div>${icons.file}</div><section><h3>${escapeHTML(item.title || "Chapter document")}</h3><p>${escapeHTML(item.description || "Official chapter document")}</p><small>Published ${escapeHTML(formatDate(item.publishedAt))}</small></section>${/^https:\/\//i.test(item.url || "") ? `<a class="btn btn-secondary" target="_blank" rel="noopener noreferrer" href="${escapeHTML(item.url)}">Open</a>` : badge("pending", "Link unavailable")}</article>`).join("") : empty("No documents are available yet.", "Official chapter documents will appear here when published.")}</section>`, "/chapter/documents", "Documents");
}

function noticesPage() {
  return layout(`
    ${heading("Notices", "Chapter communications", "Official notices, policy updates, reminders, and action items for your chapter.")}
    ${warningPanel()}
    <section class="cp2-notices">${state.notices.length ? state.notices.map((notice) => noticeCard(notice)).join("") : empty("No active notices.", "Your chapter is currently caught up.")}</section>`, "/chapter/notices", "Notices");
}

function noticeCard(notice) {
  const acknowledged = state.receipts.has(notice.id);
  return `<article><header><span>${escapeHTML(titleCase(notice.priority || "normal"))} notice</span><time>${escapeHTML(formatDate(notice.publishedAt))}</time></header><h2>${escapeHTML(notice.title || "Notice")}</h2><p>${escapeHTML(notice.body || "")}</p>${notice.requireAcknowledgment ? acknowledged ? `<div class="cp2-ack">${icons.check}<span>Acknowledged</span></div>` : `<button class="btn btn-primary" type="button" data-cp2-action="acknowledge" data-notice-id="${escapeHTML(notice.id)}">Acknowledge notice</button>` : ""}</article>`;
}

function adviserPage() {
  if (selectedMembership()?.role !== "adviser") return layout(empty("Adviser access required.", "This page is limited to the approved Chapter Adviser."), "", "Adviser Oversight");
  return layout(`
    ${heading("Adviser oversight", "Institutional and adult oversight", "Submit a confidential adviser check-in directly to authorized Prayer Project administrators.")}
    <section class="cp2-grid">
      <article class="cp2-card"><h2>Submit a check-in</h2><div id="cp2-adviser-alert"></div><form id="cp2-adviser-form" class="cp2-form"><label><span>Type</span><select name="category"><option value="routine_checkin">Routine check-in</option><option value="institutional_change">Institutional change</option><option value="leadership_concern">Leadership concern</option><option value="privacy_concern">Privacy concern</option><option value="safety_concern">Safety concern</option></select></label><label><span>Subject</span><input name="subject" maxlength="140" required></label><label><span>Details</span><textarea name="details" rows="7" maxlength="3000" required></textarea></label><button class="btn btn-primary" type="submit">Submit confidential check-in</button></form></article>
      <article class="cp2-card"><h2>Your check-ins</h2>${state.adviserCheckins.length ? `<div class="cp2-checkins">${state.adviserCheckins.map((item) => `<article><strong>${escapeHTML(item.subject)}</strong><span>${escapeHTML(titleCase(item.category))} · ${escapeHTML(formatDate(item.createdAt))}</span>${badge(item.status || "submitted")}</article>`).join("")}</div>` : empty("No adviser check-ins submitted.", "Your private submissions will appear here.")}</article>
    </section>`, "/chapter/adviser", "Adviser Oversight");
}

function empty(title, message) {
  return `<div class="cp2-empty"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span></div>`;
}

function initials(value = "TP") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "TP").toUpperCase();
}

function loadingPage() {
  return `<main class="cp2-gate" id="main-content" data-chapter-portal-v2><section><img src="assets/brand-mark.svg" alt=""><div class="spinner"></div><h1>Loading your chapter portal…</h1></section></main>`;
}

function accessPage() {
  const primary = state.profile?.primaryChapterId || "the assigned chapter";
  const permission = isPermissionError(state.error);
  return `<main class="cp2-gate" id="main-content" data-chapter-portal-v2><section><img src="assets/brand-mark.svg" alt=""><p>Chapter access</p><h1>${permission ? "Portal rules need to be synchronized." : "No active chapter assignment was found."}</h1><span>${permission ? `Your account is active for ${escapeHTML(primary)}, but Firebase denied the membership read. Deploy the current Firestore rules, then retry.` : "Use the invitation code again or ask an administrator to confirm your membership."}</span><div><button class="btn btn-primary" type="button" data-cp2-action="retry">Retry access</button><a class="btn btn-secondary" href="#/activate">Use invitation code</a><button class="btn btn-secondary" type="button" data-cp2-action="sign-out">Sign out</button></div></section></main>`;
}

function errorPage() {
  return `<main class="cp2-gate" id="main-content" data-chapter-portal-v2><section><img src="assets/brand-mark.svg" alt=""><p>Chapter portal</p><h1>Chapter data could not be loaded.</h1><span>${escapeHTML(state.error?.message || "The chapter record is unavailable.")}</span><div><button class="btn btn-primary" type="button" data-cp2-action="retry-workspace">Try again</button><a class="btn btn-secondary" href="#/chapter/support">Support center</a></div></section></main>`;
}

function pageForRoute() {
  const route = routeFromHash();
  const normalized = route === "/chapter" || route === "/dashboard" ? "/chapter/overview" : route;
  return ({
    "/chapter/overview": overviewPage,
    "/chapter/compliance": compliancePage,
    "/chapter/leadership": leadershipPage,
    "/chapter/documents": documentsPage,
    "/chapter/notices": noticesPage,
    "/chapter/adviser": adviserPage
  })[normalized]?.() || overviewPage();
}

function render() {
  if (!state.ready || !shouldHandle() || state.rendering) return;
  state.rendering = true;
  try {
    if (!state.user) {
      location.hash = "/login";
      return;
    }
    if (!state.profile || state.profile.accountStatus !== "active" || !CHAPTER_ROLES.has(state.profile.systemRole)) return;
    if (state.loading) app.innerHTML = loadingPage();
    else if (!state.memberships.length) app.innerHTML = accessPage();
    else if (state.error && !state.chapter) app.innerHTML = errorPage();
    else app.innerHTML = pageForRoute();
    bindEvents();
  } finally {
    state.rendering = false;
  }
}

function toast(title, message) {
  const region = document.querySelector("#cp2-toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = "cp2-toast";
  item.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

async function acknowledgeNotice(noticeId) {
  try {
    const receiptId = `${noticeId}__${state.user.uid}`;
    await setDoc(doc(db, "chapters", state.selectedChapterId, "noticeReceipts", receiptId), {
      noticeId,
      chapterId: state.selectedChapterId,
      uid: state.user.uid,
      acknowledgedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    state.receipts.set(noticeId, { acknowledgedAt: new Date() });
    render();
  } catch (error) {
    toast("Unable to acknowledge notice", error.message || "The notice could not be updated.");
  }
}

async function submitAdviserCheckin(form) {
  const subject = form.subject.value.trim();
  const details = form.details.value.trim();
  if (subject.length < 4 || details.length < 20) {
    document.querySelector("#cp2-adviser-alert").innerHTML = `<div class="cp2-inline-alert">Enter a clear subject and at least 20 characters of detail.</div>`;
    return;
  }
  try {
    await addDoc(collection(db, "chapters", state.selectedChapterId, "adviserCheckins"), {
      chapterId: state.selectedChapterId,
      createdByUid: state.user.uid,
      adviserName: state.profile.displayName || state.user.email,
      category: form.category.value,
      subject,
      details,
      status: "submitted",
      confidential: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    form.reset();
    await loadWorkspace();
    toast("Check-in submitted", "Authorized administrators can now review it.");
  } catch (error) {
    document.querySelector("#cp2-adviser-alert").innerHTML = `<div class="cp2-inline-alert">${escapeHTML(error.message || "The check-in could not be submitted.")}</div>`;
  }
}

function bindEvents() {
  document.querySelectorAll('[data-cp2-action="sign-out"]').forEach((button) => button.addEventListener("click", async () => {
    await signOut(auth);
    location.hash = "/login";
  }));
  document.querySelector('[data-cp2-action="menu"]')?.addEventListener("click", () => {
    state.mobileOpen = !state.mobileOpen;
    render();
  });
  document.querySelector('[data-cp2-action="theme"]')?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("tpp-theme", next);
    render();
  });
  document.querySelector('[data-cp2-action="retry"]')?.addEventListener("click", initialize);
  document.querySelector('[data-cp2-action="retry-workspace"]')?.addEventListener("click", loadWorkspace);
  document.querySelectorAll('[data-cp2-action="acknowledge"]').forEach((button) => button.addEventListener("click", () => acknowledgeNotice(button.dataset.noticeId)));
  document.querySelector("#cp2-adviser-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAdviserCheckin(event.currentTarget);
  });
}

async function initialize() {
  if (!state.user) return;
  state.loading = true;
  state.error = null;
  render();
  try {
    await loadProfile(state.user);
    if (!CHAPTER_ROLES.has(state.profile?.systemRole)) return;
    await loadMemberships();
    if (state.selectedChapterId) await loadWorkspace();
  } catch (error) {
    state.error = error;
  } finally {
    state.loading = false;
    state.ready = true;
    render();
  }
}

window.addEventListener("hashchange", () => queueMicrotask(render));
window.addEventListener("tpp:background-permission-error", () => {
  if (shouldHandle() && !document.querySelector("[data-chapter-portal-v2]")) queueMicrotask(render);
});

const observer = new MutationObserver(() => {
  if (state.ready && shouldHandle() && !document.querySelector("[data-chapter-portal-v2]") && !state.rendering) queueMicrotask(render);
});
observer.observe(app, { childList: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.ready = false;
  state.profile = null;
  state.memberships = [];
  state.chapter = null;
  state.error = null;
  if (!user) {
    state.ready = true;
    render();
    return;
  }
  await initialize();
});
