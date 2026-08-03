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
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js";
import { auth, db, storage, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");

const CHAPTER_ROLES = new Set(["director", "adviser", "chapterUser"]);
const SUPPORT_STAFF_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin", "supportAgent"]);
const NOTICE_MANAGER_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin"]);
const CHAPTER_ROUTES = new Set([
  "/chapter/communications",
  "/chapter/support",
  "/chapter/support/new",
  "/chapter/support/ticket"
]);
const ADMIN_ROUTES = new Set([
  "/admin/support",
  "/admin/support/ticket",
  "/admin/communications"
]);
const PHASE6_ROUTES = new Set([...CHAPTER_ROUTES, ...ADMIN_ROUTES]);

const FILE_LIMIT = 5;
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
]);

const CATEGORY_LABELS = Object.freeze({
  general_assistance: "General Assistance",
  technical_support: "Technical Support",
  chapter_compliance: "Chapter Compliance",
  document_review: "Document Review",
  leadership_change: "Leadership Change",
  renewal_assistance: "Renewal Assistance",
  institutional_concern: "Institutional Concern",
  urgent_safety_concern: "Urgent Safety Concern"
});

const STATUS_LABELS = Object.freeze({
  open: "Open",
  awaiting_staff: "Awaiting Staff",
  awaiting_chapter: "Awaiting Chapter",
  under_review: "Under Review",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed"
});

const PRIORITY_LABELS = Object.freeze({
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent"
});

const state = {
  authReady: false,
  user: null,
  profile: null,
  memberships: [],
  selectedChapterId: null,
  chapter: null,
  tickets: [],
  adminTickets: [],
  readStates: new Map(),
  notices: [],
  noticeReceipts: new Map(),
  currentTicket: null,
  messages: [],
  internalNotes: [],
  listeners: [],
  routeLoading: false,
  rendering: false,
  mobileOpen: false,
  adminFilter: { status: "active", category: "all", priority: "all" }
};

const icons = {
  home: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>`,
  chat: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>`,
  bell: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>`,
  plus: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>`,
  send: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/></svg>`,
  attachment: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5L14 1a4 4 0 0 1 5.7 5.7L9.6 16.8a2 2 0 1 1-2.8-2.8l8.5-8.5"/></svg>`,
  lock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
  user: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  users: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0"/></svg>`,
  note: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/></svg>`,
  alert: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2 21h20zM12 9v5m0 3h.01"/></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6"/></svg>`,
  clock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`,
  menu: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  logout: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>`,
  refresh: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M17.9 15A7 7 0 0 1 6 18l-2-5"/></svg>`,
  arrow: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`
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

function formatDate(value, { time = false, fallback = "Not available" } = {}) {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {})
  }).format(date);
}

function formatRelative(value) {
  const date = toDate(value);
  if (!date) return "No activity";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDate(date);
}

function roleLabel(role) {
  const labels = {
    owner: "Owner",
    chapterAdmin: "Chapter Administrator",
    complianceAdmin: "Compliance Administrator",
    supportAgent: "Support Agent",
    director: "Chapter Director",
    adviser: "Chapter Adviser",
    chapterUser: "Chapter Member"
  };
  return labels[role] || titleCase(role || "User");
}

function selectedMembership() {
  return state.memberships.find((item) => item.chapterId === state.selectedChapterId) || null;
}

function initials(value = "TP") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "TP").toUpperCase();
}

function statusTone(status) {
  if (["resolved", "closed"].includes(status)) return "success";
  if (["open", "awaiting_staff", "awaiting_chapter"].includes(status)) return "info";
  if (["under_review", "escalated"].includes(status)) return "warning";
  return "neutral";
}

function priorityTone(priority) {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "neutral";
  return "info";
}

function isUnread(ticket) {
  const read = state.readStates.get(ticket.id);
  const last = toDate(ticket.lastMessageAt)?.getTime() || 0;
  const lastRead = toDate(read?.lastReadAt)?.getTime() || 0;
  return ticket.lastMessageByUid !== state.user?.uid && last > lastRead;
}

function unreadCount() {
  return state.tickets.filter(isUnread).length;
}

function noticeUnreadCount() {
  return state.notices.filter((notice) => notice.requireAcknowledgment && !state.noticeReceipts.has(notice.id)).length;
}

function safeFileName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140);
}

function validateFiles(files) {
  const items = Array.from(files || []);
  if (items.length > FILE_LIMIT) throw new Error(`Attach no more than ${FILE_LIMIT} files.`);
  for (const file of items) {
    if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name} is not an approved file type.`);
    if (file.size > FILE_SIZE_LIMIT) throw new Error(`${file.name} is larger than 10 MB.`);
  }
  return items;
}

function cleanupListeners() {
  state.listeners.forEach((unsubscribe) => {
    try { unsubscribe(); } catch { /* no-op */ }
  });
  state.listeners = [];
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
}

async function loadChapterContext() {
  state.chapter = null;
  state.notices = [];
  state.noticeReceipts = new Map();
  if (!state.selectedChapterId) return;
  const chapterRef = doc(db, "chapters", state.selectedChapterId);
  const [chapterSnapshot, noticesSnapshot] = await Promise.all([
    getDoc(chapterRef),
    getDocs(collection(chapterRef, "notices"))
  ]);
  state.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;
  state.notices = noticesSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.active !== false && (!toDate(item.expiresAt) || toDate(item.expiresAt).getTime() > Date.now()))
    .sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
  await Promise.all(state.notices.map(async (notice) => {
    const receiptId = `${notice.id}__${state.user.uid}`;
    const receipt = await getDoc(doc(chapterRef, "noticeReceipts", receiptId));
    if (receipt.exists()) state.noticeReceipts.set(notice.id, receipt.data());
  }));
}

function subscribeReadStates() {
  if (!state.user) return;
  const unsubscribe = onSnapshot(
    query(collection(db, "supportReadStates"), where("uid", "==", state.user.uid)),
    (snapshot) => {
      state.readStates = new Map(snapshot.docs.map((item) => [item.data().ticketId, { id: item.id, ...item.data() }]));
      if (PHASE6_ROUTES.has(routeFromHash())) renderPhase6({ prepare: false });
      else augmentExistingNavigation();
    },
    (error) => console.warn("Unable to subscribe to support read states.", error)
  );
  state.listeners.push(unsubscribe);
}

function subscribeChapterTickets() {
  if (!state.user || !state.selectedChapterId) return;
  const records = new Map();
  const publish = () => {
    state.tickets = Array.from(records.values())
      .sort((a, b) => (toDate(b.lastMessageAt)?.getTime() || 0) - (toDate(a.lastMessageAt)?.getTime() || 0));
    if (PHASE6_ROUTES.has(routeFromHash()) && !state.rendering) renderPhase6({ prepare: false });
    else augmentExistingNavigation();
  };
  const shared = query(
    collection(db, "supportTickets"),
    where("chapterId", "==", state.selectedChapterId),
    where("visibility", "==", "chapter")
  );
  const personal = query(
    collection(db, "supportTickets"),
    where("chapterId", "==", state.selectedChapterId),
    where("visibility", "==", "adviser_private"),
    where("createdByUid", "==", state.user.uid)
  );
  state.listeners.push(onSnapshot(shared, (snapshot) => {
    snapshot.docChanges().forEach((change) => change.type === "removed" ? records.delete(change.doc.id) : records.set(change.doc.id, { id: change.doc.id, ...change.doc.data() }));
    publish();
  }, (error) => console.warn("Unable to load shared support tickets.", error)));
  state.listeners.push(onSnapshot(personal, (snapshot) => {
    snapshot.docChanges().forEach((change) => change.type === "removed" ? records.delete(change.doc.id) : records.set(change.doc.id, { id: change.doc.id, ...change.doc.data() }));
    publish();
  }, (error) => console.warn("Unable to load personal support tickets.", error)));
}

function subscribeAdminTickets() {
  const unsubscribe = onSnapshot(
    query(collection(db, "supportTickets"), orderBy("lastMessageAt", "desc"), limit(250)),
    (snapshot) => {
      state.adminTickets = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (ADMIN_ROUTES.has(routeFromHash()) && !state.rendering) renderPhase6({ prepare: false });
    },
    (error) => console.warn("Unable to subscribe to support queue.", error)
  );
  state.listeners.push(unsubscribe);
}

async function loadTicket(ticketId) {
  state.currentTicket = null;
  state.messages = [];
  state.internalNotes = [];
  if (!ticketId) return;
  const snapshot = await getDoc(doc(db, "supportTickets", ticketId));
  if (!snapshot.exists()) throw new Error("This support ticket could not be found.");
  state.currentTicket = { id: snapshot.id, ...snapshot.data() };
  subscribeTicketMessages(ticketId);
  if (SUPPORT_STAFF_ROLES.has(state.profile?.systemRole)) subscribeInternalNotes(ticketId);
  await markTicketRead(ticketId, state.currentTicket.chapterId);
}

function subscribeTicketMessages(ticketId) {
  const unsubscribe = onSnapshot(
    query(collection(db, "supportTickets", ticketId, "messages"), orderBy("createdAt", "asc")),
    async (snapshot) => {
      state.messages = await Promise.all(snapshot.docs.map(async (messageDoc) => {
        const attachmentSnapshot = await getDocs(collection(messageDoc.ref, "attachments"));
        return {
          id: messageDoc.id,
          ...messageDoc.data(),
          attachments: attachmentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        };
      }));
      if (routeFromHash().endsWith("/ticket")) {
        await markTicketRead(ticketId, state.currentTicket?.chapterId);
        renderPhase6({ prepare: false });
        queueMicrotask(scrollMessagesToBottom);
      }
    },
    (error) => console.warn("Unable to subscribe to support messages.", error)
  );
  state.listeners.push(unsubscribe);
}

function subscribeInternalNotes(ticketId) {
  const unsubscribe = onSnapshot(
    query(collection(db, "supportTickets", ticketId, "internalNotes"), orderBy("createdAt", "asc")),
    (snapshot) => {
      state.internalNotes = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (routeFromHash() === "/admin/support/ticket" && !state.rendering) renderPhase6({ prepare: false });
    },
    (error) => console.warn("Unable to subscribe to internal notes.", error)
  );
  state.listeners.push(unsubscribe);
}

async function markTicketRead(ticketId, chapterId) {
  if (!state.user || !ticketId || !chapterId) return;
  await setDoc(doc(db, "supportReadStates", `${ticketId}__${state.user.uid}`), {
    ticketId,
    chapterId,
    uid: state.user.uid,
    lastReadAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function brand() {
  return `<a class="p6-brand" href="#/chapter/communications"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Chapter Communications</small></span></a>`;
}

function chapterSelector() {
  if (state.memberships.length < 2) {
    const membership = selectedMembership();
    return `<div class="p6-chapter-static"><strong>${escapeHTML(membership?.chapterName || state.chapter?.officialName || "Chapter")}</strong><span>${escapeHTML(state.selectedChapterId || "")}</span></div>`;
  }
  return `<label class="p6-chapter-select"><span>Current chapter</span><select id="p6-chapter-selector">${state.memberships.map((item) => `<option value="${escapeHTML(item.chapterId)}" ${item.chapterId === state.selectedChapterId ? "selected" : ""}>${escapeHTML(item.chapterName)}</option>`).join("")}</select></label>`;
}

function chapterLayout(content, active = "/chapter/communications", title = "Communications") {
  const membership = selectedMembership();
  const userName = state.profile?.displayName || state.user?.displayName || state.user?.email || "Chapter Leader";
  return `
    <div class="p6-shell" data-phase6-root>
      <aside class="p6-sidebar ${state.mobileOpen ? "open" : ""}">
        <div class="p6-sidebar-brand">${brand()}</div>
        <div class="p6-sidebar-chapter">${chapterSelector()}</div>
        <nav class="p6-nav" aria-label="Chapter communications navigation">
          <span class="p6-nav-label">Communications</span>
          <a class="p6-nav-link ${active === "/chapter/communications" ? "active" : ""}" href="#/chapter/communications">${icons.bell}<span>Communications</span>${noticeUnreadCount() + unreadCount() ? `<em>${noticeUnreadCount() + unreadCount()}</em>` : ""}</a>
          <a class="p6-nav-link ${active === "/chapter/support" ? "active" : ""}" href="#/chapter/support">${icons.chat}<span>Support center</span>${unreadCount() ? `<em>${unreadCount()}</em>` : ""}</a>
          <a class="p6-nav-link" href="#/chapter/support/new">${icons.plus}<span>New support ticket</span></a>
          <span class="p6-nav-label">Chapter portal</span>
          <a class="p6-nav-link" href="#/chapter/overview">${icons.home}<span>Chapter overview</span></a>
          <a class="p6-nav-link" href="#/chapter/submissions">${icons.note}<span>Reports & requests</span></a>
          <a class="p6-nav-link" href="#/profile">${icons.user}<span>My profile</span></a>
          <button class="p6-nav-link" type="button" data-p6-action="sign-out">${icons.logout}<span>Sign out</span></button>
        </nav>
        <div class="p6-sidebar-user"><div>${escapeHTML(initials(userName))}</div><span><strong>${escapeHTML(userName)}</strong><small>${escapeHTML(roleLabel(membership?.role))}</small></span></div>
      </aside>
      <div class="p6-main">
        <header class="p6-topbar"><button class="p6-icon-button p6-menu" type="button" data-p6-action="mobile">${icons.menu}</button><div><span>Chapter Communications</span><strong>${escapeHTML(title)}</strong></div><a class="p6-topbar-action" href="#/chapter/support/new">${icons.plus}<span>New ticket</span></a></header>
        <main class="p6-content" id="main-content">${content}</main>
      </div>
      <div class="toast-region" id="p6-toast-region" aria-live="assertive"></div>
    </div>`;
}

function adminLayout(content, active = "/admin/support", title = "Support Operations") {
  const userName = state.profile?.displayName || state.user?.email || "Staff";
  return `
    <div class="p6-shell p6-admin-shell" data-phase6-root>
      <aside class="p6-sidebar ${state.mobileOpen ? "open" : ""}">
        <div class="p6-sidebar-brand">${brand()}</div>
        <nav class="p6-nav" aria-label="Support administration navigation">
          <span class="p6-nav-label">Support operations</span>
          <a class="p6-nav-link ${active === "/admin/support" ? "active" : ""}" href="#/admin/support">${icons.chat}<span>Support queue</span></a>
          ${NOTICE_MANAGER_ROLES.has(state.profile?.systemRole) ? `<a class="p6-nav-link ${active === "/admin/communications" ? "active" : ""}" href="#/admin/communications">${icons.bell}<span>Notice center</span></a>` : ""}
          <span class="p6-nav-label">Administration</span>
          <a class="p6-nav-link" href="#/dashboard">${icons.home}<span>Admin dashboard</span></a>
          <a class="p6-nav-link" href="#/admin/submissions">${icons.note}<span>Review submissions</span></a>
          <button class="p6-nav-link" type="button" data-p6-action="sign-out">${icons.logout}<span>Sign out</span></button>
        </nav>
        <div class="p6-sidebar-user"><div>${escapeHTML(initials(userName))}</div><span><strong>${escapeHTML(userName)}</strong><small>${escapeHTML(roleLabel(state.profile?.systemRole))}</small></span></div>
      </aside>
      <div class="p6-main">
        <header class="p6-topbar"><button class="p6-icon-button p6-menu" type="button" data-p6-action="mobile">${icons.menu}</button><div><span>Prayer Project Administration</span><strong>${escapeHTML(title)}</strong></div><button class="p6-topbar-action" type="button" data-p6-action="refresh">${icons.refresh}<span>Refresh</span></button></header>
        <main class="p6-content" id="main-content">${content}</main>
      </div>
      <div class="toast-region" id="p6-toast-region" aria-live="assertive"></div>
    </div>`;
}

function badge(value, tone = null) {
  return `<span class="p6-badge p6-${tone || statusTone(value)}">${escapeHTML(STATUS_LABELS[value] || PRIORITY_LABELS[value] || titleCase(value || "Unknown"))}</span>`;
}

function pageHeading(kicker, title, description, action = "") {
  return `<header class="p6-page-heading"><div><p class="p6-kicker">${escapeHTML(kicker)}</p><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>${action}</header>`;
}

function gatePage(message) {
  return `<main class="p6-gate" id="main-content"><section><img src="assets/brand-mark.svg" alt=""><p class="p6-kicker">Protected communications</p><h1>Access unavailable.</h1><p>${escapeHTML(message)}</p><a class="btn btn-primary" href="#/login">Return to sign in</a></section></main>`;
}

function ticketCard(ticket, { admin = false } = {}) {
  const unread = isUnread(ticket);
  const href = admin ? `#/admin/support/ticket?id=${encodeURIComponent(ticket.id)}` : `#/chapter/support/ticket?id=${encodeURIComponent(ticket.id)}`;
  return `<a class="p6-ticket-card ${unread ? "unread" : ""}" href="${href}">
    <div class="p6-ticket-main"><div class="p6-ticket-title"><strong>${escapeHTML(ticket.subject)}</strong>${ticket.visibility === "adviser_private" ? `<span class="p6-private">${icons.lock} Adviser private</span>` : ""}</div><p>${escapeHTML(ticket.lastMessagePreview || "No message preview")}</p><span>${escapeHTML(ticket.chapterName || ticket.chapterId)} · ${escapeHTML(CATEGORY_LABELS[ticket.category] || titleCase(ticket.category))}</span></div>
    <div class="p6-ticket-meta">${badge(ticket.status)}${badge(ticket.priority, priorityTone(ticket.priority))}<time>${escapeHTML(formatRelative(ticket.lastMessageAt))}</time>${unread ? `<i>New</i>` : ""}</div>
  </a>`;
}

function communicationsPage() {
  const recentTickets = state.tickets.slice(0, 4);
  return chapterLayout(`
    ${pageHeading("Communications center", "Notices and support in one place.", "Review official chapter notices, new support replies, and communication items requiring attention.", `<a class="btn btn-primary" href="#/chapter/support/new">${icons.plus} New ticket</a>`)}
    <section class="p6-metric-grid">
      <article><span>Open tickets</span><strong>${state.tickets.filter((item) => !["resolved", "closed"].includes(item.status)).length}</strong><small>${unreadCount()} with unread activity</small></article>
      <article><span>Chapter notices</span><strong>${state.notices.length}</strong><small>${noticeUnreadCount()} require acknowledgment</small></article>
      <article><span>Private Adviser items</span><strong>${state.tickets.filter((item) => item.visibility === "adviser_private").length}</strong><small>Visible only to the submitting Adviser and authorized staff</small></article>
    </section>
    <section class="p6-grid p6-grid-2">
      <article class="p6-panel"><div class="p6-panel-head"><div><p class="p6-kicker">Recent support</p><h2>Ticket activity</h2></div><a href="#/chapter/support">View all</a></div>${recentTickets.length ? `<div class="p6-ticket-list">${recentTickets.map((item) => ticketCard(item)).join("")}</div>` : `<div class="p6-empty">${icons.chat}<strong>No support tickets yet</strong><p>Create a ticket whenever your chapter needs assistance.</p></div>`}</article>
      <article class="p6-panel"><div class="p6-panel-head"><div><p class="p6-kicker">Official notices</p><h2>Chapter announcements</h2></div><a href="#/chapter/notices">Full notice archive</a></div>${state.notices.length ? `<div class="p6-notice-list">${state.notices.slice(0, 5).map(noticeCard).join("")}</div>` : `<div class="p6-empty">${icons.bell}<strong>No active notices</strong><p>New administrative notices will appear here.</p></div>`}</article>
    </section>
  `, "/chapter/communications", "Communications");
}

function noticeCard(notice) {
  const acknowledged = state.noticeReceipts.has(notice.id);
  return `<article class="p6-notice-card"><div><span class="p6-notice-priority p6-${priorityTone(notice.priority || "normal")}">${escapeHTML(PRIORITY_LABELS[notice.priority] || titleCase(notice.priority || "normal"))}</span><h3>${escapeHTML(notice.title)}</h3><p>${escapeHTML(notice.body)}</p><small>Published ${escapeHTML(formatDate(notice.publishedAt, { time: true }))}</small></div>${notice.requireAcknowledgment ? acknowledged ? `<span class="p6-acknowledged">${icons.check} Acknowledged</span>` : `<button class="btn btn-secondary btn-small" type="button" data-p6-action="ack-notice" data-notice-id="${escapeHTML(notice.id)}">Acknowledge</button>` : ""}</article>`;
}

function supportCenterPage() {
  const filter = hashParams().get("status") || "active";
  const filtered = state.tickets.filter((ticket) => filter === "all" ? true : filter === "active" ? !["resolved", "closed"].includes(ticket.status) : ticket.status === filter);
  return chapterLayout(`
    ${pageHeading("Support center", "How can we help your chapter?", "Create and track conversations with Prayer Project staff. Replies update in real time.", `<a class="btn btn-primary" href="#/chapter/support/new">${icons.plus} New support ticket</a>`)}
    <div class="p6-filter-bar"><label>Status<select id="p6-ticket-filter"><option value="active" ${filter === "active" ? "selected" : ""}>Active tickets</option><option value="all" ${filter === "all" ? "selected" : ""}>All tickets</option>${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${filter === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}</select></label><span>${filtered.length} ticket${filtered.length === 1 ? "" : "s"}</span></div>
    <section class="p6-panel">${filtered.length ? `<div class="p6-ticket-list">${filtered.map((item) => ticketCard(item)).join("")}</div>` : `<div class="p6-empty">${icons.chat}<strong>No matching tickets</strong><p>Change the filter or create a new support request.</p><a class="btn btn-primary" href="#/chapter/support/new">Create a ticket</a></div>`}</section>
  `, "/chapter/support", "Support Center");
}

function newTicketPage() {
  const membership = selectedMembership();
  const adviser = membership?.role === "adviser";
  return chapterLayout(`
    ${pageHeading("New support request", "Start a conversation with headquarters.", "Choose the category and visibility carefully. Support staff can reply directly inside the portal.")}
    <section class="p6-form-panel">
      <div id="p6-form-alert"></div>
      <form id="p6-new-ticket-form" class="p6-form" novalidate>
        <div class="p6-form-row"><label>Category<select name="category" required>${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join("")}</select></label><label>Priority<select name="priority" required>${Object.entries(PRIORITY_LABELS).map(([value, label]) => `<option value="${value}" ${value === "normal" ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}</select></label></div>
        <label>Subject<input name="subject" type="text" minlength="5" maxlength="160" required placeholder="Briefly describe what you need help with"></label>
        <label>Message<textarea name="body" minlength="20" maxlength="5000" rows="9" required placeholder="Provide the details staff will need to respond."></textarea></label>
        ${adviser ? `<fieldset class="p6-visibility"><legend>Conversation visibility</legend><label><input type="radio" name="visibility" value="chapter" checked><span><strong>Chapter conversation</strong><small>Visible to active chapter leadership and authorized Prayer Project staff.</small></span></label><label><input type="radio" name="visibility" value="adviser_private"><span><strong>Confidential Adviser conversation</strong><small>Visible only to you and authorized Prayer Project staff.</small></span></label></fieldset>` : `<input type="hidden" name="visibility" value="chapter">`}
        <label class="p6-file-field">${icons.attachment}<span><strong>Optional attachments</strong><small>Up to 5 PDF, Word, PNG, or JPEG files. Maximum 10 MB each.</small></span><input name="files" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"></label>
        <label class="p6-consent"><input name="confirmation" type="checkbox" required><span>I confirm this request contains no unnecessary private prayer-request details or sensitive personal information.</span></label>
        <div class="p6-form-actions"><a class="btn btn-secondary" href="#/chapter/support">Cancel</a><button class="btn btn-primary" id="p6-create-ticket" type="submit">${icons.send} Create ticket</button></div>
      </form>
    </section>
  `, "/chapter/support", "New Support Ticket");
}

function messageMarkup(message) {
  const mine = message.authorUid === state.user?.uid;
  const staff = message.senderType === "staff";
  return `<article class="p6-message ${mine ? "mine" : ""} ${staff ? "staff" : "chapter"}"><div class="p6-message-avatar">${escapeHTML(initials(message.authorName))}</div><div class="p6-message-body"><header><strong>${escapeHTML(message.authorName)}</strong><span>${escapeHTML(roleLabel(message.authorRole))}</span><time>${escapeHTML(formatDate(message.createdAt, { time: true }))}</time></header><p>${escapeHTML(message.body).replaceAll("\n", "<br>")}</p>${message.attachments?.length ? `<div class="p6-message-files">${message.attachments.map((file) => `<a href="${escapeHTML(file.downloadUrl)}" target="_blank" rel="noopener">${icons.attachment}<span>${escapeHTML(file.fileName)}</span></a>`).join("")}</div>` : ""}</div></article>`;
}

function ticketConversationPage({ admin = false } = {}) {
  const ticket = state.currentTicket;
  if (!ticket) return (admin ? adminLayout : chapterLayout)(`<div class="p6-empty">${icons.alert}<strong>Ticket unavailable</strong><p>The requested support conversation could not be loaded.</p></div>`, admin ? "/admin/support" : "/chapter/support", "Support Ticket");
  const closed = ticket.status === "closed";
  const content = `
    <header class="p6-ticket-header"><div><a href="${admin ? "#/admin/support" : "#/chapter/support"}">← Back to ${admin ? "queue" : "support center"}</a><p class="p6-kicker">${escapeHTML(ticket.id)}</p><h1>${escapeHTML(ticket.subject)}</h1><div class="p6-ticket-tags">${badge(ticket.status)}${badge(ticket.priority, priorityTone(ticket.priority))}<span>${escapeHTML(CATEGORY_LABELS[ticket.category])}</span>${ticket.visibility === "adviser_private" ? `<span class="p6-private">${icons.lock} Adviser private</span>` : ""}</div></div>${!admin && !closed ? `<button class="btn btn-secondary" type="button" data-p6-action="close-ticket">Close ticket</button>` : ""}</header>
    <section class="p6-conversation-grid ${admin ? "admin" : ""}">
      <article class="p6-chat-panel"><div class="p6-messages" id="p6-messages">${state.messages.length ? state.messages.map(messageMarkup).join("") : `<div class="p6-empty"><div class="spinner"></div><p>Loading messages…</p></div>`}</div>${closed ? `<div class="p6-closed-banner">${icons.check}<span>This ticket is closed. Staff can reopen it if additional work is required.</span></div>` : `<form id="p6-message-form" class="p6-composer"><textarea name="body" maxlength="5000" rows="3" required placeholder="Write a reply…"></textarea><div><label class="p6-attach-button">${icons.attachment}<span>Attach</span><input name="files" type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"></label><button class="btn btn-primary" type="submit">${icons.send} Send reply</button></div></form>`}</article>
      ${admin ? adminTicketSidebar(ticket) : `<aside class="p6-ticket-details"><h2>Ticket details</h2><dl><div><dt>Chapter</dt><dd>${escapeHTML(ticket.chapterName)}</dd></div><div><dt>Created by</dt><dd>${escapeHTML(ticket.createdByName)} · ${escapeHTML(roleLabel(ticket.createdByRole))}</dd></div><div><dt>Category</dt><dd>${escapeHTML(CATEGORY_LABELS[ticket.category])}</dd></div><div><dt>Assigned staff</dt><dd>${escapeHTML(ticket.assignedToName || "Not assigned")}</dd></div><div><dt>Created</dt><dd>${escapeHTML(formatDate(ticket.createdAt, { time: true }))}</dd></div></dl></aside>`}
    </section>`;
  return admin ? adminLayout(content, "/admin/support", "Support Conversation") : chapterLayout(content, "/chapter/support", "Support Conversation");
}

function adminTicketSidebar(ticket) {
  return `<aside class="p6-admin-ticket-sidebar">
    <section class="p6-ticket-details"><h2>Ticket controls</h2><label>Status<select id="p6-admin-ticket-status">${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${ticket.status === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}</select></label><label>Priority<select id="p6-admin-ticket-priority">${Object.entries(PRIORITY_LABELS).map(([value, label]) => `<option value="${value}" ${ticket.priority === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}</select></label><button class="btn btn-secondary btn-block" type="button" data-p6-action="save-ticket-controls">Save ticket controls</button><button class="btn btn-secondary btn-block" type="button" data-p6-action="assign-self">${ticket.assignedToUid === state.user.uid ? "Unassign from me" : "Assign to me"}</button><dl><div><dt>Chapter</dt><dd>${escapeHTML(ticket.chapterName)}</dd></div><div><dt>Created by</dt><dd>${escapeHTML(ticket.createdByName)} · ${escapeHTML(roleLabel(ticket.createdByRole))}</dd></div><div><dt>Assigned to</dt><dd>${escapeHTML(ticket.assignedToName || "Unassigned")}</dd></div></dl></section>
    <section class="p6-internal-notes"><div class="p6-panel-head"><div><p class="p6-kicker">Staff only</p><h2>Internal notes</h2></div>${icons.lock}</div><div class="p6-note-list">${state.internalNotes.length ? state.internalNotes.map((note) => `<article><header><strong>${escapeHTML(note.authorName)}</strong><time>${escapeHTML(formatDate(note.createdAt, { time: true }))}</time></header><p>${escapeHTML(note.body).replaceAll("\n", "<br>")}</p></article>`).join("") : `<p>No internal notes yet.</p>`}</div><form id="p6-internal-note-form"><textarea name="body" minlength="3" maxlength="3000" rows="4" required placeholder="Add a note visible only to staff…"></textarea><button class="btn btn-secondary btn-block" type="submit">Add internal note</button></form></section>
  </aside>`;
}

function filteredAdminTickets() {
  return state.adminTickets.filter((ticket) => {
    const statusMatch = state.adminFilter.status === "all"
      || (state.adminFilter.status === "active" ? !["resolved", "closed"].includes(ticket.status) : ticket.status === state.adminFilter.status);
    const categoryMatch = state.adminFilter.category === "all" || ticket.category === state.adminFilter.category;
    const priorityMatch = state.adminFilter.priority === "all" || ticket.priority === state.adminFilter.priority;
    return statusMatch && categoryMatch && priorityMatch;
  });
}

function adminSupportPage() {
  const tickets = filteredAdminTickets();
  const urgent = state.adminTickets.filter((item) => item.priority === "urgent" && !["resolved", "closed"].includes(item.status)).length;
  const awaiting = state.adminTickets.filter((item) => item.status === "awaiting_staff" || item.status === "open").length;
  return adminLayout(`
    ${pageHeading("Support queue", "Chapter support operations.", "Review incoming chapter conversations, assign ownership, escalate concerns, and keep every request moving.")}
    <section class="p6-metric-grid"><article><span>Active tickets</span><strong>${state.adminTickets.filter((item) => !["resolved", "closed"].includes(item.status)).length}</strong><small>Across all chapters</small></article><article><span>Awaiting staff</span><strong>${awaiting}</strong><small>Needs a Prayer Project response</small></article><article><span>Urgent priority</span><strong>${urgent}</strong><small>Review immediately</small></article><article><span>Assigned to me</span><strong>${state.adminTickets.filter((item) => item.assignedToUid === state.user.uid && !["resolved", "closed"].includes(item.status)).length}</strong><small>Current workload</small></article></section>
    <div class="p6-filter-bar p6-admin-filters"><label>Status<select id="p6-admin-filter-status"><option value="active">Active</option><option value="all">All</option>${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join("")}</select></label><label>Category<select id="p6-admin-filter-category"><option value="all">All categories</option>${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join("")}</select></label><label>Priority<select id="p6-admin-filter-priority"><option value="all">All priorities</option>${Object.entries(PRIORITY_LABELS).map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join("")}</select></label><span>${tickets.length} results</span></div>
    <section class="p6-panel">${tickets.length ? `<div class="p6-ticket-list">${tickets.map((item) => ticketCard(item, { admin: true })).join("")}</div>` : `<div class="p6-empty">${icons.chat}<strong>No matching tickets</strong><p>Adjust the filters to see other support conversations.</p></div>`}</section>
  `, "/admin/support", "Support Queue");
}

function adminCommunicationsPage() {
  return adminLayout(`
    ${pageHeading("Notice center", "Publish an official chapter notice.", "Create an announcement for one approved chapter. The notice appears in the chapter portal and may require acknowledgment.")}
    <section class="p6-form-panel"><div id="p6-notice-alert"></div><form id="p6-publish-notice-form" class="p6-form" novalidate><div class="p6-form-row"><label>Permanent Chapter ID<input name="chapterId" type="text" maxlength="39" required placeholder="TPP-CH-A1B2C3"></label><label>Priority<select name="priority">${Object.entries(PRIORITY_LABELS).map(([value, label]) => `<option value="${value}" ${value === "normal" ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}</select></label></div><label>Notice title<input name="title" type="text" minlength="4" maxlength="160" required></label><label>Notice body<textarea name="body" minlength="10" maxlength="4000" rows="8" required></textarea></label><div class="p6-form-row"><label>Expiration date, optional<input name="expiresAt" type="date"></label><label class="p6-consent"><input name="requireAcknowledgment" type="checkbox"><span>Require every chapter leader to acknowledge this notice.</span></label></div><div class="p6-form-actions"><button class="btn btn-primary" type="submit">${icons.bell} Publish notice</button></div></form></section>
  `, "/admin/communications", "Notice Center");
}

async function uploadMessageAttachments(ticket, messageId, files) {
  const uploaded = [];
  for (const file of files) {
    const fileName = `${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const uploaderType = SUPPORT_STAFF_ROLES.has(state.profile?.systemRole) ? "staff" : "chapter";
    const path = `support-attachments/${uploaderType}/${ticket.chapterId}/${ticket.id}/${messageId}/${state.user.uid}/${fileName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type, customMetadata: { ticketId: ticket.id, chapterId: ticket.chapterId, messageId, uploadedByUid: state.user.uid } });
    const downloadUrl = await getDownloadURL(storageRef);
    const attachmentRef = doc(collection(db, "supportTickets", ticket.id, "messages", messageId, "attachments"));
    await setDoc(attachmentRef, {
      ticketId: ticket.id,
      chapterId: ticket.chapterId,
      messageId,
      uploadedByUid: state.user.uid,
      fileName: file.name,
      storagePath: path,
      downloadUrl,
      contentType: file.type,
      size: file.size,
      createdAt: serverTimestamp()
    });
    uploaded.push(attachmentRef.id);
  }
  if (uploaded.length) await updateDoc(doc(db, "supportTickets", ticket.id, "messages", messageId), { hasAttachments: true, attachmentCount: uploaded.length });
}

async function createTicket(form) {
  const submit = form.querySelector("#p6-create-ticket");
  const membership = selectedMembership();
  const subject = form.subject.value.trim();
  const body = form.body.value.trim();
  const category = form.category.value;
  const priority = form.priority.value;
  const visibility = form.visibility.value;
  if (!form.confirmation.checked) return setAlert("p6-form-alert", "warning", "Confirmation required", "Confirm that the request avoids unnecessary sensitive information.");
  if (subject.length < 5 || body.length < 20) return setAlert("p6-form-alert", "warning", "More information required", "Enter a clear subject and at least 20 characters of detail.");
  if (visibility === "adviser_private" && membership?.role !== "adviser") return setAlert("p6-form-alert", "danger", "Private access denied", "Only the Chapter Adviser may create an Adviser-private conversation.");
  let files;
  try { files = validateFiles(form.files.files); } catch (error) { return setAlert("p6-form-alert", "warning", "Attachment not accepted", error.message); }
  submit.disabled = true;
  submit.textContent = "Creating ticket…";
  try {
    const ticketRef = doc(collection(db, "supportTickets"));
    const messageRef = doc(collection(ticketRef, "messages"));
    const displayName = state.profile?.displayName || state.user.displayName || state.user.email;
    const accessKeys = visibility === "adviser_private"
      ? [`user:${state.user.uid}`]
      : [`chapter:${state.selectedChapterId}`, `user:${state.user.uid}`];
    const ticketData = {
      ticketId: ticketRef.id,
      chapterId: state.selectedChapterId,
      chapterName: membership?.chapterName || state.chapter?.officialName || state.selectedChapterId,
      category,
      priority,
      visibility,
      subject,
      status: "open",
      createdByUid: state.user.uid,
      createdByName: displayName,
      createdByRole: membership.role,
      assignedToUid: "",
      assignedToName: "",
      accessKeys,
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: body.slice(0, 180),
      lastMessageByUid: state.user.uid,
      lastMessageByName: displayName,
      lastMessageSenderType: "chapter",
      messageCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const messageData = {
      ticketId: ticketRef.id,
      chapterId: state.selectedChapterId,
      authorUid: state.user.uid,
      authorName: displayName,
      authorRole: membership.role,
      senderType: "chapter",
      body,
      hasAttachments: false,
      attachmentCount: 0,
      createdAt: serverTimestamp()
    };
    const batch = writeBatch(db);
    batch.set(ticketRef, ticketData);
    batch.set(messageRef, messageData);
    batch.set(doc(db, "supportReadStates", `${ticketRef.id}__${state.user.uid}`), {
      ticketId: ticketRef.id,
      chapterId: state.selectedChapterId,
      uid: state.user.uid,
      lastReadAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await batch.commit();
    if (files.length) await uploadMessageAttachments({ id: ticketRef.id, ...ticketData }, messageRef.id, files);
    navigate(`/chapter/support/ticket?id=${encodeURIComponent(ticketRef.id)}`);
  } catch (error) {
    console.error("Unable to create support ticket.", error);
    setAlert("p6-form-alert", "danger", "Ticket not created", error.message || "Firebase rejected the support request.");
  } finally {
    submit.disabled = false;
    submit.innerHTML = `${icons.send} Create ticket`;
  }
}

async function sendMessage(form) {
  const ticket = state.currentTicket;
  if (!ticket) return;
  const body = form.body.value.trim();
  if (!body) return;
  let files;
  try { files = validateFiles(form.files.files); } catch (error) { return toast("Attachment not accepted", error.message, "warning"); }
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Sending…";
  try {
    const messageRef = doc(collection(db, "supportTickets", ticket.id, "messages"));
    const name = state.profile?.displayName || state.user.displayName || state.user.email;
    const role = state.profile?.systemRole || selectedMembership()?.role;
    const senderType = SUPPORT_STAFF_ROLES.has(role) ? "staff" : "chapter";
    const batch = writeBatch(db);
    batch.set(messageRef, {
      ticketId: ticket.id,
      chapterId: ticket.chapterId,
      authorUid: state.user.uid,
      authorName: name,
      authorRole: role,
      senderType,
      body,
      hasAttachments: false,
      attachmentCount: 0,
      createdAt: serverTimestamp()
    });
    batch.update(doc(db, "supportTickets", ticket.id), {
      status: senderType === "staff" ? "awaiting_chapter" : "awaiting_staff",
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: body.slice(0, 180),
      lastMessageByUid: state.user.uid,
      lastMessageByName: name,
      lastMessageSenderType: senderType,
      messageCount: Number(ticket.messageCount || 0) + 1,
      updatedAt: serverTimestamp()
    });
    await batch.commit();
    if (files.length) await uploadMessageAttachments(ticket, messageRef.id, files);
    form.reset();
  } catch (error) {
    console.error("Unable to send support message.", error);
    toast("Message not sent", error.message || "Firebase rejected the reply.", "danger");
  } finally {
    button.disabled = false;
    button.innerHTML = `${icons.send} Send reply`;
  }
}

async function addInternalNote(form) {
  const body = form.body.value.trim();
  if (body.length < 3 || !state.currentTicket) return;
  await addDoc(collection(db, "supportTickets", state.currentTicket.id, "internalNotes"), {
    ticketId: state.currentTicket.id,
    chapterId: state.currentTicket.chapterId,
    authorUid: state.user.uid,
    authorName: state.profile?.displayName || state.user.email,
    authorRole: state.profile.systemRole,
    body,
    createdAt: serverTimestamp()
  });
  form.reset();
}

async function saveTicketControls() {
  const status = document.querySelector("#p6-admin-ticket-status")?.value;
  const priority = document.querySelector("#p6-admin-ticket-priority")?.value;
  if (!state.currentTicket || !status || !priority) return;
  await updateDoc(doc(db, "supportTickets", state.currentTicket.id), {
    status,
    priority,
    updatedAt: serverTimestamp()
  });
  state.currentTicket.status = status;
  state.currentTicket.priority = priority;
  toast("Ticket updated", "Status and priority were saved.");
  renderPhase6({ prepare: false });
}

async function assignSelf() {
  if (!state.currentTicket) return;
  const assigned = state.currentTicket.assignedToUid === state.user.uid;
  await updateDoc(doc(db, "supportTickets", state.currentTicket.id), {
    assignedToUid: assigned ? "" : state.user.uid,
    assignedToName: assigned ? "" : (state.profile?.displayName || state.user.email),
    updatedAt: serverTimestamp()
  });
  state.currentTicket.assignedToUid = assigned ? "" : state.user.uid;
  state.currentTicket.assignedToName = assigned ? "" : (state.profile?.displayName || state.user.email);
  renderPhase6({ prepare: false });
}

async function closeTicket() {
  if (!state.currentTicket || !confirm("Close this support ticket? The conversation will become read-only for the chapter.")) return;
  await updateDoc(doc(db, "supportTickets", state.currentTicket.id), { status: "closed", updatedAt: serverTimestamp() });
  state.currentTicket.status = "closed";
  renderPhase6({ prepare: false });
}

async function acknowledgeNotice(noticeId) {
  const receiptId = `${noticeId}__${state.user.uid}`;
  await setDoc(doc(db, "chapters", state.selectedChapterId, "noticeReceipts", receiptId), {
    noticeId,
    chapterId: state.selectedChapterId,
    uid: state.user.uid,
    acknowledgedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  state.noticeReceipts.set(noticeId, { noticeId, uid: state.user.uid });
  renderPhase6({ prepare: false });
}

async function publishNotice(form) {
  const chapterId = form.chapterId.value.trim().toUpperCase();
  const title = form.title.value.trim();
  const body = form.body.value.trim();
  const expiresAt = form.expiresAt.value ? new Date(`${form.expiresAt.value}T23:59:59`) : null;
  const chapterSnapshot = await getDoc(doc(db, "chapters", chapterId));
  if (!chapterSnapshot.exists()) return setAlert("p6-notice-alert", "warning", "Chapter not initialized", "No private chapter workspace exists for this Chapter ID.");
  const noticeRef = doc(collection(db, "chapters", chapterId, "notices"));
  await setDoc(noticeRef, {
    title,
    body,
    priority: form.priority.value,
    requireAcknowledgment: form.requireAcknowledgment.checked,
    active: true,
    publishedAt: serverTimestamp(),
    expiresAt,
    createdByUid: state.user.uid,
    createdByName: state.profile?.displayName || state.user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  form.reset();
  setAlert("p6-notice-alert", "success", "Notice published", `The notice is now available to ${chapterId}.`);
}

function setAlert(targetId, type, title, message) {
  const target = document.querySelector(`#${targetId}`);
  if (target) target.innerHTML = `<div class="p6-alert p6-${type}">${type === "success" ? icons.check : icons.alert}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div></div>`;
}

function toast(title, message, tone = "success") {
  const region = document.querySelector("#p6-toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = `toast p6-toast p6-${tone}`;
  item.innerHTML = `${tone === "success" ? icons.check : icons.alert}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
  region.append(item);
  setTimeout(() => item.remove(), 4400);
}

function scrollMessagesToBottom() {
  const target = document.querySelector("#p6-messages");
  if (target) target.scrollTop = target.scrollHeight;
}

function bindEvents() {
  document.querySelector("#p6-chapter-selector")?.addEventListener("change", async (event) => {
    cleanupListeners();
    state.selectedChapterId = event.target.value;
    localStorage.setItem(`tpp-selected-chapter-${state.user.uid}`, state.selectedChapterId);
    await loadChapterContext();
    subscribeReadStates();
    subscribeChapterTickets();
    navigate("/chapter/communications");
  });
  document.querySelector("#p6-new-ticket-form")?.addEventListener("submit", (event) => { event.preventDefault(); createTicket(event.currentTarget); });
  document.querySelector("#p6-message-form")?.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(event.currentTarget); });
  document.querySelector("#p6-internal-note-form")?.addEventListener("submit", (event) => { event.preventDefault(); addInternalNote(event.currentTarget); });
  document.querySelector("#p6-publish-notice-form")?.addEventListener("submit", (event) => { event.preventDefault(); publishNotice(event.currentTarget).catch((error) => setAlert("p6-notice-alert", "danger", "Notice not published", error.message)); });
  document.querySelector("#p6-ticket-filter")?.addEventListener("change", (event) => navigate(`/chapter/support?status=${encodeURIComponent(event.target.value)}`));
  document.querySelector("#p6-admin-filter-status")?.addEventListener("change", (event) => { state.adminFilter.status = event.target.value; renderPhase6({ prepare: false }); });
  document.querySelector("#p6-admin-filter-category")?.addEventListener("change", (event) => { state.adminFilter.category = event.target.value; renderPhase6({ prepare: false }); });
  document.querySelector("#p6-admin-filter-priority")?.addEventListener("change", (event) => { state.adminFilter.priority = event.target.value; renderPhase6({ prepare: false }); });
  document.querySelectorAll('[data-p6-action="ack-notice"]').forEach((button) => button.addEventListener("click", () => acknowledgeNotice(button.dataset.noticeId)));
  document.querySelector('[data-p6-action="close-ticket"]')?.addEventListener("click", closeTicket);
  document.querySelector('[data-p6-action="save-ticket-controls"]')?.addEventListener("click", saveTicketControls);
  document.querySelector('[data-p6-action="assign-self"]')?.addEventListener("click", assignSelf);
  document.querySelectorAll('[data-p6-action="sign-out"]').forEach((button) => button.addEventListener("click", async () => { await signOut(auth); navigate("/login"); }));
  document.querySelectorAll('[data-p6-action="mobile"]').forEach((button) => button.addEventListener("click", () => { state.mobileOpen = !state.mobileOpen; renderPhase6({ prepare: false }); }));
  document.querySelectorAll('[data-p6-action="refresh"]').forEach((button) => button.addEventListener("click", () => location.reload()));
}

function augmentExistingNavigation() {
  if (PHASE6_ROUTES.has(routeFromHash())) return;
  const phase4Nav = document.querySelector(".p4-nav");
  if (phase4Nav && CHAPTER_ROLES.has(state.profile?.systemRole) && !document.querySelector("[data-p6-nav]")) {
    const accountLabel = Array.from(phase4Nav.querySelectorAll(".p4-nav-label")).find((item) => item.textContent.trim() === "Account");
    const link = document.createElement("a");
    link.className = "p4-nav-link";
    link.href = "#/chapter/communications";
    link.dataset.p6Nav = "true";
    link.innerHTML = `${icons.chat}<span>Support & communications</span>${unreadCount() + noticeUnreadCount() ? `<em>${unreadCount() + noticeUnreadCount()}</em>` : ""}`;
    phase4Nav.insertBefore(link, accountLabel || null);
  }
  const adminNav = document.querySelector(".p4a-nav, .phase3-admin-nav");
  if (adminNav && SUPPORT_STAFF_ROLES.has(state.profile?.systemRole) && !document.querySelector("[data-p6-admin-nav]")) {
    const link = document.createElement("a");
    link.href = "#/admin/support";
    link.dataset.p6AdminNav = "true";
    link.className = adminNav.classList.contains("p4a-nav") ? "p4a-nav-link" : "phase3-admin-link";
    link.innerHTML = `${icons.chat}<span>Support queue</span>`;
    adminNav.append(link);
  }
}

async function prepareRoute(route) {
  cleanupListeners();
  if (CHAPTER_ROUTES.has(route)) {
    if (!state.memberships.length) await loadMemberships();
    await loadChapterContext();
    subscribeReadStates();
    subscribeChapterTickets();
    if (route === "/chapter/support/ticket") await loadTicket(hashParams().get("id"));
  } else if (ADMIN_ROUTES.has(route)) {
    subscribeReadStates();
    subscribeAdminTickets();
    if (route === "/admin/support/ticket") await loadTicket(hashParams().get("id"));
  }
}

async function renderPhase6({ prepare = true } = {}) {
  const route = routeFromHash();
  if (!PHASE6_ROUTES.has(route)) {
    augmentExistingNavigation();
    return;
  }
  if (!state.authReady || state.rendering) return;
  state.rendering = true;
  try {
    if (!state.user) {
      navigate("/login");
      return;
    }
    if (prepare) await prepareRoute(route);
    if (CHAPTER_ROUTES.has(route)) {
      if (!state.profile || !CHAPTER_ROLES.has(state.profile.systemRole) || !state.user.emailVerified) {
        app.innerHTML = gatePage("A verified Chapter Director or Adviser account is required.");
      } else if (!state.memberships.length) {
        app.innerHTML = gatePage("No active chapter membership was found for this account.");
      } else {
        const pages = {
          "/chapter/communications": communicationsPage,
          "/chapter/support": supportCenterPage,
          "/chapter/support/new": newTicketPage,
          "/chapter/support/ticket": () => ticketConversationPage({ admin: false })
        };
        app.innerHTML = pages[route]();
      }
    } else if (!state.profile || !SUPPORT_STAFF_ROLES.has(state.profile.systemRole)) {
      app.innerHTML = gatePage("Authorized Prayer Project staff access is required.");
    } else if (route === "/admin/communications" && !NOTICE_MANAGER_ROLES.has(state.profile.systemRole)) {
      app.innerHTML = gatePage("Owner, Chapter Administrator, or Compliance Administrator access is required to publish notices.");
    } else {
      const pages = {
        "/admin/support": adminSupportPage,
        "/admin/support/ticket": () => ticketConversationPage({ admin: true }),
        "/admin/communications": adminCommunicationsPage
      };
      app.innerHTML = pages[route]();
    }
    bindEvents();
    queueMicrotask(scrollMessagesToBottom);
    document.title = route.startsWith("/admin") ? "Support Operations | The Prayer Project" : "Chapter Communications | The Prayer Project";
  } catch (error) {
    console.error("Unable to render Phase 6.", error);
    app.innerHTML = gatePage(error.message || "The communications area could not be loaded.");
  } finally {
    state.rendering = false;
  }
}

window.addEventListener("hashchange", () => queueMicrotask(() => renderPhase6({ prepare: true })));
const observer = new MutationObserver(() => queueMicrotask(augmentExistingNavigation));
observer.observe(app, { childList: true, subtree: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  cleanupListeners();
  state.user = user;
  await loadProfile(user);
  state.authReady = true;
  if (user?.emailVerified && CHAPTER_ROLES.has(state.profile?.systemRole)) await loadMemberships();
  await renderPhase6({ prepare: true });
});
