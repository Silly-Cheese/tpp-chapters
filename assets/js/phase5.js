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
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";
import {
  ATTACHMENT_FILE_LIMIT,
  ATTACHMENT_MAX_BYTES,
  deleteFirestoreAttachment,
  downloadFirestoreAttachment,
  saveFirestoreAttachment,
  validateAttachmentFiles
} from "./firestore-attachments.js";

const app = document.querySelector("#app");

const CHAPTER_ROUTES = new Set([
  "/chapter/workflows",
  "/chapter/submissions",
  "/chapter/submissions/new",
  "/chapter/submissions/edit",
  "/chapter/submissions/view"
]);
const ADMIN_ROUTES = new Set(["/admin/submissions"]);
const PHASE5_ROUTES = new Set([...CHAPTER_ROUTES, ...ADMIN_ROUTES]);
const ADMIN_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin"]);
const CHAPTER_ROLES = new Set(["director", "adviser", "chapterUser"]);
const EDITABLE_STATUSES = new Set(["draft", "changes_requested"]);
const FILE_LIMIT = ATTACHMENT_FILE_LIMIT;
const FILE_SIZE_LIMIT = ATTACHMENT_MAX_BYTES;

const TYPE_CONFIG = Object.freeze({
  meeting_report: {
    label: "Meeting report",
    description: "Record attendance, activity, volunteer service, decisions, and next steps from a chapter meeting.",
    roles: ["director", "adviser"],
    icon: "calendar",
    fields: ["meetingDate", "attendance", "volunteerCount", "volunteerHours", "summary", "details", "nextSteps"]
  },
  periodic_report: {
    label: "Quarterly or annual activity report",
    description: "Summarize chapter activity, participation, service hours, ministry impact, and upcoming priorities.",
    roles: ["director", "adviser"],
    icon: "report",
    fields: ["reportingPeriod", "attendance", "volunteerCount", "volunteerHours", "summary", "details", "nextSteps"]
  },
  event_proposal: {
    label: "Event proposal",
    description: "Request approval for a special meeting, service project, public activity, or off-site event.",
    roles: ["director", "adviser"],
    icon: "event",
    fields: ["eventDate", "eventLocation", "attendance", "summary", "details", "supervisionPlan", "transportationPlan", "budgetNotes"]
  },
  leadership_change: {
    label: "Leadership change request",
    description: "Request appointment, replacement, resignation, or role changes for chapter leadership.",
    roles: ["director", "adviser"],
    icon: "users",
    fields: ["requestedChange", "currentValue", "proposedValue", "requestedStartDate", "summary", "details"]
  },
  institution_change: {
    label: "Institution or chapter information change",
    description: "Request a change to the host institution, service area, meeting location, schedule, or official chapter information.",
    roles: ["director", "adviser"],
    icon: "building",
    fields: ["requestedChange", "currentValue", "proposedValue", "requestedStartDate", "summary", "details"]
  },
  inactivity_request: {
    label: "Temporary inactivity request",
    description: "Request a temporary pause in chapter operations and document the expected return plan.",
    roles: ["director", "adviser"],
    icon: "pause",
    fields: ["requestedStartDate", "requestedEndDate", "summary", "details", "nextSteps"]
  },
  document_submission: {
    label: "Document submission",
    description: "Submit institutional approvals, signed agreements, updated rosters, certificates, or other requested records.",
    roles: ["director", "adviser"],
    icon: "file",
    fields: ["reportingPeriod", "summary", "details"],
    attachmentRequired: true
  },
  annual_renewal: {
    label: "Annual chapter renewal",
    description: "Submit the chapter's annual renewal request, activity summary, leadership confirmation, and next-year plans.",
    roles: ["director"],
    icon: "renewal",
    fields: ["reportingPeriod", "volunteerCount", "volunteerHours", "leadershipRosterConfirmed", "institutionalApprovalConfirmed", "summary", "details", "nextSteps"]
  },
  adviser_confirmation: {
    label: "Annual Adviser confirmation",
    description: "Confirm institutional authorization, adult oversight, supervision, and any concerns requiring headquarters review.",
    roles: ["adviser"],
    icon: "shield",
    fields: ["reportingPeriod", "institutionalApprovalConfirmed", "supervisionConfirmed", "summary", "details"]
  }
});

const FIELD_CONFIG = Object.freeze({
  reportingPeriod: { label: "Reporting period or document category", type: "text", max: 120, placeholder: "Example: 2026 Annual Renewal or Institutional Approval" },
  meetingDate: { label: "Meeting date", type: "date" },
  eventDate: { label: "Event date", type: "datetime-local" },
  eventLocation: { label: "Event location", type: "text", max: 180 },
  requestedStartDate: { label: "Requested effective or start date", type: "date" },
  requestedEndDate: { label: "Requested end or return date", type: "date" },
  currentValue: { label: "Current information", type: "textarea", max: 1000 },
  proposedValue: { label: "Proposed information", type: "textarea", max: 1000 },
  requestedChange: { label: "Type of change requested", type: "text", max: 160 },
  summary: { label: "Summary", type: "textarea", max: 1500, required: true },
  details: { label: "Full details", type: "textarea", max: 5000, required: true },
  nextSteps: { label: "Next steps or return plan", type: "textarea", max: 2500 },
  supervisionPlan: { label: "Adult supervision and safety plan", type: "textarea", max: 2500 },
  transportationPlan: { label: "Transportation plan", type: "textarea", max: 1800 },
  budgetNotes: { label: "Budget, fundraising, or expense information", type: "textarea", max: 1800 },
  attendance: { label: "Attendance or expected attendance", type: "number", min: 0, max: 100000 },
  volunteerCount: { label: "Number of volunteers", type: "number", min: 0, max: 100000 },
  volunteerHours: { label: "Volunteer service hours", type: "number", min: 0, max: 100000, step: "0.25" },
  institutionalApprovalConfirmed: { label: "Institutional authorization is current", type: "checkbox" },
  leadershipRosterConfirmed: { label: "The current leadership roster is accurate", type: "checkbox" },
  supervisionConfirmed: { label: "Appropriate adult supervision remains in place", type: "checkbox" }
});

const STATUS_LABELS = Object.freeze({
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  denied: "Denied",
  withdrawn: "Withdrawn"
});

const state = {
  authReady: false,
  user: null,
  profile: null,
  memberships: [],
  selectedChapterId: null,
  chapter: null,
  submissions: [],
  currentSubmission: null,
  attachments: [],
  loading: false,
  error: null,
  rendering: false,
  adminSubmissions: [],
  adminLoading: false
};

const icons = {
  home: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>`,
  workflow: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v5H5zM5 15h14v5H5zM12 9v6M8 12h8"/></svg>`,
  report: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/></svg>`,
  calendar: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`,
  event: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M13 14h3M8 18h3"/></svg>`,
  users: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0"/></svg>`,
  building: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>`,
  pause: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 8v8M15 8v8"/></svg>`,
  file: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h8l4 4v16H6zM14 2v5h5M9 12h6M9 16h6"/></svg>`,
  renewal: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M17.9 15A7 7 0 0 1 6 18l-2-5"/></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
  attachment: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5L14 1a4 4 0 0 1 5.7 5.7L9.6 16.8a2 2 0 1 1-2.8-2.8l8.5-8.5"/></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6"/></svg>`,
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2 21h20zM12 9v5m0 3h.01"/></svg>`,
  arrow: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`,
  logout: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>`,
  review: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4zM8 9h8M8 13h5M8 17h8"/></svg>`
};

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  return (path.startsWith("/") ? path : `/${path}`).replace(/\/+$/, "") || "/";
}

function hashParams() {
  const raw = location.hash.replace(/^#/, "");
  const queryString = raw.includes("?") ? raw.split("?").slice(1).join("?") : "";
  return new URLSearchParams(queryString);
}

function navigate(route) {
  location.hash = route.startsWith("/") ? route : `/${route}`;
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
  return String(value).replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, { time = false, fallback = "Not listed" } = {}) {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {})
  }).format(date);
}

function currentMembership() {
  return state.memberships.find((item) => item.chapterId === state.selectedChapterId) || null;
}

function typeConfig(type) {
  return TYPE_CONFIG[type] || null;
}

function canUseType(type) {
  const config = typeConfig(type);
  return Boolean(config && config.roles.includes(currentMembership()?.role));
}

function statusTone(status) {
  if (status === "approved") return "success";
  if (["submitted", "under_review"].includes(status)) return "info";
  if (["draft", "changes_requested"].includes(status)) return "warning";
  if (["denied", "withdrawn"].includes(status)) return "danger";
  return "info";
}

function badge(status) {
  return `<span class="p5-badge p5-${statusTone(status)}">${escapeHTML(STATUS_LABELS[status] || titleCase(status))}</span>`;
}

function brand() {
  return `<a class="p5-brand" href="#/chapter/overview"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Chapter Operations</small></span></a>`;
}

async function loadProfile(user) {
  state.profile = null;
  if (!user) return;
  const snapshot = await getDoc(doc(db, "systemUsers", user.uid));
  if (snapshot.exists()) state.profile = { id: snapshot.id, ...snapshot.data() };
}

async function loadMemberships() {
  state.memberships = [];
  const snapshot = await getDocs(query(collection(db, "chapterMemberships"), where("uid", "==", state.user.uid)));
  state.memberships = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status === "active")
    .sort((a, b) => String(a.chapterName).localeCompare(String(b.chapterName)));
  const saved = localStorage.getItem(`tpp-selected-chapter-${state.user.uid}`);
  const preferred = saved || state.profile?.primaryChapterId;
  state.selectedChapterId = state.memberships.some((item) => item.chapterId === preferred)
    ? preferred
    : state.memberships[0]?.chapterId || null;
}

async function loadChapterContext() {
  if (!state.selectedChapterId) return;
  const chapterSnapshot = await getDoc(doc(db, "chapters", state.selectedChapterId));
  state.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;
}

async function loadSubmissions({ rerender = false } = {}) {
  if (!state.selectedChapterId) return;
  state.loading = true;
  if (rerender) renderPhase5();
  try {
    const snapshot = await getDocs(query(collection(db, "chapterSubmissions"), where("chapterId", "==", state.selectedChapterId)));
    state.submissions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0));
  } finally {
    state.loading = false;
    if (rerender) renderPhase5();
  }
}

async function loadSubmission(id) {
  state.currentSubmission = null;
  state.attachments = [];
  if (!id) return;
  const snapshot = await getDoc(doc(db, "chapterSubmissions", id));
  if (!snapshot.exists()) return;
  state.currentSubmission = { id: snapshot.id, ...snapshot.data() };
  const attachmentSnapshot = await getDocs(collection(db, "chapterSubmissions", id, "attachments"));
  state.attachments = attachmentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (toDate(a.uploadedAt)?.getTime() || 0) - (toDate(b.uploadedAt)?.getTime() || 0));
}

async function loadAdminSubmissions() {
  state.adminLoading = true;
  renderPhase5();
  try {
    const snapshot = await getDocs(query(collection(db, "chapterSubmissions"), limit(300)));
    state.adminSubmissions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0));
  } finally {
    state.adminLoading = false;
    renderPhase5();
  }
}

function chapterSelector() {
  if (state.memberships.length < 2) return `<div class="p5-static-chapter"><strong>${escapeHTML(currentMembership()?.chapterName || "Chapter")}</strong><span>${escapeHTML(state.selectedChapterId || "")}</span></div>`;
  return `<label class="p5-chapter-selector"><span>Current chapter</span><select id="p5-chapter-selector">${state.memberships.map((membership) => `<option value="${escapeHTML(membership.chapterId)}" ${membership.chapterId === state.selectedChapterId ? "selected" : ""}>${escapeHTML(membership.chapterName)} · ${escapeHTML(membership.chapterId)}</option>`).join("")}</select></label>`;
}

function chapterLayout(content, active = "/chapter/workflows", title = "Reports & Requests") {
  const membership = currentMembership();
  return `
    <div class="p5-shell" data-phase5-root>
      <aside class="p5-sidebar">
        <div class="p5-sidebar-brand">${brand()}</div>
        <div class="p5-sidebar-chapter">${chapterSelector()}</div>
        <nav class="p5-nav" aria-label="Chapter workflow navigation">
          <span>Chapter workspace</span>
          <a href="#/chapter/overview">${icons.home}<em>Overview</em></a>
          <a class="${active === "/chapter/workflows" ? "active" : ""}" href="#/chapter/workflows">${icons.workflow}<em>Reports & requests</em></a>
          <a class="${active === "/chapter/submissions" ? "active" : ""}" href="#/chapter/submissions">${icons.report}<em>My submissions</em></a>
          <span>Account</span>
          <a href="#/profile">${icons.users}<em>My profile</em></a>
          <button type="button" data-p5-action="sign-out">${icons.logout}<em>Sign out</em></button>
        </nav>
      </aside>
      <div class="p5-main">
        <header class="p5-topbar"><div><small>Chapter Operations</small><strong>${escapeHTML(title)}</strong></div><span>${escapeHTML(titleCase(membership?.role || "chapter member"))}</span></header>
        <main class="p5-content" id="main-content">${content}</main>
      </div>
      <div class="toast-region" id="p5-toast-region" aria-live="assertive"></div>
    </div>`;
}

function adminLayout(content) {
  return `
    <div class="p5-shell p5-admin-shell" data-phase5-root>
      <aside class="p5-sidebar">
        <div class="p5-sidebar-brand">${brand()}</div>
        <nav class="p5-nav" aria-label="Administrative workflow navigation">
          <span>Administration</span>
          <a href="#/dashboard">${icons.home}<em>Dashboard</em></a>
          <a class="active" href="#/admin/submissions">${icons.review}<em>Review submissions</em></a>
          <a href="#/admin/chapter-workspaces">${icons.building}<em>Chapter workspaces</em></a>
          <a href="#/admin/invitations">${icons.users}<em>Account invitations</em></a>
          <span>Account</span>
          <button type="button" data-p5-action="sign-out">${icons.logout}<em>Sign out</em></button>
        </nav>
      </aside>
      <div class="p5-main">
        <header class="p5-topbar"><div><small>Administration</small><strong>Submission Review</strong></div><span>${escapeHTML(titleCase(state.profile?.systemRole || "administrator"))}</span></header>
        <main class="p5-content" id="main-content">${content}</main>
      </div>
      <div class="toast-region" id="p5-toast-region" aria-live="assertive"></div>
    </div>`;
}

function pageHeading(kicker, title, description, action = "") {
  return `<header class="p5-page-heading"><div><p>${escapeHTML(kicker)}</p><h1>${escapeHTML(title)}</h1><span>${escapeHTML(description)}</span></div>${action}</header>`;
}

function workflowsPage() {
  const role = currentMembership()?.role;
  const available = Object.entries(TYPE_CONFIG).filter(([, config]) => config.roles.includes(role));
  return chapterLayout(`
    ${pageHeading("Operational workflows", "Reports, requests, and renewals", "Choose the official workflow that matches the action your chapter needs to complete.")}
    <section class="p5-workflow-grid">
      ${available.map(([type, config]) => `<article class="p5-workflow-card"><div>${icons[config.icon] || icons.report}</div><h2>${escapeHTML(config.label)}</h2><p>${escapeHTML(config.description)}</p><a class="btn btn-primary" href="#/chapter/submissions/new?type=${encodeURIComponent(type)}">Start ${icons.arrow}</a></article>`).join("")}
    </section>
    <section class="p5-guidance"><div>${icons.shield}</div><div><strong>Official submissions are reviewed by Prayer Project administration.</strong><p>Saving a draft does not submit it. Once submitted, the record becomes read-only unless an administrator requests changes.</p></div></section>
  `, "/chapter/workflows", "Reports & Requests");
}

function submissionsPage() {
  const filter = hashParams().get("status") || "all";
  const records = state.submissions.filter((item) => filter === "all" || item.status === filter);
  return chapterLayout(`
    ${pageHeading("Submission history", "Chapter submissions", "Track drafts, submitted items, requested corrections, approvals, and denials.", `<a class="btn btn-primary" href="#/chapter/workflows">New submission</a>`)}
    <div class="p5-filter-row">${["all", "draft", "submitted", "under_review", "changes_requested", "approved", "denied"].map((status) => `<a class="${filter === status ? "active" : ""}" href="#/chapter/submissions?status=${status}">${status === "all" ? "All" : STATUS_LABELS[status]}</a>`).join("")}</div>
    <section class="p5-list-card">
      ${state.loading ? `<div class="p5-empty"><div class="spinner"></div><p>Loading submissions…</p></div>` : records.length ? records.map(submissionRow).join("") : `<div class="p5-empty">${icons.report}<h2>No submissions found</h2><p>Create a report or request from the workflow catalog.</p><a class="btn btn-primary" href="#/chapter/workflows">Open workflows</a></div>`}
    </section>
  `, "/chapter/submissions", "My Submissions");
}

function submissionRow(item) {
  const config = typeConfig(item.type) || { label: titleCase(item.type) };
  const editable = item.submittedByUid === state.user.uid && EDITABLE_STATUSES.has(item.status);
  return `<article class="p5-submission-row"><div class="p5-submission-icon">${icons[config.icon] || icons.report}</div><div><strong>${escapeHTML(item.title || config.label)}</strong><span>${escapeHTML(config.label)} · Updated ${escapeHTML(formatDate(item.updatedAt, { time: true }))}</span><small>Submitted by ${escapeHTML(item.submittedByName || "Chapter leader")}</small></div>${badge(item.status)}<a class="btn btn-secondary" href="#/chapter/submissions/${editable ? "edit" : "view"}?id=${encodeURIComponent(item.id)}">${editable ? "Continue" : "View"}</a></article>`;
}

function fieldMarkup(fieldName, value = "") {
  const config = FIELD_CONFIG[fieldName];
  if (!config) return "";
  if (config.type === "checkbox") {
    return `<label class="p5-check"><input type="checkbox" name="${fieldName}" ${value === true ? "checked" : ""}><span><strong>${escapeHTML(config.label)}</strong><small>This confirmation becomes part of the official submission.</small></span></label>`;
  }
  const required = config.required ? "required" : "";
  const attributes = [config.max ? `maxlength="${config.max}"` : "", config.min != null ? `min="${config.min}"` : "", config.max != null && config.type === "number" ? `max="${config.max}"` : "", config.step ? `step="${config.step}"` : ""].filter(Boolean).join(" ");
  if (config.type === "textarea") return `<label class="p5-field"><span>${escapeHTML(config.label)}${config.required ? " *" : ""}</span><textarea name="${fieldName}" ${attributes} ${required}>${escapeHTML(value ?? "")}</textarea></label>`;
  const inputValue = value instanceof Date ? value.toISOString().slice(0, config.type === "datetime-local" ? 16 : 10) : value ?? "";
  return `<label class="p5-field"><span>${escapeHTML(config.label)}${config.required ? " *" : ""}</span><input type="${config.type}" name="${fieldName}" value="${escapeHTML(inputValue)}" placeholder="${escapeHTML(config.placeholder || "")}" ${attributes} ${required}></label>`;
}

function submissionFormPage() {
  const route = routeFromHash();
  const isEdit = route === "/chapter/submissions/edit";
  const type = isEdit ? state.currentSubmission?.type : hashParams().get("type");
  const config = typeConfig(type);
  if (!config || !canUseType(type)) return chapterLayout(`<section class="p5-empty">${icons.alert}<h1>Workflow unavailable</h1><p>This workflow is not available for your current chapter role.</p><a class="btn btn-primary" href="#/chapter/workflows">Return to workflows</a></section>`, "/chapter/workflows");
  const item = state.currentSubmission || {};
  const title = item.title || config.label;
  const editable = !isEdit || (item.submittedByUid === state.user.uid && EDITABLE_STATUSES.has(item.status));
  if (!editable) return chapterLayout(`<section class="p5-empty">${icons.alert}<h1>Submission is read-only</h1><p>This item cannot currently be edited.</p><a class="btn btn-primary" href="#/chapter/submissions/view?id=${encodeURIComponent(item.id || "")}">View submission</a></section>`, "/chapter/submissions");
  return chapterLayout(`
    ${pageHeading(isEdit ? "Continue submission" : "New submission", title, config.description, item.status ? badge(item.status) : "")}
    ${item.status === "changes_requested" && item.reviewNote ? `<div class="p5-review-alert">${icons.alert}<div><strong>Changes requested</strong><p>${escapeHTML(item.reviewNote)}</p></div></div>` : ""}
    <form class="p5-form-card" id="p5-submission-form" data-type="${escapeHTML(type)}" data-id="${escapeHTML(item.id || "")}" novalidate>
      <section><h2>Submission information</h2><div class="p5-form-grid"><label class="p5-field p5-span-2"><span>Submission title *</span><input name="title" maxlength="180" value="${escapeHTML(item.title || config.label)}" required></label>${config.fields.map((field) => fieldMarkup(field, item[field])).join("")}</div></section>
      <section><h2>Attachments</h2><p>Attach up to ${FILE_LIMIT} PDF, Word, PNG, or JPEG files. Each file may be no larger than 10 MB.</p>${attachmentsMarkup(item)}<label class="p5-upload">${icons.attachment}<span><strong>Add files</strong><small>PDF, DOC, DOCX, PNG, or JPEG</small></span><input id="p5-files" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"></label>${config.attachmentRequired ? `<p class="p5-required-note">At least one attachment is required for this workflow.</p>` : ""}</section>
      <div id="p5-form-alert"></div>
      <footer class="p5-form-actions"><a class="btn btn-secondary" href="#/chapter/submissions">Cancel</a><button class="btn btn-secondary" name="intent" value="draft" type="submit">Save draft</button><button class="btn btn-primary" name="intent" value="submit" type="submit">Submit for review</button></footer>
    </form>
  `, "/chapter/submissions", isEdit ? "Edit Submission" : "New Submission");
}

function attachmentsMarkup(item) {
  if (!item.id || !state.attachments.length) return `<div class="p5-attachment-list"><p>No files attached yet.</p></div>`;
  return `<div class="p5-attachment-list">${state.attachments.map((attachment) => `<article><div>${icons.attachment}<span><strong>${escapeHTML(attachment.fileName)}</strong><small>${Math.max(1, Math.round((attachment.size || 0) / 1024))} KB · Private Firestore file</small></span></div><div><button class="btn btn-secondary" type="button" data-p5-action="download-attachment" data-id="${escapeHTML(attachment.id)}" data-file-name="${escapeHTML(attachment.fileName)}" data-content-type="${escapeHTML(attachment.contentType)}">Download</button>${EDITABLE_STATUSES.has(item.status) && item.submittedByUid === state.user.uid ? `<button class="btn btn-secondary" type="button" data-p5-action="delete-attachment" data-id="${escapeHTML(attachment.id)}">Remove</button>` : ""}</div></article>`).join("")}</div>`;
}

function submissionViewPage() {
  const item = state.currentSubmission;
  if (!item) return chapterLayout(`<section class="p5-empty">${icons.alert}<h1>Submission not found</h1><p>The requested record is unavailable.</p><a class="btn btn-primary" href="#/chapter/submissions">Return to submissions</a></section>`, "/chapter/submissions");
  const config = typeConfig(item.type) || { label: titleCase(item.type), fields: [] };
  const visibleFields = config.fields.filter((field) => item[field] !== "" && item[field] !== null && item[field] !== false && item[field] !== 0);
  const editable = item.submittedByUid === state.user.uid && EDITABLE_STATUSES.has(item.status);
  return chapterLayout(`
    ${pageHeading(config.label, item.title || config.label, `Created ${formatDate(item.createdAt, { time: true })}`, `${badge(item.status)}${editable ? `<a class="btn btn-primary" href="#/chapter/submissions/edit?id=${encodeURIComponent(item.id)}">Edit</a>` : ""}`)}
    ${item.reviewNote ? `<section class="p5-review-box"><h2>Administrative review</h2><p>${escapeHTML(item.reviewNote)}</p><small>${item.reviewedAt ? `Updated ${escapeHTML(formatDate(item.reviewedAt, { time: true }))}` : ""}</small></section>` : ""}
    <section class="p5-detail-card"><dl><div><dt>Chapter</dt><dd>${escapeHTML(item.chapterName)}</dd></div><div><dt>Submitted by</dt><dd>${escapeHTML(item.submittedByName)} · ${escapeHTML(titleCase(item.submittedByRole))}</dd></div><div><dt>Submitted</dt><dd>${escapeHTML(formatDate(item.submittedAt, { time: true, fallback: "Not submitted" }))}</dd></div>${visibleFields.map((field) => `<div class="${["summary", "details", "nextSteps", "supervisionPlan", "transportationPlan", "budgetNotes", "currentValue", "proposedValue"].includes(field) ? "wide" : ""}"><dt>${escapeHTML(FIELD_CONFIG[field]?.label || titleCase(field))}</dt><dd>${typeof item[field] === "boolean" ? (item[field] ? "Confirmed" : "Not confirmed") : escapeHTML(String(item[field]))}</dd></div>`).join("")}</dl></section>
    <section class="p5-detail-card"><h2>Attachments</h2>${attachmentsMarkup(item)}</section>
    ${["submitted", "under_review", "changes_requested"].includes(item.status) && item.submittedByUid === state.user.uid ? `<button class="btn btn-secondary" type="button" data-p5-action="withdraw-submission" data-id="${escapeHTML(item.id)}">Withdraw submission</button>` : ""}
  `, "/chapter/submissions", "Submission Details");
}

function adminSubmissionsPage() {
  const selectedId = hashParams().get("id");
  const selected = state.adminSubmissions.find((item) => item.id === selectedId) || null;
  const statusFilter = hashParams().get("status") || "active";
  const typeFilter = hashParams().get("type") || "all";
  const statusSet = statusFilter === "active" ? new Set(["submitted", "under_review", "changes_requested"]) : null;
  const records = state.adminSubmissions.filter((item) => (statusFilter === "all" || (statusSet ? statusSet.has(item.status) : item.status === statusFilter)) && (typeFilter === "all" || item.type === typeFilter));
  return adminLayout(`
    ${pageHeading("Administrative review", "Chapter submission queue", "Review reports, event proposals, renewals, confirmations, documents, and change requests.", `<button class="btn btn-secondary" type="button" data-p5-action="refresh-admin">Refresh</button>`)}
    <section class="p5-admin-grid">
      <div>
        <div class="p5-admin-filters"><select id="p5-admin-status"><option value="active" ${statusFilter === "active" ? "selected" : ""}>Active review queue</option>${["all", "submitted", "under_review", "changes_requested", "approved", "denied", "withdrawn"].map((value) => `<option value="${value}" ${statusFilter === value ? "selected" : ""}>${value === "all" ? "All statuses" : STATUS_LABELS[value]}</option>`).join("")}</select><select id="p5-admin-type"><option value="all">All workflow types</option>${Object.entries(TYPE_CONFIG).map(([value, config]) => `<option value="${value}" ${typeFilter === value ? "selected" : ""}>${escapeHTML(config.label)}</option>`).join("")}</select></div>
        <div class="p5-admin-list">${state.adminLoading ? `<div class="p5-empty"><div class="spinner"></div><p>Loading queue…</p></div>` : records.length ? records.map((item) => `<a class="${selectedId === item.id ? "active" : ""}" href="#/admin/submissions?id=${encodeURIComponent(item.id)}&status=${encodeURIComponent(statusFilter)}&type=${encodeURIComponent(typeFilter)}"><div><strong>${escapeHTML(item.title)}</strong><span>${escapeHTML(item.chapterName)} · ${escapeHTML(TYPE_CONFIG[item.type]?.label || titleCase(item.type))}</span><small>${escapeHTML(formatDate(item.updatedAt, { time: true }))}</small></div>${badge(item.status)}</a>`).join("") : `<div class="p5-empty"><p>No matching submissions.</p></div>`}</div>
      </div>
      <div>${selected ? adminReviewPanel(selected) : `<section class="p5-empty p5-review-placeholder">${icons.review}<h2>Select a submission</h2><p>Choose an item from the queue to review its details and attachments.</p></section>`}</div>
    </section>
  `);
}

function adminReviewPanel(item) {
  const config = typeConfig(item.type) || { label: titleCase(item.type), fields: [] };
  const visibleFields = config.fields.filter((field) => item[field] !== "" && item[field] !== null && item[field] !== false && item[field] !== 0);
  return `<section class="p5-review-panel"><header><div><p>${escapeHTML(config.label)}</p><h2>${escapeHTML(item.title)}</h2><span>${escapeHTML(item.chapterName)} · ${escapeHTML(item.chapterId)}</span></div>${badge(item.status)}</header><dl><div><dt>Submitted by</dt><dd>${escapeHTML(item.submittedByName)} (${escapeHTML(titleCase(item.submittedByRole))})</dd></div><div><dt>Submitted</dt><dd>${escapeHTML(formatDate(item.submittedAt, { time: true }))}</dd></div>${visibleFields.map((field) => `<div class="wide"><dt>${escapeHTML(FIELD_CONFIG[field]?.label || titleCase(field))}</dt><dd>${typeof item[field] === "boolean" ? (item[field] ? "Confirmed" : "Not confirmed") : escapeHTML(String(item[field]))}</dd></div>`).join("")}</dl><div class="p5-review-attachments" id="p5-admin-attachments"><button class="btn btn-secondary" type="button" data-p5-action="load-admin-attachments" data-id="${escapeHTML(item.id)}">Load attachments</button></div><label class="p5-field"><span>Review note</span><textarea id="p5-review-note" maxlength="3000">${escapeHTML(item.reviewNote || "")}</textarea></label><div id="p5-review-alert"></div><footer><button class="btn btn-secondary" type="button" data-p5-review="under_review" data-id="${escapeHTML(item.id)}">Mark under review</button><button class="btn btn-secondary" type="button" data-p5-review="changes_requested" data-id="${escapeHTML(item.id)}">Request changes</button><button class="btn btn-secondary" type="button" data-p5-review="denied" data-id="${escapeHTML(item.id)}">Deny</button><button class="btn btn-primary" type="button" data-p5-review="approved" data-id="${escapeHTML(item.id)}">Approve</button></footer></section>`;
}

function gatePage(message) {
  return `<main class="p5-gate" id="main-content"><section><img src="assets/brand-mark.svg" alt=""><h1>Workflow access unavailable</h1><p>${escapeHTML(message)}</p><a class="btn btn-primary" href="#/dashboard">Return to dashboard</a></section></main>`;
}

function blankSubmission(type, title) {
  return {
    chapterId: state.selectedChapterId,
    chapterName: currentMembership()?.chapterName || state.chapter?.officialName || "Prayer Project Chapter",
    type,
    title,
    status: "draft",
    submittedByUid: state.user.uid,
    submittedByName: state.profile?.displayName || state.user.displayName || state.user.email,
    submittedByRole: currentMembership()?.role || "chapterUser",
    reportingPeriod: "",
    meetingDate: "",
    eventDate: "",
    eventLocation: "",
    requestedStartDate: "",
    requestedEndDate: "",
    currentValue: "",
    proposedValue: "",
    requestedChange: "",
    summary: "",
    details: "",
    nextSteps: "",
    supervisionPlan: "",
    transportationPlan: "",
    budgetNotes: "",
    attendance: 0,
    volunteerCount: 0,
    volunteerHours: 0,
    institutionalApprovalConfirmed: false,
    leadershipRosterConfirmed: false,
    supervisionConfirmed: false,
    attachmentCount: 0,
    version: 1,
    submittedAt: null,
    reviewNote: "",
    reviewedByUid: "",
    reviewedByName: "",
    reviewedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function collectFormData(form, base) {
  const config = typeConfig(base.type);
  const data = { ...base, title: form.title.value.trim() };
  delete data.id;
  for (const field of config.fields) {
    const input = form.elements[field];
    const fieldConfig = FIELD_CONFIG[field];
    if (!input || !fieldConfig) continue;
    if (fieldConfig.type === "checkbox") data[field] = input.checked;
    else if (fieldConfig.type === "number") data[field] = Number(input.value || 0);
    else data[field] = input.value.trim();
  }
  data.updatedAt = serverTimestamp();
  return data;
}

function validateFiles(files, existingCount = 0) {
  return validateAttachmentFiles(files, existingCount);
}

async function uploadAttachments(submissionId, files) {
  const uploaded = [];
  for (const item of files) {
    const attachmentRef = doc(collection(db, "chapterSubmissions", submissionId, "attachments"));
    await saveFirestoreAttachment({
      db,
      attachmentRef,
      item,
      metadata: {
        chapterId: state.selectedChapterId,
        submissionId,
        uploadedByUid: state.user.uid
      }
    });
    uploaded.push(attachmentRef.id);
  }
  return uploaded;
}

async function handleSubmissionForm(form, submitter) {
  const intent = submitter?.value || "draft";
  const type = form.dataset.type;
  const config = typeConfig(type);
  const existing = state.currentSubmission;
  const base = existing || blankSubmission(type, form.title.value.trim() || config.label);
  const selectedFiles = Array.from(document.querySelector("#p5-files")?.files || []);
  let files = [];
  try {
    if (!form.reportValidity()) return;
    files = validateFiles(selectedFiles, state.attachments.length);
    if (config.attachmentRequired && !state.attachments.length && !files.length) throw new Error("This workflow requires at least one attachment.");
    const submissionRef = existing ? doc(db, "chapterSubmissions", existing.id) : doc(collection(db, "chapterSubmissions"));
    const data = collectFormData(form, base);

    if (!existing) {
      data.status = "draft";
      data.submittedAt = null;
      data.attachmentCount = 0;
      await setDoc(submissionRef, data);
    }

    if (files.length) await uploadAttachments(submissionRef.id, files);

    data.attachmentCount = state.attachments.length + files.length;
    data.status = intent === "submit" ? "submitted" : "draft";
    data.submittedAt = intent === "submit" ? serverTimestamp() : null;
    data.updatedAt = serverTimestamp();

    if (existing) await updateDoc(submissionRef, data);
    else await updateDoc(submissionRef, {
      attachmentCount: data.attachmentCount,
      status: data.status,
      submittedAt: data.submittedAt,
      updatedAt: serverTimestamp()
    });

    navigate(`/chapter/submissions/view?id=${encodeURIComponent(submissionRef.id)}`);
  } catch (error) {
    setAlert("p5-form-alert", "danger", "Submission not saved", error.message || "The submission could not be completed.");
  }
}

async function deleteAttachment(id) {
  const attachment = state.attachments.find((item) => item.id === id);
  if (!attachment || !state.currentSubmission || !EDITABLE_STATUSES.has(state.currentSubmission.status)) return;
  if (!confirm(`Remove ${attachment.fileName}?`)) return;
  await deleteFirestoreAttachment({
    db,
    attachmentRef: doc(db, "chapterSubmissions", state.currentSubmission.id, "attachments", id)
  });
  await updateDoc(doc(db, "chapterSubmissions", state.currentSubmission.id), {
    attachmentCount: Math.max(0, (state.currentSubmission.attachmentCount || state.attachments.length) - 1),
    updatedAt: serverTimestamp()
  });
  await loadSubmission(state.currentSubmission.id);
  renderPhase5();
}

async function withdrawSubmission(id) {
  if (!confirm("Withdraw this submission? It will remain in the chapter record but will leave the active review queue.")) return;
  await updateDoc(doc(db, "chapterSubmissions", id), { status: "withdrawn", updatedAt: serverTimestamp() });
  await loadSubmission(id);
  renderPhase5();
}

async function reviewSubmission(id, status) {
  const note = document.querySelector("#p5-review-note")?.value.trim() || "";
  if (["changes_requested", "denied"].includes(status) && note.length < 10) {
    setAlert("p5-review-alert", "warning", "Review note required", "Explain the requested changes or denial in at least 10 characters.");
    return;
  }
  const item = state.adminSubmissions.find((entry) => entry.id === id);
  await updateDoc(doc(db, "chapterSubmissions", id), {
    status,
    reviewNote: note,
    reviewedByUid: state.user.uid,
    reviewedByName: state.profile?.displayName || state.user.email,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if (status === "approved" && item?.type === "adviser_confirmation") {
    await updateDoc(doc(db, "chapters", item.chapterId), {
      adviserConfirmationStatus: "confirmed",
      adviserConfirmationLastConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  if (status === "approved" && item?.type === "annual_renewal") {
    await updateDoc(doc(db, "chapters", item.chapterId), {
      renewalStatus: "approved",
      lastRenewalApprovedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  await loadAdminSubmissions();
}

async function downloadSubmissionAttachment(submissionId, attachmentId, fileName, contentType, button = null) {
  if (button) button.disabled = true;
  try {
    await downloadFirestoreAttachment({
      attachmentRef: doc(db, "chapterSubmissions", submissionId, "attachments", attachmentId),
      fileName,
      contentType
    });
  } catch (error) {
    alert(error.message || "The attachment could not be downloaded.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadAdminAttachments(id) {
  const target = document.querySelector("#p5-admin-attachments");
  if (!target) return;
  target.innerHTML = `<div class="spinner"></div>`;
  const snapshot = await getDocs(collection(db, "chapterSubmissions", id, "attachments"));
  const attachments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  target.innerHTML = attachments.length ? attachments.map((attachment) => `<button class="btn btn-secondary" type="button" data-p5-admin-download data-submission-id="${escapeHTML(id)}" data-id="${escapeHTML(attachment.id)}" data-file-name="${escapeHTML(attachment.fileName)}" data-content-type="${escapeHTML(attachment.contentType)}">${icons.attachment}<span><strong>${escapeHTML(attachment.fileName)}</strong><small>${Math.max(1, Math.round((attachment.size || 0) / 1024))} KB · Download</small></span></button>`).join("") : `<p>No attachments.</p>`;
  target.querySelectorAll("[data-p5-admin-download]").forEach((button) => button.addEventListener("click", () => downloadSubmissionAttachment(button.dataset.submissionId, button.dataset.id, button.dataset.fileName, button.dataset.contentType, button)));
}

function setAlert(targetId, type, title, message) {
  const target = document.querySelector(`#${targetId}`);
  if (target) target.innerHTML = `<div class="p5-alert p5-${type}">${type === "success" ? icons.check : icons.alert}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div></div>`;
}

function augmentExistingNavigation() {
  if (PHASE5_ROUTES.has(routeFromHash())) return;
  const phase4Nav = document.querySelector(".p4-nav");
  if (phase4Nav && CHAPTER_ROLES.has(state.profile?.systemRole) && !document.querySelector("[data-p5-nav-workflows]")) {
    const accountLabel = Array.from(phase4Nav.querySelectorAll(".p4-nav-label")).find((item) => item.textContent.trim() === "Account");
    const workflows = document.createElement("a");
    workflows.className = "p4-nav-link";
    workflows.href = "#/chapter/workflows";
    workflows.dataset.p5NavWorkflows = "true";
    workflows.innerHTML = `${icons.workflow}<span>Reports & requests</span>`;
    phase4Nav.insertBefore(workflows, accountLabel || null);
    const submissions = document.createElement("a");
    submissions.className = "p4-nav-link";
    submissions.href = "#/chapter/submissions";
    submissions.dataset.p5NavSubmissions = "true";
    submissions.innerHTML = `${icons.report}<span>My submissions</span>`;
    phase4Nav.insertBefore(submissions, accountLabel || null);
  }
  const adminNav = document.querySelector(".p4a-nav, .phase3-admin-nav");
  if (adminNav && ADMIN_ROLES.has(state.profile?.systemRole) && !document.querySelector("[data-p5-admin-nav]")) {
    const link = document.createElement("a");
    link.href = "#/admin/submissions";
    link.dataset.p5AdminNav = "true";
    link.className = adminNav.classList.contains("p4a-nav") ? "p4a-nav-link" : "phase3-admin-link";
    link.innerHTML = `${icons.review}<span>Review submissions</span>`;
    adminNav.append(link);
  }
}

function bindEvents() {
  document.querySelector("#p5-chapter-selector")?.addEventListener("change", async (event) => {
    state.selectedChapterId = event.target.value;
    localStorage.setItem(`tpp-selected-chapter-${state.user.uid}`, state.selectedChapterId);
    await Promise.all([loadChapterContext(), loadSubmissions()]);
    navigate("/chapter/workflows");
  });
  document.querySelector("#p5-submission-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSubmissionForm(event.currentTarget, event.submitter);
  });
  document.querySelectorAll('[data-p5-action="download-attachment"]').forEach((button) => button.addEventListener("click", () => downloadSubmissionAttachment(state.currentSubmission.id, button.dataset.id, button.dataset.fileName, button.dataset.contentType, button)));
  document.querySelectorAll('[data-p5-action="delete-attachment"]').forEach((button) => button.addEventListener("click", () => deleteAttachment(button.dataset.id)));
  document.querySelectorAll('[data-p5-action="withdraw-submission"]').forEach((button) => button.addEventListener("click", () => withdrawSubmission(button.dataset.id)));
  document.querySelectorAll("[data-p5-review]").forEach((button) => button.addEventListener("click", () => reviewSubmission(button.dataset.id, button.dataset.p5Review)));
  document.querySelectorAll('[data-p5-action="load-admin-attachments"]').forEach((button) => button.addEventListener("click", () => loadAdminAttachments(button.dataset.id)));
  document.querySelectorAll('[data-p5-action="refresh-admin"]').forEach((button) => button.addEventListener("click", loadAdminSubmissions));
  document.querySelectorAll('[data-p5-action="sign-out"]').forEach((button) => button.addEventListener("click", async () => { await signOut(auth); navigate("/login"); }));
  document.querySelector("#p5-admin-status")?.addEventListener("change", updateAdminFilters);
  document.querySelector("#p5-admin-type")?.addEventListener("change", updateAdminFilters);
}

function updateAdminFilters() {
  const status = document.querySelector("#p5-admin-status")?.value || "active";
  const type = document.querySelector("#p5-admin-type")?.value || "all";
  navigate(`/admin/submissions?status=${encodeURIComponent(status)}&type=${encodeURIComponent(type)}`);
}

async function prepareRoute(route) {
  if (CHAPTER_ROUTES.has(route)) {
    if (!state.user || !state.profile || !CHAPTER_ROLES.has(state.profile.systemRole)) return;
    if (!state.memberships.length) await loadMemberships();
    if (state.selectedChapterId) {
      await loadChapterContext();
      if (!state.submissions.length || route === "/chapter/submissions") await loadSubmissions();
    }
    if (["/chapter/submissions/edit", "/chapter/submissions/view"].includes(route)) await loadSubmission(hashParams().get("id"));
  }
  if (route === "/admin/submissions" && ADMIN_ROLES.has(state.profile?.systemRole) && !state.adminSubmissions.length) await loadAdminSubmissions();
}

async function renderPhase5() {
  const route = routeFromHash();
  if (!PHASE5_ROUTES.has(route)) {
    augmentExistingNavigation();
    return;
  }
  if (!state.authReady || state.rendering) return;
  state.rendering = true;
  try {
    await prepareRoute(route);
    if (!state.user) {
      navigate("/login");
      return;
    }
    if (CHAPTER_ROUTES.has(route)) {
      if (!state.profile || !CHAPTER_ROLES.has(state.profile.systemRole)) {
        app.innerHTML = gatePage("An active Director or Adviser account is required.");
      } else if (!state.memberships.length) {
        app.innerHTML = gatePage("No active chapter membership was found for this account.");
      } else {
        const pages = {
          "/chapter/workflows": workflowsPage,
          "/chapter/submissions": submissionsPage,
          "/chapter/submissions/new": submissionFormPage,
          "/chapter/submissions/edit": submissionFormPage,
          "/chapter/submissions/view": submissionViewPage
        };
        app.innerHTML = pages[route]();
      }
    } else if (!state.profile || !ADMIN_ROLES.has(state.profile.systemRole)) {
      app.innerHTML = gatePage("Owner, Chapter Administrator, or Compliance Administrator access is required.");
    } else {
      app.innerHTML = adminSubmissionsPage();
    }
    bindEvents();
    document.title = route === "/admin/submissions" ? "Submission Review | The Prayer Project" : "Reports & Requests | The Prayer Project";
  } catch (error) {
    console.error("Unable to render Phase 5.", error);
    app.innerHTML = gatePage("The workflow area could not be loaded. Refresh the page or contact Prayer Project support.");
  } finally {
    state.rendering = false;
  }
}

window.addEventListener("hashchange", () => queueMicrotask(renderPhase5));
const observer = new MutationObserver(() => queueMicrotask(augmentExistingNavigation));
observer.observe(app, { childList: true, subtree: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  await loadProfile(user);
  state.authReady = true;
  if (user && CHAPTER_ROLES.has(state.profile?.systemRole)) await loadMemberships();
  await renderPhase5();
});
