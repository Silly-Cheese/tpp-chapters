from pathlib import Path
import re

BUILD = "20260803.8"
changed = []


def save(path: Path, before: str, after: str) -> None:
    if before != after:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))


def require_replace(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    if old not in text:
        raise SystemExit(f"Missing migration anchor: {label}")
    return text.replace(old, new, count)


# Firestore: a chapter member may read their own registry document even when it is not public.
path = Path("firestore.rules")
before = path.read_text(encoding="utf-8")
text = require_replace(
    before,
    """    match /publicChapterRegistry/{chapterId} {
      allow get, list: if canManageChapterWorkspaces() || resource.data.isPublished == true;
      allow create, update, delete: if canManageRegistry();
    }""",
    """    match /publicChapterRegistry/{chapterId} {
      allow get: if canManageChapterWorkspaces()
        || hasChapterMembership(chapterId)
        || resource.data.isPublished == true;
      allow list: if canManageChapterWorkspaces()
        || resource.data.isPublished == true;
      allow create, update, delete: if canManageRegistry();
    }""",
    "public registry member read rule",
)
save(path, before, text)


# Phase 4: make the core chapter portal resilient and current.
path = Path("assets/js/phase4.js")
before = path.read_text(encoding="utf-8")
text = before
text = require_replace(
    text,
    """  rendering: false,
  mobileOpen: false
};""",
    """  rendering: false,
  mobileOpen: false,
  accessIssue: null,
  dataWarnings: []
};""",
    "Phase 4 state",
)
text = text.replace("<small>Chapter Operations</small>", "<small>Chapter Portal</small>", 1)

helper_anchor = """function shouldHandle(route) {
  if (CHAPTER_ROUTES.has(route)) return true;
  return route === "/dashboard" && CHAPTER_PROFILE_ROLES.has(state.profile?.systemRole);
}
"""
helper_block = helper_anchor + """
function isPermissionError(error) {
  return error?.code === "permission-denied"
    || /missing or insufficient permissions|permission denied/i.test(error?.message || "");
}

async function optionalDocument(ref, label) {
  try {
    return await getDoc(ref);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    console.warn(`Optional chapter data unavailable: ${label}.`, error);
    state.dataWarnings.push(label);
    return null;
  }
}

async function optionalCollection(ref, label) {
  try {
    return await getDocs(ref);
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    console.warn(`Optional chapter collection unavailable: ${label}.`, error);
    state.dataWarnings.push(label);
    return null;
  }
}
"""
text = require_replace(text, helper_anchor, helper_block, "Phase 4 permission helpers")

text, count = re.subn(
    r"async function loadMemberships\(\) \{.*?\n\}\n\nasync function ensureOwnLeaderRecord",
    '''async function loadMemberships() {
  state.memberships = [];
  state.accessIssue = null;
  let records = [];
  try {
    const snapshot = await getDocs(query(collection(db, "chapterMemberships"), where("uid", "==", state.user.uid)));
    records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("The membership directory query was unavailable; trying the account's primary assignment.", error);
    const chapterId = state.profile?.primaryChapterId;
    if (chapterId) {
      try {
        const direct = await getDoc(doc(db, "chapterMemberships", `${chapterId}__${state.user.uid}`));
        if (direct.exists()) records = [{ id: direct.id, ...direct.data() }];
      } catch (directError) {
        state.accessIssue = directError;
      }
    } else {
      state.accessIssue = error;
    }
  }

  state.memberships = records
    .filter((item) => item.status === "active" && item.uid === state.user.uid)
    .sort((a, b) => String(a.chapterName || a.chapterId).localeCompare(String(b.chapterName || b.chapterId)));

  const saved = localStorage.getItem(`tpp-selected-chapter-${state.user.uid}`);
  const preferred = saved || state.profile?.primaryChapterId;
  state.selectedChapterId = state.memberships.some((item) => item.chapterId === preferred)
    ? preferred
    : state.memberships[0]?.chapterId || null;

  await Promise.all(state.memberships.map(ensureOwnLeaderRecord));
}

async function ensureOwnLeaderRecord''',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not replace Phase 4 membership loader")

text, count = re.subn(
    r"async function loadChapterWorkspace\(chapterId, \{ rerender = true \} = \{\}\) \{.*?\n\}\n\nfunction portalData\(\)",
    '''async function loadChapterWorkspace(chapterId, { rerender = true } = {}) {
  if (!chapterId) return;
  state.loading = true;
  state.error = null;
  state.dataWarnings = [];
  if (rerender) renderPhase4();
  try {
    const chapterRef = doc(db, "chapters", chapterId);
    const chapterSnapshot = await getDoc(chapterRef);
    const publicSnapshot = await optionalDocument(doc(db, "publicChapterRegistry", chapterId), "public verification record");
    const [requirementsSnapshot, leadersSnapshot, documentsSnapshot, noticesSnapshot] = await Promise.all([
      optionalCollection(collection(chapterRef, "requirements"), "requirements"),
      optionalCollection(collection(chapterRef, "leaders"), "leadership roster"),
      optionalCollection(collection(chapterRef, "documents"), "document library"),
      optionalCollection(collection(chapterRef, "notices"), "notices")
    ]);

    state.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;
    state.publicChapter = publicSnapshot?.exists() ? { id: publicSnapshot.id, ...publicSnapshot.data() } : null;
    state.requirements = (requirementsSnapshot?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || String(a.title).localeCompare(String(b.title)));
    state.leaders = (leadersSnapshot?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.visibleToChapter !== false && item.status !== "removed")
      .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.displayName).localeCompare(String(b.displayName)));
    state.documents = (documentsSnapshot?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status !== "archived")
      .sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
    state.notices = (noticesSnapshot?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.active !== false && (!toDate(item.expiresAt) || toDate(item.expiresAt).getTime() > Date.now()))
      .sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));

    state.receipts = new Map();
    await Promise.all(state.notices.map(async (notice) => {
      try {
        const receiptId = `${notice.id}__${state.user.uid}`;
        const receipt = await getDoc(doc(chapterRef, "noticeReceipts", receiptId));
        if (receipt.exists()) state.receipts.set(notice.id, receipt.data());
      } catch (error) {
        if (!isPermissionError(error)) throw error;
        state.dataWarnings.push("notice acknowledgments");
      }
    }));

    if (selectedMembership()?.role === "adviser") {
      const checkins = await optionalCollection(query(collection(chapterRef, "adviserCheckins"), where("createdByUid", "==", state.user.uid)), "adviser check-ins");
      state.adviserCheckins = (checkins?.docs || []).map((item) => ({ id: item.id, ...item.data() }))
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

function portalData()''',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not replace Phase 4 workspace loader")

text = require_replace(
    text,
    '''          ${adviserLink}
          <span class="p4-nav-label">Account</span>''',
    '''          ${adviserLink}
          <span class="p4-nav-label">Operations</span>
          <a class="p4-nav-link" href="#/chapter/workflows">${icons.file}<span>Reports & requests</span></a>
          <a class="p4-nav-link" href="#/chapter/submissions">${icons.clock}<span>Submission history</span></a>
          <a class="p4-nav-link" href="#/chapter/communications">${icons.bell}<span>Communications</span></a>
          <a class="p4-nav-link" href="#/chapter/support">${icons.shield}<span>Support center</span></a>
          <span class="p4-nav-label">Account</span>''',
    "unified chapter navigation",
)
text = text.replace('<span>Chapter Operations</span><strong>${escapeHTML(title)}</strong>', '<span>Chapter Portal</span><strong>${escapeHTML(title)}</strong>', 1)
text = require_replace(
    text,
    '''    ${!state.chapter ? workspaceMissing() : ""}
    <section class="p4-metric-grid">''',
    '''    ${!state.chapter ? workspaceMissing() : ""}
    ${state.dataWarnings.length ? `<section class="p4-card p4-data-warning"><div>${icons.alert}</div><div><strong>Some optional information is temporarily unavailable.</strong><span>${escapeHTML(Array.from(new Set(state.dataWarnings)).join(", "))}. The rest of the chapter portal remains available.</span></div></section>` : ""}
    <section class="p4-portal-actions" aria-label="Chapter portal actions">
      <a class="p4-portal-action" href="#/chapter/workflows"><span>${icons.file}</span><strong>Reports & requests</strong><small>Submit reports, events, changes, documents, and renewals.</small></a>
      <a class="p4-portal-action" href="#/chapter/submissions"><span>${icons.clock}</span><strong>Submission history</strong><small>Track drafts, reviews, decisions, and requested changes.</small></a>
      <a class="p4-portal-action" href="#/chapter/communications"><span>${icons.bell}</span><strong>Communications</strong><small>Review notices and chapter conversations.</small></a>
      <a class="p4-portal-action" href="#/chapter/support"><span>${icons.shield}</span><strong>Support center</strong><small>Open and follow support requests with Prayer Project staff.</small></a>
    </section>
    <section class="p4-metric-grid">''',
    "chapter overview actions",
)

account_repair = '''function accountRepairPage() {
  const chapterId = state.profile?.primaryChapterId || "your assigned chapter";
  return `<main class="p4-gate" id="main-content"><section class="p4-gate-card p4-account-repair"><img src="assets/brand-mark.svg" alt=""><p class="p4-kicker">Chapter access</p><h1>Your account needs one access refresh.</h1><p>The portal found your active account, but Firestore did not return the membership for <strong>${escapeHTML(chapterId)}</strong>. This usually means the newest rules have not been deployed or the invitation claim did not finish.</p><div class="p4-actions"><button class="btn btn-primary" type="button" data-p4-action="retry-access">Retry chapter access</button><a class="btn btn-secondary" href="#/activate">Use the invitation code again</a><a class="btn btn-secondary" href="#/chapter/support">Contact support</a></div></section></main>`;
}

'''
text = require_replace(text, "function errorPage() {", account_repair + "function errorPage() {", "account repair page")
text = require_replace(
    text,
    'return chapterLayout(`<section class="p4-card p4-empty"><div class="p4-large-icon">${icons.alert}</div><strong>Unable to load the chapter workspace.</strong><span>${escapeHTML(state.error?.message || "Firestore denied or could not complete the request.")}</span><button class="btn btn-primary" type="button" data-p4-action="retry">Try again</button></section>`, "", "Workspace Error");',
    'return chapterLayout(`<section class="p4-card p4-empty"><div class="p4-large-icon">${icons.alert}</div><strong>${isPermissionError(state.error) ? "Chapter access could not be confirmed." : "Unable to load the chapter workspace."}</strong><span>${escapeHTML(isPermissionError(state.error) ? "The account or Firestore rules do not currently permit this chapter read. Retry access or return to activation." : state.error?.message || "The request could not be completed.")}</span><div class="p4-actions"><button class="btn btn-primary" type="button" data-p4-action="retry">Try again</button><a class="btn btn-secondary" href="#/activate">Account activation</a></div></section>`, "", "Workspace Access");',
    "workspace error copy",
)
text = require_replace(
    text,
    '''    } else if (!state.memberships.length) {
      app.innerHTML = noAccessPage();''',
    '''    } else if (state.accessIssue) {
      app.innerHTML = accountRepairPage();
    } else if (!state.memberships.length) {
      app.innerHTML = noAccessPage();''',
    "account repair render condition",
)
text = require_replace(
    text,
    '''  document.querySelectorAll('[data-p4-action="retry"]').forEach((button) => button.addEventListener("click", () => loadChapterWorkspace(state.selectedChapterId)));
  document.querySelector("#p4-adviser-form")''',
    '''  document.querySelectorAll('[data-p4-action="retry"]').forEach((button) => button.addEventListener("click", () => loadChapterWorkspace(state.selectedChapterId)));
  document.querySelectorAll('[data-p4-action="retry-access"]').forEach((button) => button.addEventListener("click", () => location.reload()));
  document.querySelector("#p4-adviser-form")''',
    "retry access binding",
)
text = require_replace(
    text,
    '''  } catch (error) {
    console.error("Unable to initialize Phase 4.", error);
    state.error = error;''',
    '''  } catch (error) {
    console.error("Unable to initialize the chapter portal.", error);
    if (isPermissionError(error)) state.accessIssue = error;
    else state.error = error;''',
    "Phase 4 initialization error handling",
)
save(path, before, text)


# Phase 5 and 6: do not query memberships in the background on unrelated routes.
for filename, phase, render_call, route_set, gate_copy in [
    ("assets/js/phase5.js", "5", "renderPhase5()", "PHASE5_ROUTES", "The reports and requests area could not initialize."),
    ("assets/js/phase6.js", "6", "renderPhase6({ prepare: true })", "PHASE6_ROUTES", "The communications area could not initialize."),
]:
    path = Path(filename)
    before = path.read_text(encoding="utf-8")
    text = before.replace("<small>Chapter Operations</small>", "<small>Chapter Portal</small>", 1)
    pattern = rf'''onAuthStateChanged\(auth, async \(user\) => \{{\n  (?P<prefix>.*?)state\.user = user;\n  await loadProfile\(user\);\n  state\.authReady = true;\n  if \(user && CHAPTER_ROLES\.has\(state\.profile\?\.systemRole\)\) await loadMemberships\(\);\n  await {re.escape(render_call)};\n\}}\);'''
    replacement = f'''onAuthStateChanged(auth, async (user) => {{
  {'cleanupListeners();\n  ' if phase == '6' else ''}state.user = user;
  state.authReady = false;
  try {{
    await loadProfile(user);
    state.authReady = true;
    await {render_call};
  }} catch (error) {{
    state.authReady = true;
    console.error("Unable to initialize Phase {phase}.", error);
    if ({route_set}.has(routeFromHash())) app.innerHTML = gatePage("{gate_copy}");
    else augmentExistingNavigation();
  }}
}});'''
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not replace Phase {phase} auth callback")
    save(path, before, text)


# Phase 8: stop describing every permission failure as stale cache.
path = Path("assets/js/phase8.js")
before = path.read_text(encoding="utf-8")
text = before
text = text.replace('  "assets/portal-hotfix.css",', '  "assets/portal-hotfix.css",\n  "assets/chapter-portal-refresh.css",', 1)
text = require_replace(
    text,
    '''  panel.innerHTML = `<div><strong>Something did not load correctly.</strong><p>Reference ${escapeHTML(id)}. Refresh the portal files to clear an outdated browser copy.</p><span class="p8-error-detail">${escapeHTML(message.slice(0, 180))}</span></div><button type="button" data-p8-action="hard-reload">Refresh portal files</button><button type="button" aria-label="Dismiss error" data-p8-action="dismiss-error">×</button>`;''',
    '''  const permissionIssue = /permission|insufficient/i.test(message);
  const heading = permissionIssue ? "Portal access could not be confirmed." : "Something did not load correctly.";
  const guidance = permissionIssue ? "The current account was denied one portal read. The page will remain usable where possible; retry after the current Firestore rules are deployed." : "Reload the current portal build and try the operation again.";
  panel.innerHTML = `<div><strong>${escapeHTML(heading)}</strong><p>Reference ${escapeHTML(id)}. ${escapeHTML(guidance)}</p><span class="p8-error-detail">${escapeHTML(message.slice(0, 180))}</span></div><button type="button" data-p8-action="hard-reload">Retry portal</button><button type="button" aria-label="Dismiss error" data-p8-action="dismiss-error">×</button>`;''',
    "Phase 8 error guidance",
)
save(path, before, text)


# New styling for the unified chapter portal.
path = Path("assets/chapter-portal-refresh.css")
content = '''/* Unified chapter portal and resilient access states. */
.p4-portal-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.p4-portal-action {
  display: grid;
  gap: 9px;
  min-height: 170px;
  padding: 22px;
  border: 1px solid var(--p4-line, rgba(181, 143, 70, 0.25));
  border-radius: 20px;
  background: var(--p4-card, var(--paper));
  color: inherit;
  text-decoration: none;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.p4-portal-action:hover,
.p4-portal-action:focus-visible {
  transform: translateY(-2px);
  border-color: var(--gold);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.12);
}

.p4-portal-action > span {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: rgba(213, 174, 96, 0.14);
  color: var(--gold);
}

.p4-portal-action .icon { width: 22px; height: 22px; }
.p4-portal-action strong { font-size: 1.02rem; }
.p4-portal-action small { color: var(--p4-muted, var(--muted)); line-height: 1.55; }

.p4-data-warning {
  display: flex;
  gap: 15px;
  align-items: flex-start;
  margin-bottom: 18px;
  border-style: dashed;
}

.p4-data-warning > div:first-child { color: var(--gold); }
.p4-data-warning strong,
.p4-data-warning span { display: block; }
.p4-data-warning span { margin-top: 6px; color: var(--p4-muted, var(--muted)); }

.p4-account-repair { max-width: 720px; }
.p4-account-repair strong { color: inherit; }

.p4-sidebar .p4-nav { overflow-y: auto; padding-bottom: 24px; }

@media (max-width: 1100px) {
  .p4-portal-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .p4-portal-actions { grid-template-columns: 1fr; }
  .p4-portal-action { min-height: 0; }
}
'''
before_css = path.read_text(encoding="utf-8") if path.exists() else ""
save(path, before_css, content)


# Production entry point and build-specific validators.
path = Path("index.html")
before = path.read_text(encoding="utf-8")
text = re.sub(r'<meta name="tpp-build" content="[^"]+">', f'<meta name="tpp-build" content="{BUILD}">', before)
text = re.sub(r'\?v=[0-9.]+"', f'?v={BUILD}"', text)
text = text.replace('  <link rel="stylesheet" href="assets/portal-hotfix.css?v=' + BUILD + '">', '  <link rel="stylesheet" href="assets/portal-hotfix.css?v=' + BUILD + '">\n  <link rel="stylesheet" href="assets/chapter-portal-refresh.css?v=' + BUILD + '">', 1)
save(path, before, text)

for filename in ("scripts/validate_create_chapter_portal.py", "scripts/validate_no_email_verification.py"):
    path = Path(filename)
    before = path.read_text(encoding="utf-8")
    text = before.replace("20260803.7", BUILD)
    save(path, before, text)

# Permanent regression validator.
path = Path("scripts/validate_chapter_portal_resilience.py")
content = '''from pathlib import Path
import sys

errors = []
phase4 = Path("assets/js/phase4.js").read_text(encoding="utf-8")
phase5 = Path("assets/js/phase5.js").read_text(encoding="utf-8")
phase6 = Path("assets/js/phase6.js").read_text(encoding="utf-8")
phase8 = Path("assets/js/phase8.js").read_text(encoding="utf-8")
rules = Path("firestore.rules").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")
css = Path("assets/chapter-portal-refresh.css").read_text(encoding="utf-8")

required_phase4 = [
    "function isPermissionError(error)",
    "async function optionalDocument",
    "async function optionalCollection",
    "The membership directory query was unavailable",
    'href="#/chapter/workflows"',
    'href="#/chapter/submissions"',
    'href="#/chapter/communications"',
    'href="#/chapter/support"',
    "function accountRepairPage()",
    "Some optional information is temporarily unavailable.",
]
for marker in required_phase4:
    if marker not in phase4:
        errors.append(f"Phase 4 is missing resilience/current-portal marker: {marker}")

for name, text in (("Phase 5", phase5), ("Phase 6", phase6)):
    callback = text.split("onAuthStateChanged(auth, async (user) => {", 1)[-1]
    if "await loadMemberships();" in callback.split("});", 1)[0]:
        errors.append(f"{name} still performs an eager background membership read")

if "hasChapterMembership(chapterId)" not in rules.split("match /publicChapterRegistry/{chapterId}", 1)[-1].split("match /chapterInvitations", 1)[0]:
    errors.append("Chapter members cannot read their own unpublished registry document")
if "permissionIssue" not in phase8:
    errors.append("Phase 8 does not distinguish permission failures from cache failures")
if 'content="20260803.8"' not in index:
    errors.append("Production build was not bumped to 20260803.8")
if "assets/chapter-portal-refresh.css?v=20260803.8" not in index:
    errors.append("The unified chapter portal stylesheet is not loaded")
for marker in (".p4-portal-actions", ".p4-portal-action", ".p4-account-repair"):
    if marker not in css:
        errors.append(f"Missing chapter portal style: {marker}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Chapter portal resilience validation passed.")
'''
before_validator = path.read_text(encoding="utf-8") if path.exists() else ""
save(path, before_validator, content)

if not changed:
    raise SystemExit("No chapter portal resilience changes were applied")

print("Updated:")
for item in changed:
    print(f"- {item}")
