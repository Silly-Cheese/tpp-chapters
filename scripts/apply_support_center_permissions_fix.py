from pathlib import Path

BUILD = "20260803.10"
changed = []


def save(path: Path, before: str, after: str) -> None:
    if before != after:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))


phase6_path = Path("assets/js/phase6.js")
phase6_before = phase6_path.read_text(encoding="utf-8")
phase6 = phase6_before

old_memberships = '''async function loadMemberships() {
  state.memberships = [];
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
}'''
new_memberships = '''async function loadMemberships() {
  state.memberships = [];
  const records = [];
  const primaryChapterId = state.profile?.primaryChapterId;

  if (primaryChapterId) {
    try {
      const direct = await getDoc(doc(db, "chapterMemberships", `${primaryChapterId}__${state.user.uid}`));
      if (direct.exists()) records.push({ id: direct.id, ...direct.data() });
    } catch (error) {
      if (error?.code !== "permission-denied") throw error;
    }
  }

  try {
    const snapshot = await getDocs(query(collection(db, "chapterMemberships"), where("uid", "==", state.user.uid)));
    snapshot.docs.forEach((item) => {
      if (!records.some((record) => record.id === item.id)) records.push({ id: item.id, ...item.data() });
    });
  } catch (error) {
    if (!records.length) throw error;
  }

  state.memberships = records
    .filter((item) => item.status === "active" && item.uid === state.user.uid)
    .sort((a, b) => String(a.chapterName || a.chapterId).localeCompare(String(b.chapterName || b.chapterId)));
  const saved = localStorage.getItem(`tpp-selected-chapter-${state.user.uid}`);
  const preferred = saved || primaryChapterId;
  state.selectedChapterId = state.memberships.some((item) => item.chapterId === preferred)
    ? preferred
    : state.memberships[0]?.chapterId || null;
}'''
if old_memberships not in phase6:
    raise SystemExit("Could not find Phase 6 loadMemberships implementation")
phase6 = phase6.replace(old_memberships, new_memberships, 1)

old_receipts = '''  await Promise.all(state.notices.map(async (notice) => {
    const receiptId = `${notice.id}__${state.user.uid}`;
    const receipt = await getDoc(doc(chapterRef, "noticeReceipts", receiptId));
    if (receipt.exists()) state.noticeReceipts.set(notice.id, receipt.data());
  }));'''
new_receipts = '''  await Promise.all(state.notices.map(async (notice) => {
    const receiptId = `${notice.id}__${state.user.uid}`;
    try {
      const receipt = await getDoc(doc(chapterRef, "noticeReceipts", receiptId));
      if (receipt.exists()) state.noticeReceipts.set(notice.id, receipt.data());
    } catch (error) {
      if (error?.code !== "permission-denied") throw error;
      console.warn("Notice acknowledgment state is not available yet.", error);
    }
  }));'''
if old_receipts not in phase6:
    raise SystemExit("Could not find Phase 6 notice receipt loader")
phase6 = phase6.replace(old_receipts, new_receipts, 1)

old_gate = '''function gatePage(message) {
  return `<main class="p6-gate" id="main-content"><section><img src="assets/brand-mark.svg" alt=""><p class="p6-kicker">Protected communications</p><h1>Access unavailable.</h1><p>${escapeHTML(message)}</p><a class="btn btn-primary" href="#/login">Return to sign in</a></section></main>`;
}'''
new_gate = '''function gatePage(message) {
  const signedInActions = state.user
    ? `<a class="btn btn-primary" href="#/chapter/overview">Return to chapter portal</a><button class="btn btn-secondary" type="button" data-p6-action="refresh">Retry support center</button>`
    : `<a class="btn btn-primary" href="#/login">Return to sign in</a>`;
  return `<main class="p6-gate" id="main-content"><section><img src="assets/brand-mark.svg" alt=""><p class="p6-kicker">Protected communications</p><h1>Support center unavailable.</h1><p>${escapeHTML(message)}</p><div class="p6-gate-actions">${signedInActions}</div></section></main>`;
}'''
if old_gate not in phase6:
    raise SystemExit("Could not find Phase 6 gate page")
phase6 = phase6.replace(old_gate, new_gate, 1)
save(phase6_path, phase6_before, phase6)

rules_path = Path("firestore.rules")
rules_before = rules_path.read_text(encoding="utf-8")
rules = rules_before

old_access = '''    function canAccessSupportTicketData(ticket) {
      return canManageSupport()
        || (hasChapterMembership(ticket.chapterId)
          && ((ticket.visibility == 'chapter'
              && ('chapter:' + ticket.chapterId) in ticket.accessKeys)
            || (ticket.visibility == 'adviser_private'
              && ticket.createdByUid == request.auth.uid
              && hasChapterMembershipRole(ticket.chapterId, ['adviser'])
              && ('user:' + request.auth.uid) in ticket.accessKeys)));
    }'''
new_access = '''    function canAccessSupportTicketData(ticket) {
      return canManageSupport()
        || (hasChapterMembership(ticket.chapterId)
          && (ticket.visibility == 'chapter'
            || (ticket.visibility == 'adviser_private'
              && ticket.createdByUid == request.auth.uid
              && hasChapterMembershipRole(ticket.chapterId, ['adviser']))));
    }'''
if old_access not in rules:
    raise SystemExit("Could not find support ticket access helper")
rules = rules.replace(old_access, new_access, 1)

old_receipt_rule = '''      match /noticeReceipts/{receiptId} {
        allow read: if canReadChapterOperations()
          || (hasChapterMembership(chapterId) && resource.data.uid == request.auth.uid);
        allow create, update: if validNoticeReceipt(chapterId, receiptId);
        allow delete: if canManageChapterWorkspaces();
      }'''
new_receipt_rule = '''      match /noticeReceipts/{receiptId} {
        allow get: if canReadChapterOperations() || hasChapterMembership(chapterId);
        allow list: if canReadChapterOperations();
        allow create, update: if validNoticeReceipt(chapterId, receiptId);
        allow delete: if canManageChapterWorkspaces();
      }'''
if old_receipt_rule not in rules:
    raise SystemExit("Could not find notice receipt rules")
rules = rules.replace(old_receipt_rule, new_receipt_rule, 1)

old_read_state = '''    match /supportReadStates/{readStateId} {
      allow read: if canManageSupport()
        || (signedIn() && resource.data.uid == request.auth.uid
          && canAccessSupportTicketData(supportTicket(resource.data.ticketId)));
      allow create, update: if validSupportReadState(readStateId);
      allow delete: if isOwner() || (signedIn() && resource.data.uid == request.auth.uid);
    }'''
new_read_state = '''    match /supportReadStates/{readStateId} {
      allow read: if canManageSupport()
        || (signedIn() && resource.data.uid == request.auth.uid);
      allow create, update: if validSupportReadState(readStateId);
      allow delete: if isOwner() || (signedIn() && resource.data.uid == request.auth.uid);
    }'''
if old_read_state not in rules:
    raise SystemExit("Could not find support read-state rules")
rules = rules.replace(old_read_state, new_read_state, 1)
save(rules_path, rules_before, rules)

css_path = Path("assets/support-center-fix.css")
css_content = '''/* Support Center permission and contrast refinements. */
.p6-gate {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--surface-soft, #f7f3e8);
  color: var(--text, #20201d);
}
.p6-gate > section {
  width: min(620px, 100%);
  padding: clamp(32px, 7vw, 64px);
  border: 1px solid var(--border, #d8d0bf);
  border-radius: 28px;
  background: var(--surface, #fff);
  color: var(--text, #20201d);
  text-align: center;
  box-shadow: 0 24px 70px rgba(38, 31, 20, .12);
}
.p6-gate h1 {
  margin: 22px 0 14px;
  color: var(--text, #20201d) !important;
  font-family: Georgia, serif;
  font-size: clamp(2.3rem, 8vw, 4.8rem);
  line-height: .98;
}
.p6-gate > section > p:last-of-type {
  color: var(--muted, #6f675b);
  font-size: 1.05rem;
  line-height: 1.7;
}
.p6-gate-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}
[data-theme="dark"] .p6-gate {
  --surface-soft: #0f0e0b;
  --surface: #191814;
  --text: #f5efe4;
  --muted: #b6ada0;
  --border: rgba(255,255,255,.12);
}
@media (max-width: 620px) {
  .p6-gate { padding: 18px; }
  .p6-gate > section { padding: 34px 22px; }
  .p6-gate-actions { display: grid; grid-template-columns: 1fr; }
  .p6-gate-actions .btn { width: 100%; }
}
'''
css_before = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
save(css_path, css_before, css_content)

index_path = Path("index.html")
index_before = index_path.read_text(encoding="utf-8")
index = index_before.replace("20260803.9", BUILD)
if "assets/support-center-fix.css" not in index:
    index = index.replace(
        f'  <link rel="stylesheet" href="assets/chapter-portal-mobile-members.css?v={BUILD}">',
        f'  <link rel="stylesheet" href="assets/chapter-portal-mobile-members.css?v={BUILD}">\n  <link rel="stylesheet" href="assets/support-center-fix.css?v={BUILD}">',
        1,
    )
save(index_path, index_before, index)

validator_path = Path("scripts/validate_support_center_permissions.py")
validator_content = f'''from pathlib import Path
import sys

errors = []
phase6 = Path("assets/js/phase6.js").read_text(encoding="utf-8")
rules = Path("firestore.rules").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")
css = Path("assets/support-center-fix.css").read_text(encoding="utf-8")

for marker in (
    "Notice acknowledgment state is not available yet.",
    "Return to chapter portal",
    "Support center unavailable.",
    "const records = [];",
):
    if marker not in phase6:
        errors.append(f"Phase 6 is missing support hardening marker: {{marker}}")

for marker in (
    "allow get: if canReadChapterOperations() || hasChapterMembership(chapterId);",
    "ticket.visibility == 'chapter'",
    "signedIn() && resource.data.uid == request.auth.uid",
):
    if marker not in rules:
        errors.append(f"Firestore rules are missing support marker: {{marker}}")

if "('chapter:' + ticket.chapterId) in ticket.accessKeys" in rules:
    errors.append("Support-ticket reads still depend on a query-unprovable accessKeys predicate")
if 'content="{BUILD}"' not in index:
    errors.append("Production build was not bumped to {BUILD}")
if 'assets/support-center-fix.css?v={BUILD}' not in index:
    errors.append("Support Center fix stylesheet is not loaded")
if ".p6-gate h1" not in css or '[data-theme="dark"] .p6-gate' not in css:
    errors.append("Support gate contrast rules are incomplete")

if errors:
    for error in errors:
        print(f"ERROR: {{error}}")
    sys.exit(1)
print("Support Center permissions validation passed.")
'''
validator_before = validator_path.read_text(encoding="utf-8") if validator_path.exists() else ""
save(validator_path, validator_before, validator_content)

if not changed:
    raise SystemExit("No Support Center changes were applied")
print("Updated:")
for item in changed:
    print(f"- {item}")
