import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
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
import {
  ATTACHMENT_FILE_LIMIT,
  deleteFirestoreAttachment,
  downloadFirestoreAttachment,
  saveFirestoreAttachment,
  validateAttachmentFiles
} from "./firestore-attachments.js";

const app = document.querySelector("#app");
const BUILD = "20260805.1";
const ADMIN_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin"]);
const CHAPTER_ROLES = new Set(["director", "adviser"]);
const ADMIN_ROUTES = new Set([
  "/admin/forms",
  "/admin/forms/template",
  "/admin/forms/assign",
  "/admin/forms/responses",
  "/admin/forms/review"
]);
const CHAPTER_ROUTES = new Set([
  "/chapter/forms",
  "/chapter/forms/fill",
  "/chapter/forms/view"
]);
const ALL_ROUTES = new Set([...ADMIN_ROUTES, ...CHAPTER_ROUTES]);
const TERMINAL_STATUSES = new Set(["approved", "denied", "waived", "expired", "superseded"]);
const REVIEWABLE_STATUSES = new Set(["submitted", "under_review", "changes_requested"]);

const FIELD_TYPES = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email address",
  phone: "Phone number",
  date: "Date",
  number: "Number",
  select: "Dropdown",
  radio: "Multiple choice",
  checklist: "Checkbox list",
  yes_no: "Yes or no",
  acknowledgment: "Required acknowledgment",
  file: "Supporting file"
};

const CATEGORY_LABELS = {
  agreement: "Agreement",
  institutional: "Institutional approval",
  renewal: "Renewal",
  compliance: "Compliance",
  leadership: "Leadership",
  incident: "Incident report",
  request: "Request",
  policy: "Policy acknowledgment",
  general: "General form"
};

const STATUS_LABELS = {
  assigned: "Not started",
  draft: "In progress",
  awaiting_adviser: "Awaiting Adviser",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  denied: "Denied",
  waived: "Waived",
  expired: "Expired",
  superseded: "Superseded"
};

const WORKFLOW_LABELS = {
  single_director: "Chapter Director",
  single_adviser: "Chapter Adviser",
  director_then_adviser: "Director, then Adviser"
};

const icons = {
  home: icon("M3 11 12 4l9 7v9H3z M9 20v-6h6v6"),
  forms: icon("M6 3h9l3 3v15H6z M14 3v5h5 M9 12h6 M9 16h6"),
  plus: icon("M12 5v14 M5 12h14"),
  edit: icon("M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4"),
  send: icon("M3 11.5 21 3l-6.5 18-3.5-7z M11 14 21 3"),
  check: icon("M5 12l4 4L19 6"),
  clock: icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v6l4 2"),
  alert: icon("M12 3 2 21h20z M12 9v5 M12 17h.01"),
  users: icon("M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M17 11a2.5 2.5 0 1 0 0-5 M15 15a5 5 0 0 1 6 5"),
  shield: icon("M12 3 4 6v5c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6z M9 12l2 2 4-4"),
  menu: icon("M4 7h16 M4 12h16 M4 17h16"),
  close: icon("M6 6l12 12 M18 6 6 18"),
  logout: icon("M10 17l5-5-5-5 M15 12H3 M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"),
  attachment: icon("M21 11.5 12.5 20a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.3-8.3"),
  download: icon("M12 3v12 M7 10l5 5 5-5 M5 21h14"),
  print: icon("M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v7H6z"),
  up: icon("M6 15l6-6 6 6"),
  down: icon("M6 9l6 6 6-6"),
  trash: icon("M4 7h16 M9 7V4h6v3 M7 7l1 14h8l1-14"),
  sun: icon("M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2"),
  moon: icon("M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z")
};

function icon(path) {
  return `<svg class="p9-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

const state = {
  authReady: false,
  user: null,
  profile: null,
  memberships: [],
  selectedChapterId: null,
  chapters: [],
  templates: [],
  assignments: [],
  responses: new Map(),
  currentAssignment: null,
  currentResponse: null,
  currentAttachments: [],
  currentHistory: [],
  builder: null,
  builderTemplateId: null,
  loading: false,
  rendering: false,
  mobileOpen: false,
  error: null
};

function route() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  return (path.startsWith("/") ? path : `/${path}`).replace(/\/+$/, "") || "/";
}

function params() {
  const raw = location.hash.replace(/^#/, "");
  return new URLSearchParams(raw.includes("?") ? raw.split("?").slice(1).join("?") : "");
}

function go(path) {
  state.mobileOpen = false;
  location.hash = path.startsWith("/") ? path : `/${path}`;
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fmt(value, fallback = "Not scheduled", withTime = false) {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function inputDate(value) {
  return value ? new Date(`${value}T12:00:00`) : null;
}

function dateValue(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function titleCase(value = "") {
  return String(value).replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (char) => char.toUpperCase());
}

function initials(value = "TP") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "TP").toUpperCase();
}

function roleLabel(role) {
  return ({ owner: "Owner", chapterAdmin: "Chapter Administrator", complianceAdmin: "Compliance Administrator", director: "Chapter Director", adviser: "Chapter Adviser" })[role] || titleCase(role || "User");
}

function tone(status) {
  if (["approved", "complete", "active", "waived"].includes(status)) return "success";
  if (["denied", "expired", "overdue"].includes(status)) return "danger";
  if (["submitted", "under_review", "changes_requested", "awaiting_adviser"].includes(status)) return "warning";
  return "neutral";
}

function badge(status, label = STATUS_LABELS[status] || titleCase(status || "Assigned")) {
  return `<span class="p9-badge p9-${tone(status)}">${esc(label)}</span>`;
}

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function slug(value) {
  return String(value || "form").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34) || "FORM";
}

function currentRole() {
  return state.profile?.systemRole || "";
}

function isOwner() {
  return currentRole() === "owner";
}

function isAdmin() {
  return ADMIN_ROLES.has(currentRole());
}

function selectedMembership() {
  return state.memberships.find((item) => item.chapterId === state.selectedChapterId) || null;
}

function assignmentStatus(item, response = state.responses.get(item.id)) {
  const status = response?.status || item.status || "assigned";
  const due = toDate(item.dueAt);
  if (!TERMINAL_STATUSES.has(status) && due && due.getTime() < Date.now()) return "overdue";
  return status;
}

function workflowRoles(workflow) {
  if (workflow === "single_director") return ["director"];
  if (workflow === "single_adviser") return ["adviser"];
  return ["director", "adviser"];
}

function initialStep(workflow) {
  return workflow === "single_adviser" ? "adviser" : "director";
}

function activeRoleForResponse(assignment, response) {
  return response?.currentStep || initialStep(assignment.workflow);
}

function canCurrentUserEdit(assignment, response) {
  if (!assignment || !CHAPTER_ROLES.has(selectedMembership()?.role)) return false;
  if (TERMINAL_STATUSES.has(response?.status || assignment.status)) return false;
  const role = selectedMembership().role;
  const step = activeRoleForResponse(assignment, response);
  if (response?.status === "submitted" || response?.status === "under_review") return false;
  return role === step;
}

async function loadProfile(user) {
  state.profile = null;
  if (!user) return;
  const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
  if (snapshot.exists()) state.profile = { id: snapshot.id, ...snapshot.data() };
}

async function loadMemberships() {
  state.memberships = [];
  if (!state.user) return;
  const records = [];
  const primary = state.profile?.primaryChapterId;
  if (primary) {
    try {
      const direct = await getDoc(doc(db, "chapterMemberships", `${primary}__${state.user.uid}`));
      if (direct.exists()) records.push({ id: direct.id, ...direct.data() });
    } catch (error) {
      console.warn("Primary form membership unavailable.", error);
    }
  }
  try {
    const snapshot = await getDocs(query(collection(db, "chapterMemberships"), where("uid", "==", state.user.uid)));
    snapshot.docs.forEach((item) => {
      if (!records.some((record) => record.id === item.id)) records.push({ id: item.id, ...item.data() });
    });
  } catch (error) {
    console.warn("Membership directory unavailable for forms.", error);
  }
  state.memberships = records.filter((item) => item.status === "active" && CHAPTER_ROLES.has(item.role));
  const saved = localStorage.getItem(`tpp-selected-chapter-${state.user.uid}`);
  const preferred = saved || primary;
  state.selectedChapterId = state.memberships.some((item) => item.chapterId === preferred)
    ? preferred
    : state.memberships[0]?.chapterId || null;
}

async function loadTemplates() {
  if (!state.user) return;
  const snapshot = await getDocs(collection(db, "formTemplates"));
  state.templates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
}

async function loadChapters() {
  if (!isAdmin()) return;
  const snapshot = await getDocs(collection(db, "chapters"));
  state.chapters = snapshot.docs.map((item) => ({ id: item.id, chapterId: item.id, ...item.data() }))
    .sort((a, b) => String(a.officialName || a.id).localeCompare(String(b.officialName || b.id)));
}

async function loadAssignments({ admin = false } = {}) {
  if (!state.user) return;
  let snapshot;
  if (admin) {
    snapshot = await getDocs(collection(db, "formAssignments"));
  } else if (state.selectedChapterId) {
    snapshot = await getDocs(query(collection(db, "formAssignments"), where("chapterId", "==", state.selectedChapterId)));
  } else {
    state.assignments = [];
    return;
  }
  state.assignments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (toDate(a.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER) - (toDate(b.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER));
  await loadResponseSummaries(state.assignments);
}

async function loadResponseSummaries(assignments) {
  state.responses = new Map();
  await Promise.all(assignments.map(async (assignment) => {
    try {
      const snapshot = await getDoc(doc(db, "formAssignments", assignment.id, "responses", "current"));
      if (snapshot.exists()) state.responses.set(assignment.id, { id: snapshot.id, ...snapshot.data() });
    } catch (error) {
      console.warn(`Unable to load response for ${assignment.id}.`, error);
    }
  }));
}

async function loadCurrentAssignment(id) {
  state.currentAssignment = null;
  state.currentResponse = null;
  state.currentAttachments = [];
  state.currentHistory = [];
  if (!id) return;
  const assignmentSnapshot = await getDoc(doc(db, "formAssignments", id));
  if (!assignmentSnapshot.exists()) throw new Error("This required form assignment could not be found.");
  state.currentAssignment = { id: assignmentSnapshot.id, ...assignmentSnapshot.data() };
  const responseRef = doc(db, "formAssignments", id, "responses", "current");
  const [responseSnapshot, attachmentSnapshot, historySnapshot] = await Promise.all([
    getDoc(responseRef),
    getDocs(collection(responseRef, "attachments")),
    getDocs(collection(responseRef, "history"))
  ]);
  state.currentResponse = responseSnapshot.exists() ? { id: responseSnapshot.id, ...responseSnapshot.data() } : null;
  state.currentAttachments = attachmentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  state.currentHistory = historySnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
}

async function loadBuilder(templateId) {
  if (state.builderTemplateId === templateId && state.builder) return;
  state.builderTemplateId = templateId || "new";
  if (!templateId) {
    state.builder = {
      templateId: "",
      title: "",
      category: "agreement",
      description: "",
      introduction: "",
      workflow: "single_director",
      requiresAdminReview: true,
      sections: [{ id: uid("section"), title: "Form information", description: "", fields: [] }]
    };
    return;
  }
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) throw new Error("This form template could not be found.");
  let schema = safeJson(template.draftSchemaJson, null);
  if (!schema && template.activeVersionId) {
    const version = await getDoc(doc(db, "formTemplates", template.id, "versions", template.activeVersionId));
    if (version.exists()) schema = safeJson(version.data().schemaJson, null);
  }
  state.builder = {
    templateId: template.id,
    title: template.title || "",
    category: template.category || "general",
    description: template.description || "",
    introduction: template.introduction || "",
    workflow: template.workflow || "single_director",
    requiresAdminReview: template.requiresAdminReview !== false,
    sections: schema?.sections?.length ? schema.sections : [{ id: uid("section"), title: "Form information", description: "", fields: [] }]
  };
}

function adminNavLink(path, label, graphic) {
  return `<a class="p7-nav-link ${route() === path ? "active" : ""}" href="#${path}">${graphic}<span>${esc(label)}</span></a>`;
}

function adminLayout(content, title = "Forms & Agreements") {
  const name = state.profile?.displayName || state.user?.email || "Administrator";
  return `<div class="p7-shell p9-admin-shell" data-phase9-root>
    <aside class="p7-sidebar ${state.mobileOpen ? "open" : ""}">
      <div class="p7-sidebar-brand"><a class="p7-brand" href="#/admin/dashboard"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Administration Console</small></span></a></div>
      <nav class="p7-nav">
        <span class="p7-nav-label">Management</span>
        ${adminNavLink("/admin/dashboard", "Dashboard", icons.home)}
        ${adminNavLink("/admin/chapters", "Chapters", icons.shield)}
        ${adminNavLink("/admin/users", "Users", icons.users)}
        ${adminNavLink("/admin/memberships", "Memberships", icons.users)}
        ${adminNavLink("/admin/registry", "Public registry", icons.shield)}
        ${adminNavLink("/admin/concerns", "Concern reports", icons.alert)}
        ${adminNavLink("/admin/audit", "Audit history", icons.forms)}
        ${adminNavLink("/admin/settings", "System settings", icons.shield)}
        ${adminNavLink("/admin/forms", "Forms & agreements", icons.forms)}
        <span class="p7-nav-label">Form operations</span>
        ${adminNavLink("/admin/forms/template", "Create form", icons.plus)}
        ${adminNavLink("/admin/forms/assign", "Assign forms", icons.send)}
        ${adminNavLink("/admin/forms/responses", "Review responses", icons.check)}
        <span class="p7-nav-label">Specialist workspaces</span>
        <a class="p7-nav-link" href="#/admin/invitations">${icons.plus}<span>Account invitations</span></a>
        <a class="p7-nav-link" href="#/admin/chapter-workspaces">${icons.shield}<span>Workspace setup</span></a>
        <a class="p7-nav-link" href="#/admin/submissions">${icons.forms}<span>Submission review</span></a>
        <a class="p7-nav-link" href="#/admin/support">${icons.alert}<span>Support queue</span></a>
        <a class="p7-nav-link" href="#/admin/communications">${icons.send}<span>Notice publishing</span></a>
      </nav>
      <div class="p7-sidebar-user"><div>${esc(initials(name))}</div><span><strong>${esc(name)}</strong><small>${esc(roleLabel(currentRole()))}</small></span></div>
    </aside>
    <div class="p7-main">
      <header class="p7-topbar"><button class="p7-icon-button p7-menu-button" type="button" data-p9-action="menu">${icons.menu}</button><div><span>Prayer Project Administration</span><strong>${esc(title)}</strong></div><div class="p7-topbar-actions"><button class="btn btn-secondary btn-small" type="button" data-p9-action="refresh">Refresh</button><button class="p7-icon-button" type="button" data-p9-action="sign-out">${icons.logout}</button></div></header>
      <main class="p7-content p9-admin-content" id="main-content">${content}</main>
    </div>
    <button class="p7-scrim ${state.mobileOpen ? "show" : ""}" type="button" data-p9-action="close-menu" aria-label="Close navigation"></button>
    <div class="toast-region" id="p9-toast-region" aria-live="assertive"></div>
  </div>`;
}

function chapterNavLink(path, label, graphic, count = 0) {
  const current = route();
  const active = current === path || (path === "/chapter/forms" && current.startsWith("/chapter/forms/"));
  return `<a class="${active ? "active" : ""}" href="#${path}">${graphic}<span>${esc(label)}</span>${count ? `<em>${count}</em>` : ""}</a>`;
}

function chapterLayout(content, title = "Required Forms") {
  const membership = selectedMembership();
  const chapterName = membership?.chapterName || state.selectedChapterId || "Chapter";
  const pending = state.assignments.filter((item) => !TERMINAL_STATUSES.has(assignmentStatus(item)) && assignmentStatus(item) !== "submitted" && assignmentStatus(item) !== "under_review").length;
  return `<div class="cp2-shell p9-chapter-shell" data-phase9-root>
    <aside class="cp2-sidebar ${state.mobileOpen ? "open" : ""}" id="p9-chapter-sidebar">
      <button class="p9-drawer-close" type="button" data-p9-action="close-menu" aria-label="Close navigation">${icons.close}</button>
      <a class="cp2-brand" href="#/chapter/overview"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Chapter Portal</small></span></a>
      <div class="cp2-current"><strong>${esc(chapterName)}</strong><span>${esc(state.selectedChapterId || "")}</span></div>
      <nav class="cp2-nav" aria-label="Chapter portal navigation">
        <span>Chapter</span>
        ${chapterNavLink("/chapter/overview", "Overview", icons.home)}
        ${chapterNavLink("/chapter/compliance", "Standing & compliance", icons.shield)}
        ${chapterNavLink("/chapter/leadership", "Leadership", icons.users)}
        ${chapterNavLink("/chapter/members", "Members", icons.users)}
        ${chapterNavLink("/chapter/documents", "Documents", icons.forms)}
        ${chapterNavLink("/chapter/notices", "Notices", icons.alert)}
        ${chapterNavLink("/chapter/forms", "Required forms", icons.forms, pending)}
        ${membership?.role === "adviser" ? chapterNavLink("/chapter/adviser", "Adviser oversight", icons.shield) : ""}
        <span>Operations</span>
        ${chapterNavLink("/chapter/workflows", "Reports & requests", icons.send)}
        ${chapterNavLink("/chapter/submissions", "Submission history", icons.clock)}
        ${chapterNavLink("/chapter/communications", "Communications", icons.forms)}
        ${chapterNavLink("/chapter/support", "Support center", icons.shield)}
        <span>Account</span>
        ${chapterNavLink("/profile", "My profile", icons.users)}
        <button type="button" data-p9-action="sign-out">${icons.logout}<span>Sign out</span></button>
      </nav>
    </aside>
    <section class="cp2-main">
      <header class="cp2-topbar"><button class="cp2-menu" type="button" data-p9-action="menu">${icons.menu}</button><div><span>Chapter Portal</span><strong>${esc(title)}</strong></div><div><span class="cp2-role">${esc(roleLabel(membership?.role))}</span><button class="cp2-theme" type="button" data-p9-action="theme">${document.documentElement.dataset.theme === "dark" ? icons.sun : icons.moon}</button></div></header>
      <main class="cp2-content p9-chapter-content" id="main-content">${content}</main>
    </section>
    <button class="p9-chapter-scrim ${state.mobileOpen ? "show" : ""}" type="button" data-p9-action="close-menu" aria-label="Close navigation"></button>
    <div class="cp2-toast-region" id="p9-toast-region" aria-live="assertive"></div>
  </div>`;
}

function heading(kicker, title, description, actions = "") {
  return `<header class="p9-heading"><div><p>${esc(kicker)}</p><h1>${esc(title)}</h1><span>${esc(description)}</span></div>${actions ? `<div class="p9-heading-actions">${actions}</div>` : ""}</header>`;
}

function empty(title, text, action = "") {
  return `<div class="p9-empty">${icons.forms}<strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
}

function templateCard(template) {
  return `<article class="p9-template-card"><div><span>${esc(CATEGORY_LABELS[template.category] || titleCase(template.category))}</span><h3>${esc(template.title)}</h3><p>${esc(template.description || "No description provided.")}</p></div><dl><div><dt>Status</dt><dd>${badge(template.status || "draft", titleCase(template.status || "draft"))}</dd></div><div><dt>Version</dt><dd>${template.currentVersionNumber || 0}</dd></div><div><dt>Workflow</dt><dd>${esc(WORKFLOW_LABELS[template.workflow] || "Not set")}</dd></div></dl><div class="p9-card-actions"><a class="btn btn-secondary" href="#/admin/forms/template?id=${encodeURIComponent(template.id)}">${icons.edit} Edit</a>${template.activeVersionId ? `<a class="btn btn-primary" href="#/admin/forms/assign?template=${encodeURIComponent(template.id)}">${icons.send} Assign</a>` : ""}</div></article>`;
}

function adminFormsPage() {
  const submitted = state.assignments.filter((item) => ["submitted", "under_review"].includes(assignmentStatus(item))).length;
  const overdue = state.assignments.filter((item) => assignmentStatus(item) === "overdue").length;
  const completed = state.assignments.filter((item) => assignmentStatus(item) === "approved").length;
  return adminLayout(`
    ${heading("Phase 9", "Required forms, agreements, and compliance assignments", "Create reusable forms, publish immutable versions, assign them to chapters, and review authenticated certifications.", `${isOwner() ? `<button class="btn btn-secondary" type="button" data-p9-action="install-starters">Install starter library</button><a class="btn btn-primary" href="#/admin/forms/template">${icons.plus} New form</a>` : ""}`)}
    <div id="p9-admin-alert"></div>
    <section class="p9-metrics"><article><span>Published templates</span><strong>${state.templates.filter((item) => item.activeVersionId).length}</strong><small>${state.templates.length} total templates</small></article><article><span>Awaiting review</span><strong>${submitted}</strong><small>Submitted chapter responses</small></article><article><span>Overdue</span><strong>${overdue}</strong><small>Past due and incomplete</small></article><article><span>Approved</span><strong>${completed}</strong><small>Completed assignments</small></article></section>
    <section class="p9-panel"><header><div><p class="p9-kicker">Template library</p><h2>Forms and agreements</h2></div>${isOwner() ? `<a href="#/admin/forms/template">Create template</a>` : ""}</header>${state.templates.length ? `<div class="p9-template-grid">${state.templates.map(templateCard).join("")}</div>` : empty("No form templates yet.", "Install the starter library or create your first form.", isOwner() ? `<button class="btn btn-primary" type="button" data-p9-action="install-starters">Install starter forms</button>` : "")}</section>
    <section class="p9-panel"><header><div><p class="p9-kicker">Assignment activity</p><h2>Recent required forms</h2></div><a href="#/admin/forms/responses">Open review queue</a></header>${state.assignments.length ? `<div class="p9-assignment-list">${state.assignments.slice(0, 12).map((item) => adminAssignmentRow(item)).join("")}</div>` : empty("No forms have been assigned.", "Create an assignment from a published template.")}</section>
  `);
}

function adminAssignmentRow(item) {
  const status = assignmentStatus(item);
  return `<article><div><strong>${esc(item.title)}</strong><span>${esc(item.chapterName || item.chapterId)} · Due ${esc(fmt(item.dueAt))}</span></div>${badge(status)}<a class="btn btn-secondary btn-small" href="#/admin/forms/review?id=${encodeURIComponent(item.id)}">Review</a></article>`;
}

function builderField(field, sectionIndex, fieldIndex, workflow) {
  const roleOptions = workflow === "director_then_adviser"
    ? `<option value="director" ${field.role === "director" ? "selected" : ""}>Director section</option><option value="adviser" ${field.role === "adviser" ? "selected" : ""}>Adviser section</option>`
    : `<option value="${workflow === "single_adviser" ? "adviser" : "director"}" selected>${workflow === "single_adviser" ? "Adviser" : "Director"}</option>`;
  return `<article class="p9-builder-field" data-section-index="${sectionIndex}" data-field-index="${fieldIndex}">
    <header><strong>Field ${fieldIndex + 1}</strong><div><button type="button" data-p9-action="field-up" title="Move up">${icons.up}</button><button type="button" data-p9-action="field-down" title="Move down">${icons.down}</button><button type="button" data-p9-action="remove-field" title="Remove">${icons.trash}</button></div></header>
    <div class="p9-form-grid"><label>Field type<select data-builder="field-type">${Object.entries(FIELD_TYPES).map(([value, label]) => `<option value="${value}" ${field.type === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label><label>Completed by<select data-builder="field-role">${roleOptions}</select></label></div>
    <label>Question or label<input data-builder="field-label" value="${esc(field.label || "")}" maxlength="240" placeholder="Enter the question shown to the chapter"></label>
    <label>Help text<input data-builder="field-help" value="${esc(field.help || "")}" maxlength="500" placeholder="Optional explanation or instructions"></label>
    <label class="p9-options-label ${["select", "radio", "checklist"].includes(field.type) ? "show" : ""}">Answer choices<textarea data-builder="field-options" rows="3" placeholder="One option per line">${esc((field.options || []).join("\n"))}</textarea></label>
    <div class="p9-form-grid"><label>Minimum length<input data-builder="field-min" type="number" min="0" max="5000" value="${Number(field.minLength || 0)}"></label><label>Maximum length<input data-builder="field-max" type="number" min="1" max="20000" value="${Number(field.maxLength || 1000)}"></label></div>
    <label class="p9-check"><input data-builder="field-required" type="checkbox" ${field.required !== false ? "checked" : ""}><span>Required before submission</span></label>
  </article>`;
}

function templateEditorPage() {
  if (!isOwner()) return adminLayout(empty("Owner access required.", "Only the Owner may create or publish form templates."), "Form Template");
  const builder = state.builder;
  if (!builder) return adminLayout(loadingBlock("Loading form builder…"), "Form Template");
  return adminLayout(`
    ${heading("Form builder", builder.templateId ? `Edit ${builder.title || "form template"}` : "Create a required form", "Save drafts freely. Publishing creates a locked version so previously certified language can never be changed.", `<a class="btn btn-secondary" href="#/admin/forms">Cancel</a>`)}
    <div id="p9-template-alert"></div>
    <form id="p9-template-form" class="p9-builder-shell" novalidate>
      <section class="p9-panel p9-template-settings"><header><div><p class="p9-kicker">Template information</p><h2>Form settings</h2></div>${builder.templateId ? `<span class="p9-id">${esc(builder.templateId)}</span>` : ""}</header>
        <div class="p9-form-grid"><label>Form title<input name="title" value="${esc(builder.title)}" maxlength="160" required></label><label>Category<select name="category">${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}" ${builder.category === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label></div>
        <label>Summary<textarea name="description" rows="3" maxlength="1000" required>${esc(builder.description)}</textarea></label>
        <label>Opening instructions<textarea name="introduction" rows="5" maxlength="4000">${esc(builder.introduction)}</textarea></label>
        <div class="p9-form-grid"><label>Completion workflow<select name="workflow"><option value="single_director" ${builder.workflow === "single_director" ? "selected" : ""}>Chapter Director completes</option><option value="single_adviser" ${builder.workflow === "single_adviser" ? "selected" : ""}>Chapter Adviser completes</option><option value="director_then_adviser" ${builder.workflow === "director_then_adviser" ? "selected" : ""}>Director completes, then Adviser certifies</option></select></label><label class="p9-check p9-check-card"><input name="requiresAdminReview" type="checkbox" ${builder.requiresAdminReview !== false ? "checked" : ""}><span><strong>Administrative approval required</strong><small>Recommended for agreements, institutional approval, and renewals.</small></span></label></div>
      </section>
      <section class="p9-builder-sections">${builder.sections.map((section, sectionIndex) => `<article class="p9-builder-section" data-section-index="${sectionIndex}"><header><div><span>Section ${sectionIndex + 1}</span><input data-builder="section-title" value="${esc(section.title || "")}" maxlength="160" placeholder="Section title"></div><button type="button" data-p9-action="remove-section">${icons.trash} Remove section</button></header><label>Section instructions<textarea data-builder="section-description" rows="2" maxlength="1000">${esc(section.description || "")}</textarea></label><div class="p9-builder-fields">${section.fields.length ? section.fields.map((field, fieldIndex) => builderField(field, sectionIndex, fieldIndex, builder.workflow)).join("") : `<div class="p9-builder-empty">No questions in this section yet.</div>`}</div><button class="btn btn-secondary" type="button" data-p9-action="add-field">${icons.plus} Add question</button></article>`).join("")}</section>
      <button class="btn btn-secondary p9-add-section" type="button" data-p9-action="add-section">${icons.plus} Add section</button>
      <footer class="p9-sticky-actions"><span>Publishing creates a permanent, immutable version.</span><div><button class="btn btn-secondary" type="button" data-p9-action="save-template-draft">Save draft</button><button class="btn btn-primary" type="button" data-p9-action="publish-template">Publish new version</button></div></footer>
    </form>
  `, "Form Template");
}

function assignmentPage() {
  if (!isOwner()) return adminLayout(empty("Owner access required.", "Only the Owner may send required form assignments."), "Assign Forms");
  const published = state.templates.filter((item) => item.activeVersionId);
  const selectedTemplateId = params().get("template") || published[0]?.id || "";
  return adminLayout(`
    ${heading("Assignment campaign", "Send a required form to chapters", "Each selected chapter receives a private assignment tied to the exact published form version.")}
    <div id="p9-assignment-alert"></div>
    <section class="p9-form-panel"><form id="p9-assignment-form" class="p9-form" novalidate>
      <label>Published form<select name="templateId" required><option value="">Select a form</option>${published.map((item) => `<option value="${esc(item.id)}" ${item.id === selectedTemplateId ? "selected" : ""}>${esc(item.title)} · Version ${item.currentVersionNumber}</option>`).join("")}</select></label>
      <div class="p9-form-grid"><label>Available date<input name="availableDate" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label><label>Due date<input name="dueDate" type="date" required></label></div>
      <fieldset><legend>Recipients</legend><label class="p9-radio-card"><input type="radio" name="scope" value="all_active" checked><span><strong>All active chapters</strong><small>Create one assignment for every active or conditionally approved chapter.</small></span></label><label class="p9-radio-card"><input type="radio" name="scope" value="selected"><span><strong>Selected chapters</strong><small>Enter Permanent Chapter IDs below.</small></span></label></fieldset>
      <label>Selected Permanent Chapter IDs<textarea name="chapterIds" rows="5" placeholder="TPP-CH-ABC\nTPP-CH-123"></textarea></label>
      <div class="p9-form-grid"><label class="p9-check p9-check-card"><input name="required" type="checkbox" checked><span><strong>Required compliance item</strong><small>Adds a linked item to Standing & Compliance.</small></span></label><label class="p9-check p9-check-card"><input name="requiresAdminReview" type="checkbox" checked><span><strong>Administrative review</strong><small>Required forms always remain subject to approval.</small></span></label></div>
      <label>Instructions for this campaign<textarea name="instructions" rows="4" maxlength="2000" placeholder="Add deadline-specific directions or context."></textarea></label>
      <div class="p9-form-actions"><a class="btn btn-secondary" href="#/admin/forms">Cancel</a><button class="btn btn-primary" type="submit">${icons.send} Create assignments</button></div>
    </form></section>
  `, "Assign Forms");
}

function responsesPage() {
  const filter = params().get("status") || "review";
  const filtered = state.assignments.filter((item) => {
    const status = assignmentStatus(item);
    if (filter === "all") return true;
    if (filter === "review") return ["submitted", "under_review"].includes(status);
    if (filter === "overdue") return status === "overdue";
    return status === filter;
  });
  return adminLayout(`
    ${heading("Response review", "Required-form response queue", "Review certifications, return responses for changes, approve compliance evidence, or waive a requirement.")}
    <div class="p9-filter"><label>Status<select id="p9-response-filter"><option value="review" ${filter === "review" ? "selected" : ""}>Awaiting review</option><option value="overdue" ${filter === "overdue" ? "selected" : ""}>Overdue</option><option value="changes_requested" ${filter === "changes_requested" ? "selected" : ""}>Changes requested</option><option value="approved" ${filter === "approved" ? "selected" : ""}>Approved</option><option value="denied" ${filter === "denied" ? "selected" : ""}>Denied</option><option value="all" ${filter === "all" ? "selected" : ""}>All assignments</option></select></label><span>${filtered.length} assignment${filtered.length === 1 ? "" : "s"}</span></div>
    <section class="p9-panel">${filtered.length ? `<div class="p9-assignment-table">${filtered.map(adminAssignmentRow).join("")}</div>` : empty("No matching responses.", "Change the filter or wait for chapters to submit their required forms.")}</section>
  `, "Response Review");
}

function chapterFormsPage() {
  const role = selectedMembership()?.role;
  const relevant = state.assignments.filter((item) => workflowRoles(item.workflow).includes(role));
  const actionItems = relevant.filter((item) => ["assigned", "draft", "changes_requested", "awaiting_adviser", "overdue"].includes(assignmentStatus(item)));
  return chapterLayout(`
    ${heading("Required forms", "Forms, agreements, and certifications", "Complete assigned forms inside the portal. Drafts save privately, and submitted versions remain part of the chapter record.")}
    ${actionItems.length ? `<section class="p9-action-banner">${icons.alert}<div><strong>${actionItems.length} form${actionItems.length === 1 ? " requires" : "s require"} attention.</strong><span>Open each assignment to review its due date and completion step.</span></div></section>` : ""}
    <section class="p9-chapter-form-list">${relevant.length ? relevant.map(chapterAssignmentCard).join("") : empty("No required forms are assigned.", "New agreements, renewals, and institutional forms will appear here when issued by The Prayer Project.")}</section>
  `);
}

function chapterAssignmentCard(item) {
  const response = state.responses.get(item.id);
  const status = assignmentStatus(item, response);
  const role = selectedMembership()?.role;
  const step = activeRoleForResponse(item, response);
  const canEdit = canCurrentUserEdit(item, response);
  const actionLabel = canEdit ? (response ? "Continue form" : "Start form") : "View record";
  const href = canEdit ? `#/chapter/forms/fill?id=${encodeURIComponent(item.id)}` : `#/chapter/forms/view?id=${encodeURIComponent(item.id)}`;
  return `<article class="p9-chapter-form-card ${status === "overdue" ? "overdue" : ""}"><header><span>${esc(CATEGORY_LABELS[item.category] || titleCase(item.category))}</span>${badge(status)}</header><h2>${esc(item.title)}</h2><p>${esc(item.instructions || item.description || "Complete this required chapter form.")}</p><dl><div><dt>Due</dt><dd>${esc(fmt(item.dueAt))}</dd></div><div><dt>Workflow</dt><dd>${esc(WORKFLOW_LABELS[item.workflow])}</dd></div><div><dt>Current step</dt><dd>${esc(step === "review" ? "Administrative review" : roleLabel(step))}</dd></div></dl>${response?.reviewNote ? `<div class="p9-review-note"><strong>Administrative note</strong><span>${esc(response.reviewNote)}</span></div>` : ""}<a class="btn ${canEdit ? "btn-primary" : "btn-secondary"}" href="${href}">${actionLabel}</a></article>`;
}

function schemaForAssignment(assignment) {
  const schema = safeJson(assignment.schemaJson, { sections: [] });
  return Array.isArray(schema.sections) ? schema : { sections: [] };
}

function answersForRole(response, role) {
  return safeJson(role === "adviser" ? response?.adviserAnswersJson : response?.directorAnswersJson, {});
}

function renderReadOnlyValue(field, value) {
  if (field.type === "acknowledgment") return value ? "Acknowledged" : "Not acknowledged";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "No answer";
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value ?? "").trim() || "No answer";
}

function readOnlySections(assignment, response, roleFilter = null) {
  const schema = schemaForAssignment(assignment);
  const roleAnswers = {
    director: answersForRole(response, "director"),
    adviser: answersForRole(response, "adviser")
  };
  return schema.sections.map((section) => {
    const fields = section.fields.filter((field) => !roleFilter || field.role === roleFilter);
    if (!fields.length) return "";
    return `<section class="p9-record-section"><header><h2>${esc(section.title)}</h2>${section.description ? `<p>${esc(section.description)}</p>` : ""}</header><dl>${fields.map((field) => `<div><dt>${esc(field.label)}</dt><dd>${esc(renderReadOnlyValue(field, roleAnswers[field.role || "director"]?.[field.id]))}</dd></div>`).join("")}</dl></section>`;
  }).join("");
}

function fieldInput(field, value) {
  const name = `field__${field.id}`;
  const required = field.required !== false ? "required" : "";
  const min = Number(field.minLength || 0);
  const max = Number(field.maxLength || 1000);
  const help = field.help ? `<small>${esc(field.help)}</small>` : "";
  if (field.type === "long_text") return `<label class="p9-answer-field"><span>${esc(field.label)}${field.required !== false ? " *" : ""}</span>${help}<textarea name="${esc(name)}" rows="6" minlength="${min}" maxlength="${max}" ${required}>${esc(value || "")}</textarea></label>`;
  if (["email", "phone", "date", "number"].includes(field.type)) {
    const type = field.type === "phone" ? "tel" : field.type;
    return `<label class="p9-answer-field"><span>${esc(field.label)}${field.required !== false ? " *" : ""}</span>${help}<input name="${esc(name)}" type="${type}" value="${esc(value ?? "")}" ${required}></label>`;
  }
  if (field.type === "select") return `<label class="p9-answer-field"><span>${esc(field.label)}${field.required !== false ? " *" : ""}</span>${help}<select name="${esc(name)}" ${required}><option value="">Select an answer</option>${(field.options || []).map((option) => `<option value="${esc(option)}" ${value === option ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`;
  if (field.type === "radio") return `<fieldset class="p9-answer-field"><legend>${esc(field.label)}${field.required !== false ? " *" : ""}</legend>${help}<div class="p9-choice-list">${(field.options || []).map((option) => `<label><input name="${esc(name)}" type="radio" value="${esc(option)}" ${value === option ? "checked" : ""} ${required}><span>${esc(option)}</span></label>`).join("")}</div></fieldset>`;
  if (field.type === "checklist") {
    const selected = Array.isArray(value) ? value : [];
    return `<fieldset class="p9-answer-field"><legend>${esc(field.label)}${field.required !== false ? " *" : ""}</legend>${help}<div class="p9-choice-list">${(field.options || []).map((option) => `<label><input name="${esc(name)}" type="checkbox" value="${esc(option)}" ${selected.includes(option) ? "checked" : ""}><span>${esc(option)}</span></label>`).join("")}</div></fieldset>`;
  }
  if (field.type === "yes_no") return `<fieldset class="p9-answer-field"><legend>${esc(field.label)}${field.required !== false ? " *" : ""}</legend>${help}<div class="p9-choice-list p9-inline-choices"><label><input name="${esc(name)}" type="radio" value="yes" ${value === "yes" ? "checked" : ""} ${required}><span>Yes</span></label><label><input name="${esc(name)}" type="radio" value="no" ${value === "no" ? "checked" : ""} ${required}><span>No</span></label></div></fieldset>`;
  if (field.type === "acknowledgment") return `<label class="p9-cert-check"><input name="${esc(name)}" type="checkbox" value="true" ${value === true ? "checked" : ""} ${required}><span><strong>${esc(field.label)}</strong>${help}</span></label>`;
  if (field.type === "file") return `<label class="p9-file-field">${icons.attachment}<span><strong>${esc(field.label)}</strong><small>${esc(field.help || "PDF, Word, PNG, or JPEG. Maximum 2 MB.")}</small></span><input name="${esc(name)}" data-field-id="${esc(field.id)}" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"></label>`;
  return `<label class="p9-answer-field"><span>${esc(field.label)}${field.required !== false ? " *" : ""}</span>${help}<input name="${esc(name)}" type="text" value="${esc(value || "")}" minlength="${min}" maxlength="${max}" ${required}></label>`;
}

function attachmentsBlock(editable = false) {
  if (!state.currentAttachments.length) return "";
  return `<section class="p9-response-attachments"><h2>Supporting files</h2><div>${state.currentAttachments.map((item) => `<article>${icons.attachment}<span><strong>${esc(item.fileName)}</strong><small>${Math.max(1, Math.round((item.size || 0) / 1024))} KB</small></span><button class="btn btn-secondary btn-small" type="button" data-p9-action="download-attachment" data-id="${esc(item.id)}">${icons.download} Download</button>${editable && item.uploadedByUid === state.user?.uid ? `<button class="btn btn-secondary btn-small" type="button" data-p9-action="delete-attachment" data-id="${esc(item.id)}">Remove</button>` : ""}</article>`).join("")}</div></section>`;
}

function fillFormPage({ readOnly = false } = {}) {
  const assignment = state.currentAssignment;
  const response = state.currentResponse;
  if (!assignment) return chapterLayout(empty("Form unavailable.", "The requested assignment could not be loaded."));
  const role = selectedMembership()?.role;
  const step = activeRoleForResponse(assignment, response);
  const editable = !readOnly && canCurrentUserEdit(assignment, response);
  const answers = answersForRole(response, role);
  const schema = schemaForAssignment(assignment);
  const roleSections = schema.sections.map((section) => ({ ...section, fields: section.fields.filter((field) => (field.role || initialStep(assignment.workflow)) === role) })).filter((section) => section.fields.length);
  const priorRecord = assignment.workflow === "director_then_adviser" && role === "adviser" && response?.directorAnswersJson
    ? `<section class="p9-prior-response"><header><p class="p9-kicker">Director submission</p><h2>Review the Director's completed section</h2></header>${readOnlySections(assignment, response, "director")}</section>`
    : "";
  const certification = role === "adviser"
    ? { name: response?.adviserCertificationName || state.profile?.displayName || "", title: response?.adviserCertificationTitle || "Chapter Adviser", certifiedAt: response?.adviserCertifiedAt }
    : { name: response?.directorCertificationName || state.profile?.displayName || "", title: response?.directorCertificationTitle || "Chapter Director", certifiedAt: response?.directorCertifiedAt };
  const status = assignmentStatus(assignment, response);
  if (!editable || readOnly) {
    return chapterLayout(`
      ${heading("Completed record", assignment.title, assignment.instructions || assignment.description || "Authenticated chapter form response.", `<button class="btn btn-secondary" type="button" data-p9-action="print">${icons.print} Print record</button>`)}
      <section class="p9-record-summary"><div>${badge(status)}</div><dl><div><dt>Chapter</dt><dd>${esc(assignment.chapterName)}</dd></div><div><dt>Due date</dt><dd>${esc(fmt(assignment.dueAt))}</dd></div><div><dt>Submitted</dt><dd>${esc(fmt(response?.submittedAt, "Not submitted", true))}</dd></div><div><dt>Form version</dt><dd>${assignment.versionNumber}</dd></div></dl></section>
      ${assignment.introduction ? `<section class="p9-panel p9-introduction"><p>${esc(assignment.introduction)}</p></section>` : ""}
      ${readOnlySections(assignment, response)}
      ${certificationRecord(response)}
      ${attachmentsBlock(false)}
      ${response?.reviewNote ? `<section class="p9-review-note p9-record-note"><strong>Administrative review note</strong><span>${esc(response.reviewNote)}</span></section>` : ""}
      <div class="p9-form-actions"><a class="btn btn-secondary" href="#/chapter/forms">Return to required forms</a>${canCurrentUserEdit(assignment, response) ? `<a class="btn btn-primary" href="#/chapter/forms/fill?id=${encodeURIComponent(assignment.id)}">Continue form</a>` : ""}</div>
    `, "Form Record");
  }
  if (step !== role) {
    return chapterLayout(`${heading("Required form", assignment.title, assignment.description || "Complete the assigned chapter form.")}${empty("Waiting for the next completion step.", `This form is currently assigned to the ${roleLabel(step)}.`)}`, "Required Form");
  }
  return chapterLayout(`
    ${heading("Required form", assignment.title, assignment.instructions || assignment.description || "Complete all required fields and certify the response.", badge(status))}
    ${response?.reviewNote ? `<section class="p9-action-banner">${icons.alert}<div><strong>Changes were requested.</strong><span>${esc(response.reviewNote)}</span></div></section>` : ""}
    ${priorRecord}
    <form id="p9-response-form" class="p9-response-form" novalidate>
      <input type="hidden" name="assignmentId" value="${esc(assignment.id)}">
      ${assignment.introduction ? `<section class="p9-panel p9-introduction"><p>${esc(assignment.introduction)}</p></section>` : ""}
      ${roleSections.map((section) => `<section class="p9-answer-section"><header><h2>${esc(section.title)}</h2>${section.description ? `<p>${esc(section.description)}</p>` : ""}</header><div>${section.fields.map((field) => fieldInput(field, answers[field.id])).join("")}</div></section>`).join("")}
      ${attachmentsBlock(true)}
      <section class="p9-certification"><p class="p9-kicker">Authenticated certification</p><h2>Certify this response</h2><p>I certify that the information provided is complete and accurate and that I am authorized to submit this form for the chapter or institution.</p><div class="p9-form-grid"><label>Typed full name<input name="certificationName" value="${esc(certification.name)}" maxlength="100"></label><label>Official title<input name="certificationTitle" value="${esc(certification.title)}" maxlength="100"></label></div><label class="p9-cert-check"><input name="certificationConfirmed" type="checkbox"><span><strong>I agree to the certification above.</strong><small>Your authenticated account, date, chapter, role, and exact form version will be recorded.</small></span></label></section>
      <div id="p9-response-alert"></div>
      <footer class="p9-sticky-actions"><span>Draft answers remain private until submitted.</span><div><a class="btn btn-secondary" href="#/chapter/forms">Cancel</a><button class="btn btn-secondary" type="button" data-p9-action="save-response-draft">Save draft</button><button class="btn btn-primary" type="button" data-p9-action="submit-response">${icons.send} Submit certification</button></div></footer>
    </form>
  `, "Complete Required Form");
}

function certificationRecord(response) {
  if (!response) return "";
  const records = [];
  if (response.directorCertifiedAt) records.push(`<article><strong>${esc(response.directorCertificationName)}</strong><span>${esc(response.directorCertificationTitle)} · Chapter Director</span><small>Certified ${esc(fmt(response.directorCertifiedAt, "", true))}</small></article>`);
  if (response.adviserCertifiedAt) records.push(`<article><strong>${esc(response.adviserCertificationName)}</strong><span>${esc(response.adviserCertificationTitle)} · Chapter Adviser</span><small>Certified ${esc(fmt(response.adviserCertifiedAt, "", true))}</small></article>`);
  return records.length ? `<section class="p9-certification-record"><h2>Certifications</h2><div>${records.join("")}</div></section>` : "";
}

function reviewPage() {
  const assignment = state.currentAssignment;
  const response = state.currentResponse;
  if (!assignment) return adminLayout(empty("Assignment unavailable.", "The requested form assignment could not be found."), "Review Response");
  const status = assignmentStatus(assignment, response);
  return adminLayout(`
    ${heading("Administrative review", assignment.title, `${assignment.chapterName} · ${assignment.chapterId}`, `<button class="btn btn-secondary" type="button" data-p9-action="print">${icons.print} Print</button>`)}
    <section class="p9-record-summary"><div>${badge(status)}</div><dl><div><dt>Chapter</dt><dd>${esc(assignment.chapterName)}</dd></div><div><dt>Workflow</dt><dd>${esc(WORKFLOW_LABELS[assignment.workflow])}</dd></div><div><dt>Due date</dt><dd>${esc(fmt(assignment.dueAt))}</dd></div><div><dt>Version</dt><dd>${assignment.versionNumber}</dd></div></dl></section>
    ${response ? `${readOnlySections(assignment, response)}${certificationRecord(response)}${attachmentsBlock(false)}` : empty("No response has been saved.", "The chapter has not started this assignment.")}
    <section class="p9-panel p9-review-panel"><header><div><p class="p9-kicker">Decision</p><h2>Review and disposition</h2></div></header><form id="p9-review-form"><label>Administrative note<textarea name="reviewNote" rows="5" maxlength="3000" placeholder="Required when requesting changes or denying the response.">${esc(response?.reviewNote || assignment.reviewNote || "")}</textarea></label><label>Return changes to<select name="returnRole"><option value="director">Chapter Director</option><option value="adviser">Chapter Adviser</option></select></label><div id="p9-review-alert"></div><div class="p9-review-actions"><button class="btn btn-secondary" type="button" data-p9-review="changes_requested">Request changes</button><button class="btn btn-secondary" type="button" data-p9-review="denied">Deny</button><button class="btn btn-secondary" type="button" data-p9-review="waived">Waive requirement</button><button class="btn btn-primary" type="button" data-p9-review="approved">${icons.check} Approve</button></div></form></section>
    ${historyBlock()}
  `, "Review Response");
}

function historyBlock() {
  return `<section class="p9-panel p9-history"><header><div><p class="p9-kicker">Audit trail</p><h2>Assignment history</h2></div></header>${state.currentHistory.length ? `<ol>${state.currentHistory.map((item) => `<li><div></div><section><strong>${esc(titleCase(item.eventType))}</strong><span>${esc(item.actorName || item.actorUid)} · ${esc(fmt(item.createdAt, "", true))}</span>${item.note ? `<p>${esc(item.note)}</p>` : ""}</section></li>`).join("")}</ol>` : `<p>No history events have been recorded yet.</p>`}</section>`;
}

function loadingBlock(label = "Loading…") {
  return `<div class="p9-loading"><div class="spinner"></div><strong>${esc(label)}</strong></div>`;
}

function gate(message, admin = false) {
  const content = `<main class="p9-gate" data-phase9-root><section><img src="assets/brand-mark.svg" alt=""><p>Protected forms</p><h1>Access unavailable.</h1><span>${esc(message)}</span><a class="btn btn-primary" href="${admin ? "#/admin/dashboard" : "#/chapter/overview"}">Return to portal</a></section></main>`;
  return content;
}

function captureBuilderFromDom() {
  const form = document.querySelector("#p9-template-form");
  if (!form || !state.builder) return;
  state.builder.title = form.title.value.trim();
  state.builder.category = form.category.value;
  state.builder.description = form.description.value.trim();
  state.builder.introduction = form.introduction.value.trim();
  state.builder.workflow = form.workflow.value;
  state.builder.requiresAdminReview = form.requiresAdminReview.checked;
  document.querySelectorAll(".p9-builder-section").forEach((sectionElement) => {
    const sectionIndex = Number(sectionElement.dataset.sectionIndex);
    const section = state.builder.sections[sectionIndex];
    if (!section) return;
    section.title = sectionElement.querySelector('[data-builder="section-title"]')?.value.trim() || "";
    section.description = sectionElement.querySelector('[data-builder="section-description"]')?.value.trim() || "";
    sectionElement.querySelectorAll(".p9-builder-field").forEach((fieldElement) => {
      const fieldIndex = Number(fieldElement.dataset.fieldIndex);
      const field = section.fields[fieldIndex];
      if (!field) return;
      field.type = fieldElement.querySelector('[data-builder="field-type"]')?.value || "short_text";
      field.role = fieldElement.querySelector('[data-builder="field-role"]')?.value || initialStep(state.builder.workflow);
      field.label = fieldElement.querySelector('[data-builder="field-label"]')?.value.trim() || "";
      field.help = fieldElement.querySelector('[data-builder="field-help"]')?.value.trim() || "";
      field.options = (fieldElement.querySelector('[data-builder="field-options"]')?.value || "").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 30);
      field.minLength = Math.max(0, Number(fieldElement.querySelector('[data-builder="field-min"]')?.value || 0));
      field.maxLength = Math.max(1, Number(fieldElement.querySelector('[data-builder="field-max"]')?.value || 1000));
      field.required = Boolean(fieldElement.querySelector('[data-builder="field-required"]')?.checked);
    });
  });
}

function validateBuilder() {
  captureBuilderFromDom();
  const builder = state.builder;
  if (!builder.title || builder.title.length < 3) throw new Error("Enter a form title of at least three characters.");
  if (!builder.description || builder.description.length < 10) throw new Error("Add a clear form summary of at least ten characters.");
  if (!builder.sections.length) throw new Error("Add at least one form section.");
  const fields = builder.sections.flatMap((section) => section.fields);
  if (!fields.length) throw new Error("Add at least one question to the form.");
  for (const section of builder.sections) {
    if (!section.title.trim()) throw new Error("Every form section needs a title.");
    for (const field of section.fields) {
      if (!field.label.trim()) throw new Error("Every form field needs a question or label.");
      if (["select", "radio", "checklist"].includes(field.type) && field.options.length < 2) throw new Error(`${field.label} needs at least two answer choices.`);
      if (builder.workflow !== "director_then_adviser") field.role = initialStep(builder.workflow);
    }
  }
  return builder;
}

async function saveTemplate({ publish = false } = {}) {
  if (!isOwner()) return;
  const builder = validateBuilder();
  const existing = builder.templateId ? state.templates.find((item) => item.id === builder.templateId) : null;
  const templateId = builder.templateId || `FORM-${slug(builder.title)}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const nextVersion = Number(existing?.currentVersionNumber || 0) + 1;
  const schemaJson = JSON.stringify({ sections: builder.sections });
  const templateRef = doc(db, "formTemplates", templateId);
  const batch = writeBatch(db);
  batch.set(templateRef, {
    templateId,
    title: builder.title,
    category: builder.category,
    description: builder.description,
    introduction: builder.introduction,
    workflow: builder.workflow,
    audienceRoles: workflowRoles(builder.workflow),
    requiresAdminReview: builder.requiresAdminReview,
    status: publish ? "published" : (existing?.status || "draft"),
    activeVersionId: publish ? `v${nextVersion}` : (existing?.activeVersionId || ""),
    currentVersionNumber: publish ? nextVersion : Number(existing?.currentVersionNumber || 0),
    draftSchemaJson: schemaJson,
    createdByUid: existing?.createdByUid || state.user.uid,
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedByUid: state.user.uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  if (publish) {
    batch.set(doc(templateRef, "versions", `v${nextVersion}`), {
      templateId,
      versionId: `v${nextVersion}`,
      versionNumber: nextVersion,
      title: builder.title,
      category: builder.category,
      description: builder.description,
      introduction: builder.introduction,
      workflow: builder.workflow,
      audienceRoles: workflowRoles(builder.workflow),
      requiresAdminReview: builder.requiresAdminReview,
      schemaJson,
      locked: true,
      publishedByUid: state.user.uid,
      publishedByName: state.profile?.displayName || state.user.email,
      publishedAt: serverTimestamp()
    });
    batch.set(doc(collection(db, "auditLogs")), {
      actorUid: state.user.uid,
      action: "form_template_published",
      targetType: "formTemplate",
      targetId: templateId,
      summary: `Published ${builder.title} version ${nextVersion}.`,
      createdAt: serverTimestamp()
    });
  }
  await batch.commit();
  builder.templateId = templateId;
  state.builderTemplateId = templateId;
  await loadTemplates();
  setAlert("p9-template-alert", "success", publish ? "Form published" : "Draft saved", publish ? `Version ${nextVersion} is locked and ready to assign.` : "Your unpublished changes were saved.");
  if (publish) setTimeout(() => go(`/admin/forms/assign?template=${encodeURIComponent(templateId)}`), 900);
}

function starterTemplates() {
  return [
    {
      id: "FORM-INSTITUTIONAL-APPROVAL",
      title: "Institutional Approval Form",
      category: "institutional",
      description: "Records the host institution's authorization, approved operating conditions, and Adviser certification.",
      introduction: "Complete this form using current information from the chapter's host institution. Do not include unnecessary sensitive information.",
      workflow: "single_adviser",
      sections: [
        section("institution", "Host institution", "Identify the institution authorizing the chapter.", [
          field("institution_name", "short_text", "Legal or official institution name", "adviser", true),
          field("institution_type", "select", "Institution type", "adviser", true, ["School", "Church", "College or university", "Community organization", "Other"]),
          field("institution_address", "long_text", "Institution mailing address", "adviser", true),
          field("representative_name", "short_text", "Institutional representative", "adviser", true),
          field("representative_title", "short_text", "Representative title", "adviser", true),
          field("representative_email", "email", "Representative email", "adviser", true)
        ]),
        section("approval", "Approval conditions", "Document the scope and conditions of institutional approval.", [
          field("authorized", "acknowledgment", "I confirm that the institution has authorized this chapter to operate under its name or sponsorship.", "adviser", true),
          field("meeting_location", "short_text", "Approved meeting location", "adviser", true),
          field("meeting_schedule", "short_text", "Approved meeting schedule", "adviser", false),
          field("conditions", "long_text", "Restrictions, conditions, or institutional requirements", "adviser", false),
          field("effective_date", "date", "Approval effective date", "adviser", true),
          field("expiration_date", "date", "Approval expiration or review date", "adviser", false),
          field("approval_document", "file", "Supporting institutional approval document", "adviser", false)
        ])
      ]
    },
    {
      id: "FORM-ADVISER-AGREEMENT",
      title: "Chapter Adviser Agreement",
      category: "agreement",
      description: "Documents the Adviser's acceptance of adult oversight, institutional compliance, reporting, safety, and communication duties.",
      introduction: "Read each statement carefully. Certification records your authenticated account, chapter, form version, and submission time.",
      workflow: "single_adviser",
      sections: [
        section("responsibilities", "Adviser responsibilities", "Confirm each expectation before submission.", [
          field("adult_supervision", "acknowledgment", "I will provide appropriate adult and institutional oversight for chapter activities.", "adviser", true),
          field("institutional_policy", "acknowledgment", "I will ensure chapter activities comply with applicable institutional policies.", "adviser", true),
          field("safety_reporting", "acknowledgment", "I will promptly report safety concerns, serious incidents, or material compliance issues.", "adviser", true),
          field("privacy", "acknowledgment", "I will help the chapter protect private prayer-request and personal information.", "adviser", true),
          field("communications", "acknowledgment", "I will maintain reasonable communication with The Prayer Project and the Chapter Director.", "adviser", true),
          field("availability", "long_text", "Describe your normal availability and preferred method of contact", "adviser", true)
        ])
      ]
    },
    {
      id: "FORM-DIRECTOR-AGREEMENT",
      title: "Chapter Director Agreement",
      category: "agreement",
      description: "Documents the Director's acceptance of chapter leadership, reporting, brand, privacy, conduct, and renewal obligations.",
      introduction: "This agreement applies to your service as the recognized Chapter Director.",
      workflow: "single_director",
      sections: [
        section("leadership", "Director commitments", "Confirm each leadership obligation.", [
          field("accurate_reporting", "acknowledgment", "I will submit accurate chapter information, reports, and renewal materials.", "director", true),
          field("brand_use", "acknowledgment", "I will use The Prayer Project name and materials only for authorized chapter activity.", "director", true),
          field("privacy", "acknowledgment", "I will protect private prayer-request and personal information.", "director", true),
          field("adviser_coordination", "acknowledgment", "I will coordinate chapter activities with the approved Chapter Adviser.", "director", true),
          field("conduct", "acknowledgment", "I will promote respectful, safe, lawful, and faith-consistent conduct.", "director", true),
          field("unauthorized_activity", "acknowledgment", "I will not represent unauthorized fundraising, legal, financial, or institutional commitments as approved by The Prayer Project.", "director", true),
          field("leadership_goals", "long_text", "Briefly describe your goals for leading the chapter", "director", true)
        ])
      ]
    },
    {
      id: "FORM-ANNUAL-RENEWAL",
      title: "Annual Chapter Renewal",
      category: "renewal",
      description: "Collects the chapter's annual activity, leadership, compliance, plans, and Adviser confirmation before administrative review.",
      introduction: "The Director completes the activity sections first. The Adviser then reviews the Director's answers and completes the oversight section.",
      workflow: "director_then_adviser",
      sections: [
        section("activity", "Chapter activity", "Director: report the chapter's activity during the renewal period.", [
          field("reporting_period", "short_text", "Reporting period", "director", true),
          field("current_member_count", "number", "Current active member count", "director", true),
          field("meetings_held", "number", "Meetings held during the reporting period", "director", true),
          field("service_activities", "long_text", "Describe significant prayer, service, outreach, or community activities", "director", true),
          field("accomplishments", "long_text", "Major accomplishments", "director", true),
          field("challenges", "long_text", "Challenges or support needs", "director", false),
          field("next_year_plans", "long_text", "Plans and goals for the next year", "director", true),
          field("leadership_confirmed", "acknowledgment", "I confirm that the leadership and member roster in the portal is current.", "director", true)
        ]),
        section("oversight", "Adviser review", "Adviser: review the Director's submission and confirm institutional oversight.", [
          field("reviewed_director_submission", "acknowledgment", "I reviewed the Director's complete renewal submission.", "adviser", true),
          field("institutional_approval_current", "yes_no", "Is institutional approval current?", "adviser", true),
          field("supervision_current", "acknowledgment", "I confirm that appropriate adult and institutional supervision remains in place.", "adviser", true),
          field("incidents_disclosed", "yes_no", "Have all material incidents or compliance concerns been disclosed to The Prayer Project?", "adviser", true),
          field("adviser_comments", "long_text", "Adviser comments, conditions, or recommendations", "adviser", false)
        ])
      ]
    }
  ];
}

function section(id, title, description, fields) {
  return { id, title, description, fields };
}

function field(id, type, label, role, required = true, options = []) {
  return { id, type, label, role, required, options, help: "", minLength: 0, maxLength: type === "long_text" ? 5000 : 1000 };
}

async function installStarterLibrary() {
  if (!isOwner()) return;
  const existing = new Set(state.templates.map((item) => item.id));
  const starters = starterTemplates().filter((item) => !existing.has(item.id));
  if (!starters.length) return setAlert("p9-admin-alert", "warning", "Starter library already installed", "All built-in Phase 9 forms are already present.");
  const batch = writeBatch(db);
  starters.forEach((item) => {
    const templateRef = doc(db, "formTemplates", item.id);
    const schemaJson = JSON.stringify({ sections: item.sections });
    batch.set(templateRef, {
      templateId: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      introduction: item.introduction,
      workflow: item.workflow,
      audienceRoles: workflowRoles(item.workflow),
      requiresAdminReview: true,
      status: "published",
      activeVersionId: "v1",
      currentVersionNumber: 1,
      draftSchemaJson: schemaJson,
      starterTemplate: true,
      createdByUid: state.user.uid,
      createdAt: serverTimestamp(),
      updatedByUid: state.user.uid,
      updatedAt: serverTimestamp()
    });
    batch.set(doc(templateRef, "versions", "v1"), {
      templateId: item.id,
      versionId: "v1",
      versionNumber: 1,
      title: item.title,
      category: item.category,
      description: item.description,
      introduction: item.introduction,
      workflow: item.workflow,
      audienceRoles: workflowRoles(item.workflow),
      requiresAdminReview: true,
      schemaJson,
      locked: true,
      publishedByUid: state.user.uid,
      publishedByName: state.profile?.displayName || state.user.email,
      publishedAt: serverTimestamp()
    });
  });
  batch.set(doc(collection(db, "auditLogs")), {
    actorUid: state.user.uid,
    action: "starter_form_library_installed",
    targetType: "formTemplates",
    targetId: "phase9-starter-library",
    summary: `Installed ${starters.length} built-in required form templates.`,
    createdAt: serverTimestamp()
  });
  await batch.commit();
  await loadTemplates();
  setAlert("p9-admin-alert", "success", "Starter library installed", `${starters.length} form templates are now published and ready to assign.`);
  render(false);
}

async function createAssignments(form) {
  if (!isOwner()) return;
  const template = state.templates.find((item) => item.id === form.templateId.value);
  if (!template?.activeVersionId) throw new Error("Select a published form template.");
  const versionSnapshot = await getDoc(doc(db, "formTemplates", template.id, "versions", template.activeVersionId));
  if (!versionSnapshot.exists()) throw new Error("The published form version is unavailable.");
  const version = versionSnapshot.data();
  const scope = form.scope.value;
  let chapters = state.chapters;
  if (scope === "selected") {
    const ids = new Set(form.chapterIds.value.toUpperCase().split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean));
    chapters = state.chapters.filter((item) => ids.has(item.chapterId || item.id));
    const missing = [...ids].filter((id) => !chapters.some((item) => (item.chapterId || item.id) === id));
    if (missing.length) throw new Error(`Unknown Chapter ID${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  } else {
    chapters = state.chapters.filter((item) => ["active", "conditional"].includes(item.authorizationStatus));
  }
  if (!chapters.length) throw new Error("No eligible chapters were selected.");
  const availableAt = inputDate(form.availableDate.value);
  const dueAt = inputDate(form.dueDate.value);
  if (!availableAt || !dueAt || dueAt < availableAt) throw new Error("Choose a due date on or after the available date.");
  const required = form.required.checked;
  const requiresAdminReview = required ? true : form.requiresAdminReview.checked;
  const campaignRef = doc(collection(db, "formCampaigns"));
  await setDoc(campaignRef, {
    campaignId: campaignRef.id,
    templateId: template.id,
    versionId: template.activeVersionId,
    title: template.title,
    scope,
    chapterIds: chapters.map((item) => item.chapterId || item.id),
    assignmentCount: chapters.length,
    availableAt,
    dueAt,
    required,
    requiresAdminReview,
    instructions: form.instructions.value.trim(),
    status: "active",
    createdByUid: state.user.uid,
    createdByName: state.profile?.displayName || state.user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  let batch = writeBatch(db);
  let operations = 0;
  const flush = async () => {
    if (!operations) return;
    await batch.commit();
    batch = writeBatch(db);
    operations = 0;
  };
  for (const chapter of chapters) {
    const chapterId = chapter.chapterId || chapter.id;
    const assignmentRef = doc(collection(db, "formAssignments"));
    const requirementId = required ? `form_${assignmentRef.id}` : "";
    batch.set(assignmentRef, {
      assignmentId: assignmentRef.id,
      campaignId: campaignRef.id,
      templateId: template.id,
      versionId: template.activeVersionId,
      versionNumber: version.versionNumber,
      title: version.title,
      category: version.category,
      description: version.description,
      introduction: version.introduction,
      workflow: version.workflow,
      assignedRoles: workflowRoles(version.workflow),
      schemaJson: version.schemaJson,
      chapterId,
      chapterName: chapter.officialName || chapterId,
      instructions: form.instructions.value.trim(),
      required,
      requiresAdminReview,
      availableAt,
      dueAt,
      status: "assigned",
      complianceRequirementId: requirementId,
      reviewNote: "",
      reviewedByUid: "",
      reviewedByName: "",
      reviewedAt: null,
      createdByUid: state.user.uid,
      createdByName: state.profile?.displayName || state.user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    operations += 1;
    if (required) {
      batch.set(doc(db, "chapters", chapterId, "requirements", requirementId), {
        title: version.title,
        description: `Complete and receive approval for ${version.title}.`,
        status: "pending",
        dueDate: dueAt,
        source: "required_form",
        sourceFormAssignmentId: assignmentRef.id,
        sortOrder: 50,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      operations += 1;
    }
    if (operations >= 380) await flush();
  }
  await flush();
  const auditBatch = writeBatch(db);
  auditBatch.set(doc(collection(db, "auditLogs")), {
    actorUid: state.user.uid,
    action: "required_form_campaign_created",
    targetType: "formCampaign",
    targetId: campaignRef.id,
    summary: `Assigned ${template.title} to ${chapters.length} chapter${chapters.length === 1 ? "" : "s"}.`,
    createdAt: serverTimestamp()
  });
  await auditBatch.commit();
  setAlert("p9-assignment-alert", "success", "Assignments created", `${chapters.length} chapter assignment${chapters.length === 1 ? " was" : "s were"} created.`);
  setTimeout(() => go("/admin/forms/responses?status=all"), 1000);
}

function collectAnswers(form, role) {
  const assignment = state.currentAssignment;
  const schema = schemaForAssignment(assignment);
  const answers = answersForRole(state.currentResponse, role);
  for (const section of schema.sections) {
    for (const field of section.fields.filter((item) => (item.role || initialStep(assignment.workflow)) === role)) {
      if (field.type === "file") continue;
      const name = `field__${field.id}`;
      if (field.type === "checklist") {
        answers[field.id] = Array.from(form.querySelectorAll(`[name="${CSS.escape(name)}"]:checked`)).map((item) => item.value);
      } else if (field.type === "acknowledgment") {
        answers[field.id] = Boolean(form.elements[name]?.checked);
      } else if (["radio", "yes_no"].includes(field.type)) {
        answers[field.id] = form.querySelector(`[name="${CSS.escape(name)}"]:checked`)?.value || "";
      } else {
        answers[field.id] = form.elements[name]?.value?.trim?.() ?? form.elements[name]?.value ?? "";
      }
    }
  }
  return answers;
}

function validateRequiredAnswers(role, answers, form) {
  const schema = schemaForAssignment(state.currentAssignment);
  for (const section of schema.sections) {
    for (const field of section.fields.filter((item) => (item.role || initialStep(state.currentAssignment.workflow)) === role && item.required !== false)) {
      if (field.type === "file") {
        const alreadyUploaded = state.currentAttachments.some((item) => item.fieldId === field.id);
        const selected = form.querySelector(`input[type="file"][data-field-id="${CSS.escape(field.id)}"]`)?.files?.length || 0;
        if (!alreadyUploaded && !selected) throw new Error(`Attach the required file: ${field.label}`);
        continue;
      }
      const value = answers[field.id];
      if (field.type === "acknowledgment" && value !== true) throw new Error(`Confirm: ${field.label}`);
      if (Array.isArray(value) && !value.length) throw new Error(`Complete: ${field.label}`);
      if (!Array.isArray(value) && value !== true && !String(value ?? "").trim()) throw new Error(`Complete: ${field.label}`);
    }
  }
}

async function uploadResponseFiles(form, responseRef) {
  const fileInputs = Array.from(form.querySelectorAll('input[type="file"][data-field-id]'));
  const selected = fileInputs.flatMap((input) => Array.from(input.files || []).map((file) => ({ file, fieldId: input.dataset.fieldId })));
  if (!selected.length) return;
  if (state.currentAttachments.length + selected.length > ATTACHMENT_FILE_LIMIT) throw new Error(`No more than ${ATTACHMENT_FILE_LIMIT} files may be attached to one response.`);
  for (const selectedFile of selected) {
    const [item] = validateAttachmentFiles([selectedFile.file], 0);
    const attachmentRef = doc(collection(responseRef, "attachments"));
    await saveFirestoreAttachment({
      db,
      attachmentRef,
      item,
      metadata: {
        assignmentId: state.currentAssignment.id,
        chapterId: state.currentAssignment.chapterId,
        responseId: "current",
        fieldId: selectedFile.fieldId,
        uploadedByUid: state.user.uid,
        uploadedByRole: selectedMembership()?.role || currentRole()
      }
    });
  }
}

async function saveResponse({ submit = false } = {}) {
  const form = document.querySelector("#p9-response-form");
  const assignment = state.currentAssignment;
  if (!form || !assignment || !canCurrentUserEdit(assignment, state.currentResponse)) return;
  const role = selectedMembership().role;
  const answers = collectAnswers(form, role);
  if (submit) {
    validateRequiredAnswers(role, answers, form);
    if (!form.certificationConfirmed.checked) throw new Error("Confirm the authenticated certification before submitting.");
    if (form.certificationName.value.trim().length < 2 || form.certificationTitle.value.trim().length < 2) throw new Error("Enter your full name and official title for certification.");
  }
  const responseRef = doc(db, "formAssignments", assignment.id, "responses", "current");
  const existing = state.currentResponse;
  const nextStatus = submit
    ? (assignment.workflow === "director_then_adviser" && role === "director" ? "awaiting_adviser" : "submitted")
    : "draft";
  const nextStep = submit
    ? (assignment.workflow === "director_then_adviser" && role === "director" ? "adviser" : "review")
    : role;
  const selectedFileCount = Array.from(form.querySelectorAll('input[type="file"][data-field-id]'))
    .reduce((total, input) => total + (input.files?.length || 0), 0);
  const baseData = {
    assignmentId: assignment.id,
    campaignId: assignment.campaignId,
    templateId: assignment.templateId,
    versionId: assignment.versionId,
    chapterId: assignment.chapterId,
    workflow: assignment.workflow,
    status: nextStatus,
    currentStep: nextStep,
    returnRole: "",
    directorAnswersJson: role === "director" ? JSON.stringify(answers) : (existing?.directorAnswersJson || "{}"),
    adviserAnswersJson: role === "adviser" ? JSON.stringify(answers) : (existing?.adviserAnswersJson || "{}"),
    directorCertificationName: role === "director" && submit ? form.certificationName.value.trim() : (existing?.directorCertificationName || ""),
    directorCertificationTitle: role === "director" && submit ? form.certificationTitle.value.trim() : (existing?.directorCertificationTitle || ""),
    directorCertifiedAt: role === "director" && submit ? serverTimestamp() : (existing?.directorCertifiedAt || null),
    directorUid: role === "director" && submit ? state.user.uid : (existing?.directorUid || ""),
    adviserCertificationName: role === "adviser" && submit ? form.certificationName.value.trim() : (existing?.adviserCertificationName || ""),
    adviserCertificationTitle: role === "adviser" && submit ? form.certificationTitle.value.trim() : (existing?.adviserCertificationTitle || ""),
    adviserCertifiedAt: role === "adviser" && submit ? serverTimestamp() : (existing?.adviserCertifiedAt || null),
    adviserUid: role === "adviser" && submit ? state.user.uid : (existing?.adviserUid || ""),
    submittedAt: submit && nextStatus === "submitted" ? serverTimestamp() : (existing?.submittedAt || null),
    reviewNote: submit ? "" : (existing?.reviewNote || ""),
    reviewedByUid: existing?.reviewedByUid || "",
    reviewedByName: existing?.reviewedByName || "",
    reviewedAt: existing?.reviewedAt || null,
    createdByUid: existing?.createdByUid || state.user.uid,
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedByUid: state.user.uid,
    updatedAt: serverTimestamp()
  };

  if (submit && selectedFileCount) {
    const stagingData = {
      ...baseData,
      status: "draft",
      currentStep: role,
      returnRole: existing?.returnRole || "",
      directorCertificationName: existing?.directorCertificationName || "",
      directorCertificationTitle: existing?.directorCertificationTitle || "",
      directorCertifiedAt: existing?.directorCertifiedAt || null,
      directorUid: existing?.directorUid || "",
      adviserCertificationName: existing?.adviserCertificationName || "",
      adviserCertificationTitle: existing?.adviserCertificationTitle || "",
      adviserCertifiedAt: existing?.adviserCertifiedAt || null,
      adviserUid: existing?.adviserUid || "",
      submittedAt: existing?.submittedAt || null,
      reviewNote: existing?.reviewNote || ""
    };
    await setDoc(responseRef, stagingData, { merge: true });
    await uploadResponseFiles(form, responseRef);

    const finalBatch = writeBatch(db);
    const certification = role === "director"
      ? {
          directorCertificationName: form.certificationName.value.trim(),
          directorCertificationTitle: form.certificationTitle.value.trim(),
          directorCertifiedAt: serverTimestamp(),
          directorUid: state.user.uid
        }
      : {
          adviserCertificationName: form.certificationName.value.trim(),
          adviserCertificationTitle: form.certificationTitle.value.trim(),
          adviserCertifiedAt: serverTimestamp(),
          adviserUid: state.user.uid
        };
    finalBatch.update(responseRef, {
      status: nextStatus,
      currentStep: nextStep,
      returnRole: "",
      ...certification,
      submittedAt: nextStatus === "submitted" ? serverTimestamp() : (existing?.submittedAt || null),
      reviewNote: "",
      updatedByUid: state.user.uid,
      updatedAt: serverTimestamp()
    });
    finalBatch.set(doc(collection(responseRef, "history")), {
      assignmentId: assignment.id,
      chapterId: assignment.chapterId,
      eventType: nextStatus === "awaiting_adviser" ? "director_submitted" : "response_submitted",
      actorUid: state.user.uid,
      actorName: state.profile?.displayName || state.user.email,
      actorRole: role,
      note: "",
      createdAt: serverTimestamp()
    });
    await finalBatch.commit();
  } else {
    const batch = writeBatch(db);
    batch.set(responseRef, baseData, { merge: true });
    if (submit) {
      batch.set(doc(collection(responseRef, "history")), {
        assignmentId: assignment.id,
        chapterId: assignment.chapterId,
        eventType: nextStatus === "awaiting_adviser" ? "director_submitted" : "response_submitted",
        actorUid: state.user.uid,
        actorName: state.profile?.displayName || state.user.email,
        actorRole: role,
        note: "",
        createdAt: serverTimestamp()
      });
    }
    await batch.commit();
    if (!submit) await uploadResponseFiles(form, responseRef);
  }

  await loadCurrentAssignment(assignment.id);
  setAlert("p9-response-alert", "success", submit ? "Response submitted" : "Draft saved", submit ? (nextStatus === "awaiting_adviser" ? "The Chapter Adviser may now review and certify the form." : "The response is now awaiting administrative review.") : "Your answers were saved privately.");
  if (submit) setTimeout(() => go(`/chapter/forms/view?id=${encodeURIComponent(assignment.id)}`), 1100);
}

async function reviewResponse(status) {
  if (!isAdmin() || !state.currentAssignment) return;
  const form = document.querySelector("#p9-review-form");
  const note = form?.reviewNote.value.trim() || "";
  const returnRole = form?.returnRole.value || "director";
  if (["changes_requested", "denied"].includes(status) && note.length < 10) throw new Error("Provide an administrative note of at least ten characters.");
  if (["approved", "changes_requested", "denied"].includes(status)
      && !["submitted", "under_review"].includes(state.currentResponse?.status)) {
    throw new Error("The chapter must formally submit this response before an administrative decision can be recorded.");
  }
  const assignment = state.currentAssignment;
  const assignmentRef = doc(db, "formAssignments", assignment.id);
  const responseRef = doc(assignmentRef, "responses", "current");
  const batch = writeBatch(db);
  batch.update(assignmentRef, {
    status,
    reviewNote: note,
    reviewedByUid: state.user.uid,
    reviewedByName: state.profile?.displayName || state.user.email,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if (state.currentResponse) {
    batch.update(responseRef, {
      status,
      currentStep: status === "changes_requested" ? returnRole : "complete",
      returnRole: status === "changes_requested" ? returnRole : "",
      reviewNote: note,
      reviewedByUid: state.user.uid,
      reviewedByName: state.profile?.displayName || state.user.email,
      reviewedAt: serverTimestamp(),
      updatedByUid: state.user.uid,
      updatedAt: serverTimestamp()
    });
    batch.set(doc(collection(responseRef, "history")), {
      assignmentId: assignment.id,
      chapterId: assignment.chapterId,
      eventType: status,
      actorUid: state.user.uid,
      actorName: state.profile?.displayName || state.user.email,
      actorRole: currentRole(),
      note,
      createdAt: serverTimestamp()
    });
  }
  if (assignment.complianceRequirementId) {
    batch.update(doc(db, "chapters", assignment.chapterId, "requirements", assignment.complianceRequirementId), {
      status: status === "approved" ? "complete" : status === "waived" ? "not_required" : "action_required",
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  batch.set(doc(collection(db, "auditLogs")), {
    actorUid: state.user.uid,
    action: `required_form_${status}`,
    targetType: "formAssignment",
    targetId: assignment.id,
    summary: `${status === "approved" ? "Approved" : titleCase(status)} ${assignment.title} for ${assignment.chapterId}.${note ? ` ${note}` : ""}`,
    createdAt: serverTimestamp()
  });
  await batch.commit();
  await loadCurrentAssignment(assignment.id);
  setAlert("p9-review-alert", "success", `Response ${STATUS_LABELS[status]?.toLowerCase() || titleCase(status)}`, "The assignment and linked compliance item were updated.");
  setTimeout(() => go("/admin/forms/responses"), 1000);
}

async function downloadAttachment(id) {
  const item = state.currentAttachments.find((attachment) => attachment.id === id);
  if (!item || !state.currentAssignment) return;
  const attachmentRef = doc(db, "formAssignments", state.currentAssignment.id, "responses", "current", "attachments", id);
  await downloadFirestoreAttachment({ attachmentRef, fileName: item.fileName, contentType: item.contentType });
}

async function deleteAttachment(id) {
  const item = state.currentAttachments.find((attachment) => attachment.id === id);
  if (!item || item.uploadedByUid !== state.user.uid || !state.currentAssignment) return;
  if (!confirm(`Remove ${item.fileName}?`)) return;
  const attachmentRef = doc(db, "formAssignments", state.currentAssignment.id, "responses", "current", "attachments", id);
  await deleteFirestoreAttachment({ db, attachmentRef });
  await loadCurrentAssignment(state.currentAssignment.id);
  render(false);
}

function setAlert(id, type, title, message) {
  const target = document.querySelector(`#${id}`);
  if (target) target.innerHTML = `<div class="p9-alert p9-alert-${type}">${type === "success" ? icons.check : icons.alert}<div><strong>${esc(title)}</strong><p>${esc(message)}</p></div></div>`;
}

function toast(title, message = "", type = "success") {
  const region = document.querySelector("#p9-toast-region");
  if (!region) return;
  const node = document.createElement("div");
  node.className = `p9-toast p9-toast-${type}`;
  node.innerHTML = `<strong>${esc(title)}</strong>${message ? `<span>${esc(message)}</span>` : ""}`;
  region.append(node);
  setTimeout(() => node.remove(), 4500);
}

function bindCommon() {
  document.querySelectorAll('[data-p9-action="menu"]').forEach((button) => button.addEventListener("click", () => {
    state.mobileOpen = true;
    document.body.classList.add("p9-drawer-open");
    render(false);
  }));
  document.querySelectorAll('[data-p9-action="close-menu"]').forEach((button) => button.addEventListener("click", () => {
    state.mobileOpen = false;
    document.body.classList.remove("p9-drawer-open");
    render(false);
  }));
  document.querySelectorAll('[data-p9-action="sign-out"]').forEach((button) => button.addEventListener("click", async () => {
    await signOut(auth);
    go("/login");
  }));
  document.querySelectorAll('[data-p9-action="theme"]').forEach((button) => button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("tpp-theme", next);
    render(false);
  }));
  document.querySelectorAll('[data-p9-action="refresh"]').forEach((button) => button.addEventListener("click", () => render(true)));
  document.querySelectorAll('[data-p9-action="print"]').forEach((button) => button.addEventListener("click", () => window.print()));
  document.querySelectorAll('[data-p9-action="download-attachment"]').forEach((button) => button.addEventListener("click", () => downloadAttachment(button.dataset.id).catch((error) => toast("Download failed", error.message, "danger"))));
  document.querySelectorAll('[data-p9-action="delete-attachment"]').forEach((button) => button.addEventListener("click", () => deleteAttachment(button.dataset.id).catch((error) => toast("Removal failed", error.message, "danger"))));
}

function bindBuilder() {
  document.querySelector('[data-p9-action="install-starters"]')?.addEventListener("click", () => installStarterLibrary().catch((error) => setAlert("p9-admin-alert", "danger", "Installation failed", error.message)));
  const form = document.querySelector("#p9-template-form");
  if (!form) return;
  form.workflow?.addEventListener("change", () => {
    captureBuilderFromDom();
    state.builder.workflow = form.workflow.value;
    state.builder.sections.forEach((section) => section.fields.forEach((field) => {
      if (state.builder.workflow !== "director_then_adviser") field.role = initialStep(state.builder.workflow);
    }));
    render(false);
  });
  form.querySelectorAll('[data-builder="field-type"]').forEach((select) => select.addEventListener("change", () => {
    captureBuilderFromDom();
    render(false);
  }));
  form.querySelectorAll('[data-p9-action="add-section"]').forEach((button) => button.addEventListener("click", () => {
    captureBuilderFromDom();
    state.builder.sections.push({ id: uid("section"), title: `Section ${state.builder.sections.length + 1}`, description: "", fields: [] });
    render(false);
  }));
  form.querySelectorAll('[data-p9-action="remove-section"]').forEach((button) => button.addEventListener("click", () => {
    captureBuilderFromDom();
    const index = Number(button.closest(".p9-builder-section").dataset.sectionIndex);
    if (state.builder.sections.length === 1) return toast("Section required", "A form must contain at least one section.", "warning");
    state.builder.sections.splice(index, 1);
    render(false);
  }));
  form.querySelectorAll('[data-p9-action="add-field"]').forEach((button) => button.addEventListener("click", () => {
    captureBuilderFromDom();
    const index = Number(button.closest(".p9-builder-section").dataset.sectionIndex);
    state.builder.sections[index].fields.push({ id: uid("field"), type: "short_text", label: "", help: "", role: initialStep(state.builder.workflow), required: true, options: [], minLength: 0, maxLength: 1000 });
    render(false);
  }));
  form.querySelectorAll('[data-p9-action="remove-field"]').forEach((button) => button.addEventListener("click", () => {
    captureBuilderFromDom();
    const element = button.closest(".p9-builder-field");
    state.builder.sections[Number(element.dataset.sectionIndex)].fields.splice(Number(element.dataset.fieldIndex), 1);
    render(false);
  }));
  form.querySelectorAll('[data-p9-action="field-up"], [data-p9-action="field-down"]').forEach((button) => button.addEventListener("click", () => {
    captureBuilderFromDom();
    const element = button.closest(".p9-builder-field");
    const section = state.builder.sections[Number(element.dataset.sectionIndex)];
    const index = Number(element.dataset.fieldIndex);
    const target = button.dataset.p9Action === "field-up" ? index - 1 : index + 1;
    if (target < 0 || target >= section.fields.length) return;
    [section.fields[index], section.fields[target]] = [section.fields[target], section.fields[index]];
    render(false);
  }));
  form.querySelector('[data-p9-action="save-template-draft"]')?.addEventListener("click", () => saveTemplate({ publish: false }).catch((error) => setAlert("p9-template-alert", "danger", "Draft not saved", error.message)));
  form.querySelector('[data-p9-action="publish-template"]')?.addEventListener("click", () => saveTemplate({ publish: true }).catch((error) => setAlert("p9-template-alert", "danger", "Form not published", error.message)));
}

function bindPage() {
  bindCommon();
  bindBuilder();
  const assignmentForm = document.querySelector("#p9-assignment-form");
  if (assignmentForm) assignmentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = assignmentForm.querySelector('button[type="submit"]');
    button.disabled = true;
    createAssignments(assignmentForm).catch((error) => setAlert("p9-assignment-alert", "danger", "Assignments not created", error.message)).finally(() => { button.disabled = false; });
  });
  document.querySelector("#p9-response-filter")?.addEventListener("change", (event) => go(`/admin/forms/responses?status=${encodeURIComponent(event.target.value)}`));
  document.querySelector('[data-p9-action="save-response-draft"]')?.addEventListener("click", () => saveResponse({ submit: false }).catch((error) => setAlert("p9-response-alert", "danger", "Draft not saved", error.message)));
  document.querySelector('[data-p9-action="submit-response"]')?.addEventListener("click", () => saveResponse({ submit: true }).catch((error) => setAlert("p9-response-alert", "danger", "Response not submitted", error.message)));
  document.querySelectorAll("[data-p9-review]").forEach((button) => button.addEventListener("click", () => reviewResponse(button.dataset.p9Review).catch((error) => setAlert("p9-review-alert", "danger", "Review not saved", error.message))));
}

async function prepareRoute(currentRoute) {
  if (ADMIN_ROUTES.has(currentRoute)) {
    await Promise.all([loadTemplates(), loadChapters(), loadAssignments({ admin: true })]);
    if (currentRoute === "/admin/forms/template") await loadBuilder(params().get("id"));
    if (currentRoute === "/admin/forms/review") await loadCurrentAssignment(params().get("id"));
  }
  if (CHAPTER_ROUTES.has(currentRoute)) {
    if (!state.memberships.length) await loadMemberships();
    await loadAssignments();
    if (["/chapter/forms/fill", "/chapter/forms/view"].includes(currentRoute)) await loadCurrentAssignment(params().get("id"));
  }
}

function pageForRoute(currentRoute) {
  return ({
    "/admin/forms": adminFormsPage,
    "/admin/forms/template": templateEditorPage,
    "/admin/forms/assign": assignmentPage,
    "/admin/forms/responses": responsesPage,
    "/admin/forms/review": reviewPage,
    "/chapter/forms": chapterFormsPage,
    "/chapter/forms/fill": () => fillFormPage({ readOnly: false }),
    "/chapter/forms/view": () => fillFormPage({ readOnly: true })
  })[currentRoute]?.();
}

async function render(prepare = true) {
  const currentRoute = route();
  if (!ALL_ROUTES.has(currentRoute)) {
    augmentExistingPortal();
    return;
  }
  if (!state.authReady || state.rendering) return;
  state.rendering = true;
  state.error = null;
  try {
    if (!state.user) {
      go("/login");
      return;
    }
    if (ADMIN_ROUTES.has(currentRoute) && !isAdmin()) {
      app.innerHTML = gate("Owner, Chapter Administrator, or Compliance Administrator access is required.", true);
      return;
    }
    if (CHAPTER_ROUTES.has(currentRoute) && !CHAPTER_ROLES.has(currentRole())) {
      app.innerHTML = gate("An active Chapter Director or Chapter Adviser account is required.", false);
      return;
    }
    if (prepare) {
      state.loading = true;
      app.innerHTML = ADMIN_ROUTES.has(currentRoute) ? adminLayout(loadingBlock("Loading forms…")) : chapterLayout(loadingBlock("Loading required forms…"));
      await prepareRoute(currentRoute);
    }
    if (CHAPTER_ROUTES.has(currentRoute) && !state.selectedChapterId) {
      app.innerHTML = gate("No active chapter membership was found for this account.", false);
      return;
    }
    app.innerHTML = pageForRoute(currentRoute);
    bindPage();
    document.title = `${ADMIN_ROUTES.has(currentRoute) ? "Forms Administration" : "Required Forms"} | The Prayer Project`;
  } catch (error) {
    console.error("Unable to render Phase 9.", error);
    state.error = error;
    app.innerHTML = gate(error.message || "The required forms system could not be loaded.", ADMIN_ROUTES.has(currentRoute));
  } finally {
    state.loading = false;
    state.rendering = false;
  }
}

function augmentExistingPortal() {
  if (document.querySelector("[data-phase9-root]")) return;
  const chapterNav = document.querySelector(".cp2-nav");
  if (chapterNav && CHAPTER_ROLES.has(currentRole()) && !chapterNav.querySelector("[data-p9-chapter-nav]")) {
    const link = document.createElement("a");
    link.href = "#/chapter/forms";
    link.dataset.p9ChapterNav = "true";
    link.innerHTML = `${icons.forms}<span>Required forms</span>`;
    const operationLabel = Array.from(chapterNav.querySelectorAll(":scope > span")).find((item) => item.textContent.trim() === "Operations");
    chapterNav.insertBefore(link, operationLabel || null);
  }
  const actions = document.querySelector(".cp2-actions");
  if (actions && CHAPTER_ROLES.has(currentRole()) && !actions.querySelector("[data-p9-overview-action]")) {
    const link = document.createElement("a");
    link.href = "#/chapter/forms";
    link.dataset.p9OverviewAction = "true";
    link.innerHTML = `<span>${icons.forms}</span><strong>Required forms</strong><small>Complete agreements, institutional approvals, renewals, and compliance certifications.</small>`;
    actions.prepend(link);
  }
  const adminNav = document.querySelector(".p7-nav, .phase3-admin-nav, .p4a-nav, .p6-admin-nav");
  if (adminNav && isAdmin() && !adminNav.querySelector("[data-p9-admin-nav]")) {
    const link = document.createElement("a");
    link.href = "#/admin/forms";
    link.dataset.p9AdminNav = "true";
    link.className = adminNav.classList.contains("p7-nav") ? "p7-nav-link" : "p9-injected-admin-link";
    link.innerHTML = `${icons.forms}<span>Forms & agreements</span>`;
    adminNav.append(link);
  }
}

window.addEventListener("hashchange", () => queueMicrotask(() => render(true)));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.mobileOpen) {
    state.mobileOpen = false;
    document.body.classList.remove("p9-drawer-open");
    render(false);
  }
});
const observer = new MutationObserver(() => queueMicrotask(augmentExistingPortal));
observer.observe(app, { childList: true, subtree: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.profile = null;
  state.memberships = [];
  state.selectedChapterId = null;
  state.templates = [];
  state.assignments = [];
  state.responses = new Map();
  if (user) {
    await loadProfile(user);
    if (CHAPTER_ROLES.has(currentRole())) {
      await loadMemberships();
      try { await loadAssignments(); } catch (error) { console.warn("Required-form summary unavailable.", error); }
    }
  }
  state.authReady = true;
  await render(true);
  augmentExistingPortal();
});

console.info(`The Prayer Project Phase 9 forms loaded (${BUILD}).`);
