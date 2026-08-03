import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";

const app = document.querySelector("#app");
const MEMBER_ROUTE = "/chapter/members";
const CHAPTER_ROLES = new Set(["director", "adviser", "chapterUser"]);
const MANAGER_ROLES = new Set(["director", "adviser"]);

const memberState = {
  ready: false,
  rendering: false,
  user: null,
  profile: null,
  membership: null,
  chapter: null,
  members: [],
  loading: false,
  error: null,
  editingId: null,
  drawerOpen: false
};

const roleLabels = Object.freeze({
  member: "Member",
  volunteer: "Volunteer",
  prayer_leader: "Prayer Leader",
  secretary: "Secretary",
  treasurer: "Treasurer",
  outreach_coordinator: "Outreach Coordinator"
});

const icons = {
  close: icon("M6 6l12 12M18 6 6 18"),
  home: icon("M3 11 12 4l9 7v9H3zM9 20v-6h6v6"),
  shield: icon("M12 3 4 6v5c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6zM9 12l2 2 4-4"),
  users: icon("M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M15 15a5 5 0 0 1 6 5"),
  file: icon("M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6"),
  bell: icon("M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"),
  send: icon("M3 11.5 21 3l-6.5 18-3.5-7zM11 14 21 3"),
  clock: icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v6l4 2"),
  message: icon("M4 4h16v12H8l-4 4zM8 8h8M8 12h5"),
  menu: icon("M4 7h16M4 12h16M4 17h16"),
  logout: icon("M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"),
  sun: icon("M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"),
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

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(value = "TP") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "TP").toUpperCase();
}

function isMobile() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function closeLegacyDrawer() {
  const sidebar = document.querySelector(".cp2-sidebar.open");
  if (!sidebar) {
    document.body.classList.remove("cp2-drawer-locked");
    return;
  }
  const menu = document.querySelector('[data-cp2-action="menu"]');
  if (menu) menu.click();
  else sidebar.classList.remove("open");
  document.body.classList.remove("cp2-drawer-locked");
}

function augmentExistingPortal() {
  if (routeFromHash() === MEMBER_ROUTE) return;
  const shell = document.querySelector("[data-chapter-portal-v2]");
  const sidebar = shell?.querySelector(".cp2-sidebar");
  if (!shell || !sidebar) return;

  const brand = sidebar.querySelector(":scope > .cp2-brand");
  if (brand && !sidebar.querySelector(".cp2-drawer-head")) {
    const head = document.createElement("div");
    head.className = "cp2-drawer-head";
    sidebar.insertBefore(head, brand);
    head.append(brand);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "cp2-drawer-close";
    close.dataset.memberDrawerClose = "true";
    close.setAttribute("aria-label", "Close navigation menu");
    close.innerHTML = icons.close;
    head.append(close);
  }

  if (!shell.querySelector(".cp2-backdrop")) {
    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "cp2-backdrop";
    backdrop.dataset.memberDrawerBackdrop = "true";
    backdrop.setAttribute("aria-label", "Close navigation menu");
    sidebar.insertAdjacentElement("afterend", backdrop);
  }

  const nav = sidebar.querySelector(".cp2-nav");
  if (nav && !nav.querySelector('[href="#/chapter/members"]')) {
    const leadership = nav.querySelector('[href="#/chapter/leadership"]');
    const link = document.createElement("a");
    link.href = "#/chapter/members";
    link.innerHTML = `${icons.users}<span>Members</span>`;
    leadership?.insertAdjacentElement("afterend", link);
  }

  const actions = shell.querySelector(".cp2-actions");
  if (actions && !actions.querySelector('[href="#/chapter/members"]')) {
    const card = document.createElement("a");
    card.href = "#/chapter/members";
    card.innerHTML = `<span>${icons.users}</span><strong>Member roster</strong><small>Add and maintain the private chapter member list.</small>`;
    actions.append(card);
  }

  if (!sidebar.dataset.memberDrawerBound) {
    sidebar.dataset.memberDrawerBound = "true";
    sidebar.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#/"]');
      if (!link || !isMobile() || !sidebar.classList.contains("open")) return;
      event.preventDefault();
      const destination = link.getAttribute("href");
      closeLegacyDrawer();
      window.setTimeout(() => {
        location.hash = destination.slice(1);
      }, 20);
    }, true);
  }

  sidebar.querySelector('[data-member-drawer-close="true"]')?.addEventListener("click", closeLegacyDrawer, { once: true });
  shell.querySelector('[data-member-drawer-backdrop="true"]')?.addEventListener("click", closeLegacyDrawer, { once: true });
  document.body.classList.toggle("cp2-drawer-locked", isMobile() && sidebar.classList.contains("open"));
}

async function loadMemberContext() {
  memberState.loading = true;
  memberState.error = null;
  renderMembers();
  try {
    const userSnapshot = await getDoc(doc(db, "systemUsers", memberState.user.uid));
    memberState.profile = userSnapshot.exists() ? { id: userSnapshot.id, ...userSnapshot.data() } : null;
    if (!memberState.profile || !CHAPTER_ROLES.has(memberState.profile.systemRole)) throw new Error("An active chapter account is required.");

    const records = [];
    const primaryChapterId = memberState.profile.primaryChapterId;
    if (primaryChapterId) {
      const direct = await getDoc(doc(db, "chapterMemberships", `${primaryChapterId}__${memberState.user.uid}`));
      if (direct.exists()) records.push({ id: direct.id, ...direct.data() });
    }
    if (!records.length) {
      const memberships = await getDocs(query(collection(db, "chapterMemberships"), where("uid", "==", memberState.user.uid)));
      memberships.docs.forEach((item) => records.push({ id: item.id, ...item.data() }));
    }
    memberState.membership = records.find((item) => item.status === "active" && item.uid === memberState.user.uid) || null;
    if (!memberState.membership) throw new Error("No active chapter membership was found.");

    const chapterId = memberState.membership.chapterId;
    const chapterSnapshot = await getDoc(doc(db, "chapters", chapterId));
    memberState.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;

    const membersSnapshot = await getDocs(collection(db, "chapters", chapterId, "members"));
    memberState.members = membersSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status !== "removed")
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
  } catch (error) {
    memberState.error = error;
  } finally {
    memberState.loading = false;
    memberState.ready = true;
    renderMembers();
  }
}

function memberNavLink(route, label, graphic) {
  return `<a class="${route === MEMBER_ROUTE ? "active" : ""}" href="#${route}">${graphic}<span>${escapeHTML(label)}</span></a>`;
}

function memberShell(content) {
  const membership = memberState.membership;
  const chapterName = memberState.chapter?.officialName || membership?.chapterName || "Prayer Project Chapter";
  const userName = memberState.profile?.displayName || memberState.user?.email || "Chapter Leader";
  return `<div class="cp2-shell" data-chapter-portal-v2 data-phase4-root data-member-roster-root>
    <aside class="cp2-sidebar ${memberState.drawerOpen ? "open" : ""}" id="cp2-member-sidebar">
      <div class="cp2-drawer-head">
        <a class="cp2-brand" href="#/chapter/overview"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Chapter Portal</small></span></a>
        <button class="cp2-drawer-close" type="button" data-member-action="close-menu" aria-label="Close navigation menu">${icons.close}</button>
      </div>
      <div class="cp2-current"><strong>${escapeHTML(chapterName)}</strong><span>${escapeHTML(membership?.chapterId || "")}</span></div>
      <nav class="cp2-nav" aria-label="Chapter portal navigation">
        <span>Chapter</span>
        ${memberNavLink("/chapter/overview", "Overview", icons.home)}
        ${memberNavLink("/chapter/compliance", "Standing & compliance", icons.shield)}
        ${memberNavLink("/chapter/leadership", "Leadership", icons.users)}
        ${memberNavLink("/chapter/members", "Members", icons.users)}
        ${memberNavLink("/chapter/documents", "Documents", icons.file)}
        ${memberNavLink("/chapter/notices", "Notices", icons.bell)}
        ${membership?.role === "adviser" ? memberNavLink("/chapter/adviser", "Adviser oversight", icons.shield) : ""}
        <span>Operations</span>
        ${memberNavLink("/chapter/workflows", "Reports & requests", icons.send)}
        ${memberNavLink("/chapter/submissions", "Submission history", icons.clock)}
        ${memberNavLink("/chapter/communications", "Communications", icons.message)}
        ${memberNavLink("/chapter/support", "Support center", icons.shield)}
        <span>Account</span>
        ${memberNavLink("/profile", "My profile", icons.users)}
        <button type="button" data-member-action="sign-out">${icons.logout}<span>Sign out</span></button>
      </nav>
      <div class="cp2-current"><strong>${escapeHTML(userName)}</strong><span>${escapeHTML(titleCase(membership?.role || "member"))}</span></div>
    </aside>
    <button class="cp2-backdrop" type="button" data-member-action="close-menu" aria-label="Close navigation menu"></button>
    <section class="cp2-main">
      <header class="cp2-topbar"><button class="cp2-menu" type="button" data-member-action="toggle-menu">${icons.menu}</button><div><span>Chapter Portal</span><strong>Members</strong></div><div><span class="cp2-role">${escapeHTML(titleCase(membership?.role || "member"))}</span><button class="cp2-theme" type="button" data-member-action="theme">${document.documentElement.dataset.theme === "dark" ? icons.sun : icons.moon}</button></div></header>
      <main class="cp2-content" id="main-content">${content}</main>
    </section>
    <div class="cp2-toast-region" id="cp2-member-toast-region" aria-live="assertive"></div>
  </div>`;
}

function loadingMembers() {
  return `<main class="cp2-gate" id="main-content" data-member-roster-root><section><img src="assets/brand-mark.svg" alt=""><div class="spinner"></div><h1>Loading member roster…</h1></section></main>`;
}

function memberError() {
  return `<main class="cp2-gate" id="main-content" data-member-roster-root><section><img src="assets/brand-mark.svg" alt=""><p>Member roster</p><h1>Roster access is unavailable.</h1><span>${escapeHTML(memberState.error?.message || "The member roster could not be loaded.")}</span><div><button class="btn btn-primary" type="button" data-member-action="retry">Try again</button><a class="btn btn-secondary" href="#/chapter/overview">Return to overview</a></div></section></main>`;
}

function memberForm() {
  const editing = memberState.members.find((item) => item.id === memberState.editingId) || null;
  const canManage = MANAGER_ROLES.has(memberState.membership?.role);
  if (!canManage) return `<div class="cp2-members-readonly">You can view the chapter roster, but only the Chapter Director or Chapter Adviser can add or update members.</div>`;
  return `<article class="cp2-member-form-card">
    <h2>${editing ? "Edit member" : "Add a member"}</h2>
    <p>This creates a private roster record. It does not create a portal login.</p>
    <div id="cp2-member-alert"></div>
    <form class="cp2-member-form" id="cp2-member-form" novalidate>
      <label><span>Full name</span><input name="fullName" maxlength="100" required value="${escapeHTML(editing?.fullName || "")}"></label>
      <label><span>Preferred name <small>Optional</small></span><input name="preferredName" maxlength="60" value="${escapeHTML(editing?.preferredName || "")}"></label>
      <label><span>Email <small>Optional</small></span><input name="email" type="email" maxlength="160" value="${escapeHTML(editing?.email || "")}"></label>
      <label><span>Chapter role</span><select name="memberRole">${Object.entries(roleLabels).map(([value, label]) => `<option value="${value}" ${editing?.memberRole === value ? "selected" : ""}>${escapeHTML(label)}</option>`).join("")}</select></label>
      <label><span>Status</span><select name="status"><option value="active" ${editing?.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${editing?.status === "inactive" ? "selected" : ""}>Inactive</option></select></label>
      <label><span>Joined date <small>Optional</small></span><input name="joinedDate" type="date" value="${escapeHTML(editing?.joinedDate || "")}"></label>
      <label><span>Private notes <small>Optional</small></span><textarea name="notes" rows="4" maxlength="1000">${escapeHTML(editing?.notes || "")}</textarea></label>
      <div class="cp2-member-form-actions"><button class="btn btn-primary" type="submit">${editing ? "Save changes" : "Add member"}</button>${editing ? `<button class="btn btn-secondary" type="button" data-member-action="cancel-edit">Cancel</button>` : ""}</div>
    </form>
    <div class="cp2-member-privacy">Keep this roster limited to ordinary chapter administration. Do not enter medical information, passwords, confidential prayer requests, or other highly sensitive personal information.</div>
  </article>`;
}

function memberList() {
  const canManage = MANAGER_ROLES.has(memberState.membership?.role);
  return `<article class="cp2-member-list-card">
    <div class="cp2-member-list-head"><div><h2>Chapter roster</h2><p>Private to authorized chapter leadership and Prayer Project administration.</p></div><span class="cp2-member-count">${memberState.members.length}</span></div>
    <div class="cp2-member-list">${memberState.members.length ? memberState.members.map((member) => `<article class="cp2-member-row">
      <div class="cp2-member-avatar">${escapeHTML(initials(member.preferredName || member.fullName))}</div>
      <div class="cp2-member-details"><strong>${escapeHTML(member.fullName || "Chapter member")}</strong><span>${escapeHTML(roleLabels[member.memberRole] || titleCase(member.memberRole || "member"))} · ${escapeHTML(titleCase(member.status || "active"))}</span><small>${member.email ? escapeHTML(member.email) : "No email listed"}${member.joinedDate ? ` · Joined ${escapeHTML(member.joinedDate)}` : ""}</small></div>
      ${canManage ? `<div class="cp2-member-actions"><button type="button" data-member-action="edit" data-member-id="${escapeHTML(member.id)}">Edit</button><button type="button" data-member-action="archive" data-member-id="${escapeHTML(member.id)}">Remove</button></div>` : ""}
    </article>`).join("") : `<div class="cp2-empty"><strong>No members have been added.</strong><span>Use the form to create the private chapter roster.</span></div>`}</div>
  </article>`;
}

function membersPage() {
  const chapterName = memberState.chapter?.officialName || memberState.membership?.chapterName || "Chapter";
  return memberShell(`<header class="cp2-heading"><div><p>Private chapter roster</p><h1>${escapeHTML(chapterName)} members</h1><span>Maintain the people who participate in this chapter. Roster records stay private and are separate from Director and Adviser portal accounts.</span></div></header><section class="cp2-member-layout">${memberForm()}${memberList()}</section>`);
}

function renderMembers() {
  if (routeFromHash() !== MEMBER_ROUTE) {
    memberState.drawerOpen = false;
    document.body.classList.remove("cp2-drawer-locked");
    return;
  }
  if (!memberState.ready || memberState.rendering) return;
  memberState.rendering = true;
  try {
    if (!memberState.user) {
      location.hash = "/login";
      return;
    }
    if (memberState.loading) app.innerHTML = loadingMembers();
    else if (memberState.error || !memberState.membership) app.innerHTML = memberError();
    else app.innerHTML = membersPage();
    bindMemberEvents();
    document.body.classList.toggle("cp2-drawer-locked", isMobile() && memberState.drawerOpen);
    document.title = "Chapter Members | The Prayer Project";
  } finally {
    memberState.rendering = false;
  }
}

function memberToast(title, message) {
  const region = document.querySelector("#cp2-member-toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = "cp2-toast";
  item.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

async function saveMember(form) {
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim().toLowerCase();
  if (fullName.length < 2) {
    document.querySelector("#cp2-member-alert").innerHTML = `<div class="cp2-inline-alert">Enter the member's full name.</div>`;
    return;
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    document.querySelector("#cp2-member-alert").innerHTML = `<div class="cp2-inline-alert">Enter a valid email address or leave it blank.</div>`;
    return;
  }

  const chapterId = memberState.membership.chapterId;
  const common = {
    chapterId,
    fullName,
    preferredName: form.preferredName.value.trim(),
    email,
    memberRole: form.memberRole.value,
    status: form.status.value,
    joinedDate: form.joinedDate.value,
    notes: form.notes.value.trim(),
    lastModifiedByUid: memberState.user.uid,
    removedAt: null,
    updatedAt: serverTimestamp()
  };

  try {
    if (memberState.editingId) {
      await updateDoc(doc(db, "chapters", chapterId, "members", memberState.editingId), common);
      memberToast("Member updated", `${fullName}'s roster record was updated.`);
    } else {
      await addDoc(collection(db, "chapters", chapterId, "members"), {
        ...common,
        createdByUid: memberState.user.uid,
        createdAt: serverTimestamp()
      });
      memberToast("Member added", `${fullName} was added to the private chapter roster.`);
    }
    memberState.editingId = null;
    await loadMemberContext();
  } catch (error) {
    document.querySelector("#cp2-member-alert").innerHTML = `<div class="cp2-inline-alert">${escapeHTML(error.message || "The member record could not be saved.")}</div>`;
  }
}

async function archiveMember(memberId) {
  const member = memberState.members.find((item) => item.id === memberId);
  if (!member || !window.confirm(`Remove ${member.fullName} from the active chapter roster?`)) return;
  try {
    await updateDoc(doc(db, "chapters", memberState.membership.chapterId, "members", memberId), {
      status: "removed",
      removedAt: serverTimestamp(),
      lastModifiedByUid: memberState.user.uid,
      updatedAt: serverTimestamp()
    });
    memberState.editingId = null;
    await loadMemberContext();
    memberToast("Member removed", "The roster record was archived and is no longer shown to chapter leadership.");
  } catch (error) {
    memberToast("Unable to remove member", error.message || "The roster record could not be updated.");
  }
}

function bindMemberEvents() {
  document.querySelectorAll('[data-member-action="close-menu"]').forEach((button) => button.addEventListener("click", () => {
    memberState.drawerOpen = false;
    renderMembers();
  }));
  document.querySelector('[data-member-action="toggle-menu"]')?.addEventListener("click", () => {
    memberState.drawerOpen = !memberState.drawerOpen;
    renderMembers();
  });
  document.querySelector('[data-member-action="theme"]')?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("tpp-theme", next);
    renderMembers();
  });
  document.querySelector('[data-member-action="sign-out"]')?.addEventListener("click", async () => {
    await signOut(auth);
    location.hash = "/login";
  });
  document.querySelector('[data-member-action="retry"]')?.addEventListener("click", loadMemberContext);
  document.querySelector('[data-member-action="cancel-edit"]')?.addEventListener("click", () => {
    memberState.editingId = null;
    renderMembers();
  });
  document.querySelectorAll('[data-member-action="edit"]').forEach((button) => button.addEventListener("click", () => {
    memberState.editingId = button.dataset.memberId;
    renderMembers();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  document.querySelectorAll('[data-member-action="archive"]').forEach((button) => button.addEventListener("click", () => archiveMember(button.dataset.memberId)));
  document.querySelector("#cp2-member-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveMember(event.currentTarget);
  });

  const sidebar = document.querySelector("#cp2-member-sidebar");
  sidebar?.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#/"]');
    if (!link || !isMobile()) return;
    memberState.drawerOpen = false;
    document.body.classList.remove("cp2-drawer-locked");
  }, true);
}

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (routeFromHash() === MEMBER_ROUTE && memberState.drawerOpen) {
    memberState.drawerOpen = false;
    renderMembers();
  } else {
    closeLegacyDrawer();
  }
});

window.addEventListener("hashchange", () => {
  closeLegacyDrawer();
  if (routeFromHash() === MEMBER_ROUTE) {
    if (memberState.user) loadMemberContext();
    else renderMembers();
  } else {
    renderMembers();
    queueMicrotask(augmentExistingPortal);
  }
});

window.addEventListener("resize", () => {
  if (!isMobile()) {
    memberState.drawerOpen = false;
    document.body.classList.remove("cp2-drawer-locked");
  }
  queueMicrotask(augmentExistingPortal);
});

const observer = new MutationObserver(() => queueMicrotask(augmentExistingPortal));
observer.observe(app, { childList: true, subtree: true });

await authPersistenceReady;
onAuthStateChanged(auth, async (user) => {
  memberState.user = user;
  memberState.ready = true;
  memberState.error = null;
  memberState.membership = null;
  memberState.members = [];
  if (routeFromHash() === MEMBER_ROUTE) {
    if (user) await loadMemberContext();
    else renderMembers();
  } else {
    queueMicrotask(augmentExistingPortal);
  }
});
