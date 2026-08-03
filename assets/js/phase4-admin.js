import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");
const ROUTE = "/admin/chapter-workspaces";
const ADMIN_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin"]);
const CHAPTER_ID_PATTERN = /^TPP-CH-[A-Z0-9]{1,32}$/;

const state = {
  authReady: false,
  user: null,
  profile: null,
  chapterId: "",
  publicChapter: null,
  chapter: null,
  requirements: [],
  leaders: [],
  documents: [],
  notices: [],
  loading: false,
  error: null,
  rendering: false
};

const icons = {
  home: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>`,
  building: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>`,
  key: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-2 2 2 2m-5 1 2 2"/></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/></svg>`,
  users: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0"/></svg>`,
  file: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>`,
  bell: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>`,
  plus: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>`,
  refresh: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M17.9 15A7 7 0 0 1 6 18l-2-5"/></svg>`,
  logout: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6"/></svg>`,
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2 21h20z"/><path d="M12 9v5m0 3h.01"/></svg>`
};

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  return (path.startsWith("/") ? path : `/${path}`).replace(/\/+$/, "") || "/";
}

function escapeHTML(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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

function dateInput(value) {
  const date = toDate(value);
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value, fallback = "Not set") {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date) : fallback;
}

function asDate(value) {
  return value ? new Date(`${value}T12:00:00`) : null;
}

function brand() {
  return `<a class="p4-brand" href="#/dashboard"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Administration</small></span></a>`;
}

function adminRoleLabel() {
  return state.profile?.systemRole === "owner" ? "Owner" : state.profile?.systemRole === "complianceAdmin" ? "Compliance Administrator" : "Chapter Administrator";
}

function badge(status) {
  const tone = ["active", "good_standing", "complete", "confirmed"].includes(status) ? "success" : ["suspended", "revoked", "closed", "overdue", "not_in_good_standing"].includes(status) ? "danger" : "warning";
  return `<span class="p4-badge p4-${tone}">${escapeHTML(titleCase(status || "pending"))}</span>`;
}

function layout(content) {
  return `<div class="p4-admin-shell" data-phase4-admin-root>
    <aside class="p4-admin-sidebar">
      <div>${brand()}</div>
      <nav><a href="#/dashboard">${icons.home}<span>Dashboard</span></a><a href="#/admin/invitations">${icons.key}<span>Account invitations</span></a><a class="active" href="#/admin/chapter-workspaces">${icons.building}<span>Chapter workspaces</span></a><a href="#/verify">${icons.shield}<span>Public registry</span></a></nav>
      <div class="p4-admin-user"><strong>${escapeHTML(state.profile?.displayName || state.user?.email || "Administrator")}</strong><span>${escapeHTML(adminRoleLabel())}</span></div>
    </aside>
    <div class="p4-admin-main"><header><div><span>Phase 4</span><strong>Chapter Workspace Setup</strong></div><button class="btn btn-secondary" type="button" data-p4a-action="sign-out">${icons.logout} Sign out</button></header><main id="main-content">${content}</main></div>
    <div class="toast-region" id="p4a-toast-region" aria-live="assertive"></div>
  </div>`;
}

function gate(message) {
  return `<main class="p4-gate" data-phase4-admin-root id="main-content"><section class="p4-gate-card"><img src="assets/brand-mark.svg" alt=""><p class="p4-kicker">Administration</p><h1>Access unavailable.</h1><p>${escapeHTML(message)}</p><a class="btn btn-primary" href="#/dashboard">Return to dashboard</a></section></main>`;
}

async function loadProfile(user) {
  state.profile = null;
  if (!user) return;
  const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
  if (snapshot.exists()) state.profile = { id: snapshot.id, ...snapshot.data() };
}

async function loadWorkspace(chapterId, { rerender = true } = {}) {
  state.chapterId = String(chapterId || "").trim().toUpperCase();
  if (!CHAPTER_ID_PATTERN.test(state.chapterId)) {
    state.error = new Error("Use TPP-CH- followed by letters and/or numbers, such as TPP-CH-A1B2C3.");
    if (rerender) render();
    return;
  }
  state.loading = true;
  state.error = null;
  if (rerender) render();
  try {
    const chapterRef = doc(db, "chapters", state.chapterId);
    const [publicSnapshot, chapterSnapshot, requirementsSnapshot, leadersSnapshot, documentsSnapshot, noticesSnapshot] = await Promise.all([
      getDoc(doc(db, "publicChapterRegistry", state.chapterId)),
      getDoc(chapterRef),
      getDocs(collection(chapterRef, "requirements")),
      getDocs(collection(chapterRef, "leaders")),
      getDocs(collection(chapterRef, "documents")),
      getDocs(collection(chapterRef, "notices"))
    ]);
    state.publicChapter = publicSnapshot.exists() ? { id: publicSnapshot.id, ...publicSnapshot.data() } : null;
    state.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;
    state.requirements = requirementsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    state.leaders = leadersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
    state.documents = documentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.title).localeCompare(String(b.title)));
    state.notices = noticesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
    localStorage.setItem("tpp-admin-workspace-chapter", state.chapterId);
  } catch (error) {
    console.error(error);
    state.error = error;
  } finally {
    state.loading = false;
    if (rerender) render();
  }
}

function searchPanel() {
  return `<section class="p4-admin-search"><div><p class="p4-kicker">Private portal setup</p><h1>Manage chapter workspaces.</h1><p>Initialize and maintain the private operational record used by Chapter Directors and Chapter Advisers.</p></div><form id="p4a-load-form"><label><span>Permanent Chapter ID</span><div><input name="chapterId" value="${escapeHTML(state.chapterId)}" placeholder="TPP-CH-A1B2C3" required><button class="btn btn-primary" type="submit">Load workspace</button></div></label></form></section>`;
}

function emptyState() {
  return `<section class="p4-admin-empty"><div>${icons.building}</div><h2>Load an approved chapter.</h2><p>Enter a permanent Chapter ID to initialize or manage its private Director and Adviser workspace.</p></section>`;
}

function notPublishedState() {
  return `<section class="p4-admin-empty"><div>${icons.alert}</div><h2>Published chapter not found.</h2><p>Phase 4 workspaces can only be initialized for a Chapter ID already published in <code>publicChapterRegistry</code>.</p></section>`;
}

function initializePanel() {
  return `<section class="p4-admin-empty p4-admin-initialize"><div>${icons.plus}</div><h2>Private workspace not initialized.</h2><p>${escapeHTML(state.publicChapter.officialName)} has a public registry record, but no private operational record. Initialization creates the standard compliance checklist and welcome notice.</p><button class="btn btn-primary" type="button" data-p4a-action="initialize">Initialize chapter workspace</button></section>`;
}

function workspaceTabs() {
  return `<nav class="p4-admin-tabs"><a href="#p4a-profile">Profile</a><a href="#p4a-requirements">Requirements</a><a href="#p4a-leadership">Leadership</a><a href="#p4a-documents">Documents</a><a href="#p4a-notices">Notices</a></nav>`;
}

function chapterSummary() {
  return `<section class="p4-admin-summary"><div><span>${escapeHTML(state.chapter.chapterId)}</span><h2>${escapeHTML(state.chapter.officialName)}</h2><p>${escapeHTML(state.chapter.hostInstitutionName)} · ${escapeHTML([state.chapter.city, state.chapter.state].filter(Boolean).join(", ") || "Location not listed")}</p></div><div>${badge(state.chapter.authorizationStatus)}${badge(state.chapter.standing)}</div></section>`;
}

function profileSection() {
  const item = state.chapter;
  return `<section class="p4-admin-card" id="p4a-profile"><div class="p4-admin-card-head"><div><p class="p4-kicker">Workspace profile</p><h2>Official operational record</h2></div>${icons.building}</div><div id="p4a-profile-alert"></div><form class="p4-admin-form" id="p4a-profile-form">
    <div class="p4-admin-form-grid"><label><span>Official chapter name</span><input name="officialName" value="${escapeHTML(item.officialName || "")}" required></label><label><span>Host institution</span><input name="hostInstitutionName" value="${escapeHTML(item.hostInstitutionName || "")}" required></label><label><span>Institution type</span><select name="institutionType"><option value="school" ${item.institutionType === "school" ? "selected" : ""}>School</option><option value="church" ${item.institutionType === "church" ? "selected" : ""}>Church</option><option value="organization" ${item.institutionType === "organization" ? "selected" : ""}>Organization</option></select></label><label><span>Primary contact email</span><input type="email" name="primaryContactEmail" value="${escapeHTML(item.primaryContactEmail || "")}"></label><label><span>City</span><input name="city" value="${escapeHTML(item.city || "")}"></label><label><span>State</span><input name="state" value="${escapeHTML(item.state || "")}"></label><label><span>Country</span><input name="country" value="${escapeHTML(item.country || "United States")}"></label><label><span>Service area</span><input name="serviceArea" value="${escapeHTML(item.serviceArea || "")}"></label><label><span>Authorization status</span><select name="authorizationStatus">${["active","conditional","inactive","suspended","expired","closed","revoked"].map((v) => `<option value="${v}" ${item.authorizationStatus === v ? "selected" : ""}>${titleCase(v)}</option>`).join("")}</select></label><label><span>Chapter standing</span><select name="standing">${["good_standing","action_required","under_review","probationary","not_in_good_standing"].map((v) => `<option value="${v}" ${item.standing === v ? "selected" : ""}>${titleCase(v)}</option>`).join("")}</select></label><label><span>Institutional approval</span><select name="institutionalApprovalStatus">${["confirmed","pending","expired","not_required"].map((v) => `<option value="${v}" ${item.institutionalApprovalStatus === v ? "selected" : ""}>${titleCase(v)}</option>`).join("")}</select></label><label><span>Adviser confirmation</span><select name="adviserConfirmationStatus">${["complete","due","overdue","not_required"].map((v) => `<option value="${v}" ${item.adviserConfirmationStatus === v ? "selected" : ""}>${titleCase(v)}</option>`).join("")}</select></label><label><span>Approval date</span><input type="date" name="approvalDate" value="${dateInput(item.approvalDate)}"></label><label><span>Effective date</span><input type="date" name="effectiveDate" value="${dateInput(item.effectiveDate)}"></label><label><span>Renewal date</span><input type="date" name="renewalDate" value="${dateInput(item.renewalDate)}"></label><label><span>Last review date</span><input type="date" name="lastReviewDate" value="${dateInput(item.lastReviewDate)}"></label><label><span>Adviser confirmation due</span><input type="date" name="adviserConfirmationDueDate" value="${dateInput(item.adviserConfirmationDueDate)}"></label><label><span>Meeting schedule</span><input name="meetingSchedule" value="${escapeHTML(item.meetingSchedule || "")}"></label></div>
    <label><span>Standing message</span><textarea name="standingMessage" rows="3" maxlength="800">${escapeHTML(item.standingMessage || "")}</textarea></label><label><span>Portal summary</span><textarea name="portalSummary" rows="4" maxlength="1000">${escapeHTML(item.portalSummary || "")}</textarea></label><button class="btn btn-primary" id="p4a-profile-submit" type="submit">Save workspace profile</button>
  </form></section>`;
}

function requirementsSection() {
  return `<section class="p4-admin-card" id="p4a-requirements"><div class="p4-admin-card-head"><div><p class="p4-kicker">Compliance checklist</p><h2>Requirements</h2></div><span>${state.requirements.length}</span></div><form class="p4-admin-inline-form" id="p4a-requirement-form"><input name="title" placeholder="Requirement title" maxlength="140" required><select name="category"><option value="governance">Governance</option><option value="leadership">Leadership</option><option value="training">Training</option><option value="reporting">Reporting</option><option value="renewal">Renewal</option><option value="institutional">Institutional</option></select><select name="status"><option value="due">Due</option><option value="complete">Complete</option><option value="under_review">Under review</option><option value="not_required">Not required</option></select><input type="date" name="dueDate"><input name="description" placeholder="Short instructions" maxlength="500"><button class="btn btn-primary" type="submit">${icons.plus} Add</button></form>${state.requirements.length ? `<div class="p4-admin-records">${state.requirements.map((item) => `<article><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(titleCase(item.category))} · ${escapeHTML(formatDate(item.dueDate))}</span><p>${escapeHTML(item.description || "")}</p></div><div>${badge(item.status)}<select data-p4a-action="requirement-status" data-id="${escapeHTML(item.id)}"><option value="due" ${item.status === "due" ? "selected" : ""}>Due</option><option value="complete" ${item.status === "complete" ? "selected" : ""}>Complete</option><option value="under_review" ${item.status === "under_review" ? "selected" : ""}>Under review</option><option value="not_required" ${item.status === "not_required" ? "selected" : ""}>Not required</option></select></div></article>`).join("")}</div>` : `<div class="p4-admin-mini-empty">No requirements published.</div>`}</section>`;
}

function leadershipSection() {
  return `<section class="p4-admin-card" id="p4a-leadership"><div class="p4-admin-card-head"><div><p class="p4-kicker">Activated accounts</p><h2>Leadership roster</h2></div><button class="btn btn-secondary" type="button" data-p4a-action="sync-leaders">${icons.refresh} Sync memberships</button></div>${state.leaders.length ? `<div class="p4-admin-leaders">${state.leaders.map((item) => `<article><div class="p4-avatar">${escapeHTML((item.displayName || "TP").slice(0,2).toUpperCase())}</div><div><strong>${escapeHTML(item.displayName)}</strong><span>${escapeHTML(titleCase(item.role))} · ${escapeHTML(item.email || "No email")}</span></div><div>${badge(item.agreementStatus)}${badge(item.trainingStatus)}</div></article>`).join("")}</div>` : `<div class="p4-admin-mini-empty">No leader records. Sync active chapter memberships.</div>`}</section>`;
}

function documentsSection() {
  return `<section class="p4-admin-card" id="p4a-documents"><div class="p4-admin-card-head"><div><p class="p4-kicker">Portal library</p><h2>Documents</h2></div>${icons.file}</div><form class="p4-admin-inline-form p4-admin-doc-form" id="p4a-document-form"><input name="title" placeholder="Document title" maxlength="140" required><select name="category"><option value="approval">Approval</option><option value="policy">Policy</option><option value="form">Form</option><option value="training">Training</option><option value="general">General</option></select><input type="url" name="url" placeholder="https://..." required><input name="version" placeholder="Version" maxlength="30"><input name="description" placeholder="Description" maxlength="400"><button class="btn btn-primary" type="submit">${icons.plus} Publish</button></form>${state.documents.length ? `<div class="p4-admin-records">${state.documents.map((item) => `<article><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(titleCase(item.category))} · ${escapeHTML(item.version || "Current")}</span><p>${escapeHTML(item.url)}</p></div><div>${badge(item.status || "active")}<button class="btn btn-small btn-secondary" data-p4a-action="archive-document" data-id="${escapeHTML(item.id)}" type="button">Archive</button></div></article>`).join("")}</div>` : `<div class="p4-admin-mini-empty">No documents published.</div>`}</section>`;
}

function noticesSection() {
  return `<section class="p4-admin-card" id="p4a-notices"><div class="p4-admin-card-head"><div><p class="p4-kicker">Chapter communications</p><h2>Notices</h2></div>${icons.bell}</div><form class="p4-admin-form" id="p4a-notice-form"><div class="p4-admin-form-grid"><label><span>Title</span><input name="title" maxlength="140" required></label><label><span>Priority</span><select name="priority"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><label><span>Expiration date</span><input type="date" name="expiresAt"></label><label class="p4-admin-checkbox"><input type="checkbox" name="requireAcknowledgment"><span>Require acknowledgment</span></label></div><label><span>Notice body</span><textarea name="body" rows="4" maxlength="2000" required></textarea></label><button class="btn btn-primary" type="submit">Publish notice</button></form>${state.notices.length ? `<div class="p4-admin-records">${state.notices.map((item) => `<article><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(titleCase(item.priority))} · ${escapeHTML(formatDate(item.publishedAt))}</span><p>${escapeHTML(item.body)}</p></div><div>${badge(item.active === false ? "archived" : "active")}<button class="btn btn-small btn-secondary" data-p4a-action="archive-notice" data-id="${escapeHTML(item.id)}" type="button">Archive</button></div></article>`).join("")}</div>` : `<div class="p4-admin-mini-empty">No notices published.</div>`}</section>`;
}

function workspacePage() {
  return `${searchPanel()}${workspaceTabs()}${chapterSummary()}${profileSection()}${requirementsSection()}${leadershipSection()}${documentsSection()}${noticesSection()}`;
}

function page() {
  if (!state.chapterId) return layout(`${searchPanel()}${emptyState()}`);
  if (state.loading) return layout(`${searchPanel()}<section class="p4-admin-empty"><div class="spinner"></div><h2>Loading workspace…</h2></section>`);
  if (state.error) return layout(`${searchPanel()}<section class="p4-admin-empty"><div>${icons.alert}</div><h2>Unable to load workspace.</h2><p>${escapeHTML(state.error.message || "Firestore rejected the request.")}</p></section>`);
  if (!state.publicChapter) return layout(`${searchPanel()}${notPublishedState()}`);
  if (!state.chapter) return layout(`${searchPanel()}${initializePanel()}`);
  return layout(workspacePage());
}

function render() {
  if (routeFromHash() !== ROUTE || !state.authReady || state.rendering) {
    augmentBasePortal();
    return;
  }
  state.rendering = true;
  try {
    if (!state.user) app.innerHTML = gate("Sign in with an authorized administrative account.");
    else if (!state.profile || state.profile.accountStatus !== "active" || !ADMIN_ROLES.has(state.profile.systemRole)) app.innerHTML = gate("This page is limited to the Owner, Chapter Administrators, and Compliance Administrators.");
    else app.innerHTML = page();
    bindEvents();
    document.title = "Chapter Workspace Setup | The Prayer Project";
  } finally {
    state.rendering = false;
  }
}

function toast(title, message) {
  const region = document.querySelector("#p4a-toast-region") || document.querySelector("#toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `${icons.check}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

async function initializeWorkspace(button) {
  if (!state.publicChapter) return;
  button.disabled = true;
  button.textContent = "Initializing…";
  const publicRecord = state.publicChapter;
  const chapterRef = doc(db, "chapters", state.chapterId);
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(chapterRef, {
    chapterId: state.chapterId,
    officialName: publicRecord.officialName,
    hostInstitutionName: publicRecord.hostInstitutionName || "",
    institutionType: publicRecord.institutionType || "organization",
    city: publicRecord.city || "",
    state: publicRecord.state || "",
    country: publicRecord.country || "United States",
    serviceArea: publicRecord.serviceArea || "",
    authorizationStatus: publicRecord.authorizationStatus || "active",
    standing: publicRecord.standing || "under_review",
    standingMessage: publicRecord.publicNotice || "",
    approvalDate: publicRecord.approvalDate || null,
    effectiveDate: publicRecord.effectiveDate || null,
    renewalDate: publicRecord.renewalDate || null,
    lastReviewDate: publicRecord.lastVerifiedAt || null,
    portalSummary: publicRecord.summary || "Official private chapter operations workspace.",
    meetingSchedule: "",
    primaryContactEmail: "",
    institutionalApprovalStatus: "confirmed",
    adviserConfirmationStatus: "due",
    adviserConfirmationDueDate: publicRecord.renewalDate || null,
    createdAt: now,
    createdByUid: state.user.uid,
    updatedAt: now,
    updatedByUid: state.user.uid
  });
  const defaults = [
    ["institutional-approval", "Institutional approval on file", "institutional", "complete", "The host school, church, or organization has approved chapter activity."],
    ["chapter-authorization", "Prayer Project chapter authorization", "governance", "complete", "The official chapter approval and permanent Chapter ID are active."],
    ["director-agreement", "Director commitment agreement", "leadership", "due", "The approved Chapter Director must have a current signed commitment agreement."],
    ["adviser-agreement", "Adviser agreement", "leadership", "due", "The approved Chapter Adviser must have a current adviser agreement on file."],
    ["required-training", "Required leadership training", "training", "due", "All required chapter leadership training must be completed."],
    ["quarterly-report", "Current chapter report", "reporting", "due", "The latest required chapter activity report must be accepted."],
    ["annual-renewal", "Annual chapter renewal", "renewal", "due", "The chapter must complete renewal before its authorization expires."]
  ];
  defaults.forEach(([id, title, category, status, description], index) => batch.set(doc(chapterRef, "requirements", id), {
    chapterId: state.chapterId,
    title,
    category,
    status,
    description,
    dueDate: id === "annual-renewal" ? publicRecord.renewalDate || null : null,
    completedAt: status === "complete" ? now : null,
    sortOrder: index + 1,
    visibleToChapter: true,
    createdAt: now,
    updatedAt: now
  }));
  batch.set(doc(chapterRef, "notices", "workspace-welcome"), {
    chapterId: state.chapterId,
    title: "Welcome to your Chapter Operations Portal",
    body: "This workspace is the official private location for chapter standing, requirements, leadership records, documents, and Prayer Project notices.",
    priority: "normal",
    requireAcknowledgment: false,
    active: true,
    publishedAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now
  });
  try {
    await batch.commit();
    await syncLeaders(null, { quiet: true });
    toast("Workspace initialized", "The standard chapter portal record and compliance checklist were created.");
    await loadWorkspace(state.chapterId);
  } catch (error) {
    console.error(error);
    toast("Initialization failed", "Firestore rejected the workspace creation.");
    button.disabled = false;
    button.textContent = "Initialize chapter workspace";
  }
}

async function saveProfile(form) {
  const button = form.querySelector("#p4a-profile-submit");
  button.disabled = true;
  button.textContent = "Saving…";
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    await updateDoc(doc(db, "chapters", state.chapterId), {
      officialName: values.officialName.trim(),
      hostInstitutionName: values.hostInstitutionName.trim(),
      institutionType: values.institutionType,
      primaryContactEmail: values.primaryContactEmail.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      country: values.country.trim(),
      serviceArea: values.serviceArea.trim(),
      authorizationStatus: values.authorizationStatus,
      standing: values.standing,
      institutionalApprovalStatus: values.institutionalApprovalStatus,
      adviserConfirmationStatus: values.adviserConfirmationStatus,
      approvalDate: asDate(values.approvalDate),
      effectiveDate: asDate(values.effectiveDate),
      renewalDate: asDate(values.renewalDate),
      lastReviewDate: asDate(values.lastReviewDate),
      adviserConfirmationDueDate: asDate(values.adviserConfirmationDueDate),
      meetingSchedule: values.meetingSchedule.trim(),
      standingMessage: values.standingMessage.trim(),
      portalSummary: values.portalSummary.trim(),
      updatedAt: serverTimestamp(),
      updatedByUid: state.user.uid
    });
    toast("Profile saved", "The chapter workspace now shows the updated official record.");
    await loadWorkspace(state.chapterId);
  } catch (error) {
    console.error(error);
    toast("Save failed", "Firestore rejected the workspace update.");
    button.disabled = false;
    button.textContent = "Save workspace profile";
  }
}

async function addRequirement(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  await addDoc(collection(db, "chapters", state.chapterId, "requirements"), {
    chapterId: state.chapterId,
    title: data.title.trim(),
    category: data.category,
    status: data.status,
    description: data.description.trim(),
    dueDate: asDate(data.dueDate),
    completedAt: data.status === "complete" ? serverTimestamp() : null,
    sortOrder: state.requirements.length + 1,
    visibleToChapter: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  form.reset();
  toast("Requirement added", "The item is now visible in the chapter compliance center.");
  await loadWorkspace(state.chapterId);
}

async function addDocument(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (!/^https:\/\//i.test(data.url)) throw new Error("Document links must begin with https://");
  await addDoc(collection(db, "chapters", state.chapterId, "documents"), {
    chapterId: state.chapterId,
    title: data.title.trim(),
    category: data.category,
    url: data.url.trim(),
    version: data.version.trim() || "Current",
    description: data.description.trim(),
    status: "active",
    publishedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  form.reset();
  toast("Document published", "The document link is now available to chapter leadership.");
  await loadWorkspace(state.chapterId);
}

async function addNotice(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  await addDoc(collection(db, "chapters", state.chapterId, "notices"), {
    chapterId: state.chapterId,
    title: data.title.trim(),
    body: data.body.trim(),
    priority: data.priority,
    requireAcknowledgment: form.requireAcknowledgment.checked,
    active: true,
    publishedAt: serverTimestamp(),
    expiresAt: asDate(data.expiresAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  form.reset();
  toast("Notice published", "The message is now visible in the chapter portal.");
  await loadWorkspace(state.chapterId);
}

async function syncLeaders(button, { quiet = false } = {}) {
  if (button) {
    button.disabled = true;
    button.textContent = "Syncing…";
  }
  try {
    const memberships = await getDocs(query(collection(db, "chapterMemberships"), where("chapterId", "==", state.chapterId)));
    const batch = writeBatch(db);
    if (memberships.empty) {
      if (!quiet) toast("No memberships found", "Activate a Director or Adviser account before synchronizing the roster.");
      return;
    }
    const existingByUid = new Map(state.leaders.map((leader) => [leader.uid, leader]));
    memberships.docs.forEach((item) => {
      const membership = item.data();
      const existing = existingByUid.get(membership.uid);
      batch.set(doc(db, "chapters", state.chapterId, "leaders", membership.uid), {
        uid: membership.uid,
        chapterId: state.chapterId,
        displayName: membership.displayName,
        email: membership.email,
        role: membership.role,
        status: membership.status,
        agreementStatus: existing?.agreementStatus || "pending",
        trainingStatus: existing?.trainingStatus || "pending",
        startDate: existing?.startDate || membership.grantedAt || serverTimestamp(),
        visibleToChapter: existing?.visibleToChapter !== false,
        source: "membership_sync",
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
    if (!quiet) toast("Leadership synchronized", `${memberships.size} active membership record${memberships.size === 1 ? "" : "s"} were synchronized.`);
    if (!quiet) await loadWorkspace(state.chapterId);
  } catch (error) {
    console.error(error);
    if (!quiet) toast("Sync failed", "Firestore could not synchronize the chapter memberships.");
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icons.refresh} Sync memberships`;
    }
    if (quiet) throw error;
  }
}

async function updateRequirementStatus(select) {
  await updateDoc(doc(db, "chapters", state.chapterId, "requirements", select.dataset.id), {
    status: select.value,
    completedAt: select.value === "complete" ? serverTimestamp() : null,
    updatedAt: serverTimestamp()
  });
  toast("Requirement updated", "The chapter compliance center now reflects the new status.");
  await loadWorkspace(state.chapterId);
}

async function archiveRecord(type, id) {
  const isDocument = type === "document";
  await updateDoc(doc(db, "chapters", state.chapterId, isDocument ? "documents" : "notices", id), isDocument ? { status: "archived", updatedAt: serverTimestamp() } : { active: false, updatedAt: serverTimestamp() });
  toast(isDocument ? "Document archived" : "Notice archived", "The item is no longer visible to chapter leadership.");
  await loadWorkspace(state.chapterId);
}

function bindEvents() {
  document.querySelector("#p4a-load-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadWorkspace(event.currentTarget.chapterId.value);
  });
  document.querySelectorAll('[data-p4a-action="sign-out"]').forEach((button) => button.addEventListener("click", async () => {
    await signOut(auth);
    location.hash = "/login";
  }));
  document.querySelectorAll('[data-p4a-action="initialize"]').forEach((button) => button.addEventListener("click", () => initializeWorkspace(button)));
  document.querySelector("#p4a-profile-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfile(event.currentTarget);
  });
  document.querySelector("#p4a-requirement-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await addRequirement(event.currentTarget); } catch (error) { console.error(error); toast("Unable to add requirement", error.message); }
  });
  document.querySelector("#p4a-document-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await addDocument(event.currentTarget); } catch (error) { console.error(error); toast("Unable to publish document", error.message); }
  });
  document.querySelector("#p4a-notice-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await addNotice(event.currentTarget); } catch (error) { console.error(error); toast("Unable to publish notice", error.message); }
  });
  document.querySelectorAll('[data-p4a-action="sync-leaders"]').forEach((button) => button.addEventListener("click", () => syncLeaders(button)));
  document.querySelectorAll('[data-p4a-action="requirement-status"]').forEach((select) => select.addEventListener("change", async () => {
    try { await updateRequirementStatus(select); } catch (error) { console.error(error); toast("Update failed", "Firestore rejected the requirement status change."); }
  }));
  document.querySelectorAll('[data-p4a-action="archive-document"]').forEach((button) => button.addEventListener("click", async () => {
    try { await archiveRecord("document", button.dataset.id); } catch (error) { console.error(error); toast("Archive failed", "Firestore rejected the document update."); }
  }));
  document.querySelectorAll('[data-p4a-action="archive-notice"]').forEach((button) => button.addEventListener("click", async () => {
    try { await archiveRecord("notice", button.dataset.id); } catch (error) { console.error(error); toast("Archive failed", "Firestore rejected the notice update."); }
  }));
}

function augmentBasePortal() {
  if (!state.authReady || !ADMIN_ROLES.has(state.profile?.systemRole)) return;
  const sidebar = document.querySelector(".sidebar-nav");
  if (sidebar && !document.querySelector("[data-p4a-nav]")) {
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = "#/admin/chapter-workspaces";
    link.dataset.p4aNav = "true";
    link.innerHTML = `${icons.building}<span>Chapter workspaces</span>`;
    const accountLabel = Array.from(sidebar.querySelectorAll(".nav-label")).find((item) => item.textContent.trim() === "Account");
    sidebar.insertBefore(link, accountLabel || null);
  }
  const phase3AdminNav = document.querySelector(".phase3-admin-nav");
  if (phase3AdminNav && !document.querySelector("[data-p4a-phase3-nav]")) {
    const link = document.createElement("a");
    link.className = "phase3-admin-link";
    link.href = "#/admin/chapter-workspaces";
    link.dataset.p4aPhase3Nav = "true";
    link.innerHTML = `${icons.building}<span>Chapter workspaces</span>`;
    phase3AdminNav.append(link);
  }
}

window.addEventListener("hashchange", () => queueMicrotask(render));
const observer = new MutationObserver(() => {
  if (routeFromHash() === ROUTE && !document.querySelector("[data-phase4-admin-root]") && state.authReady) queueMicrotask(render);
  else queueMicrotask(augmentBasePortal);
});
observer.observe(app, { childList: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  await loadProfile(user);
  state.authReady = true;
  if (user && ADMIN_ROLES.has(state.profile?.systemRole)) {
    const saved = localStorage.getItem("tpp-admin-workspace-chapter");
    if (saved && routeFromHash() === ROUTE) await loadWorkspace(saved, { rerender: false });
  }
  render();
});
