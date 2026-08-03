from pathlib import Path
import re

BUILD = "20260803.5"
changed = []


def save(path: Path, before: str, after: str) -> None:
    if before != after:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))


# ---------------------------------------------------------------------------
# Firestore authorization
# ---------------------------------------------------------------------------
rules_path = Path("firestore.rules")
rules_before = rules_path.read_text(encoding="utf-8")
rules = rules_before

valid_id_helper = """    function validChapterId(chapterId) {
      return chapterId is string
        && chapterId.size() >= 8
        && chapterId.size() <= 39
        && chapterId.matches('^TPP-CH-[A-Z0-9]{1,32}$');
    }"""
invitation_ready_helper = valid_id_helper + """

    function invitationChapterIsReady(chapterId, chapterName) {
      return exists(/databases/$(database)/documents/chapters/$(chapterId))
        && get(/databases/$(database)/documents/chapters/$(chapterId)).data.officialName == chapterName;
    }"""
if "function invitationChapterIsReady" not in rules:
    if valid_id_helper not in rules:
        raise SystemExit("Could not find validChapterId helper in firestore.rules")
    rules = rules.replace(valid_id_helper, invitation_ready_helper, 1)

old_registry_rule = "      allow get, list: if resource.data.isPublished == true;"
new_registry_rule = "      allow get, list: if canManageChapterWorkspaces() || resource.data.isPublished == true;"
if old_registry_rule not in rules:
    raise SystemExit("Could not find the public registry read rule")
rules = rules.replace(old_registry_rule, new_registry_rule, 1)

old_invitation_source = """        && get(/databases/$(database)/documents/publicChapterRegistry/$(request.resource.data.chapterId)).data.isPublished == true
        && get(/databases/$(database)/documents/publicChapterRegistry/$(request.resource.data.chapterId)).data.officialName == request.resource.data.chapterName;"""
new_invitation_source = """        && invitationChapterIsReady(
          request.resource.data.chapterId,
          request.resource.data.chapterName
        );"""
if old_invitation_source not in rules:
    raise SystemExit("Could not find the invitation registry validation block")
rules = rules.replace(old_invitation_source, new_invitation_source, 1)
save(rules_path, rules_before, rules)


# ---------------------------------------------------------------------------
# Chapter workspace administration
# ---------------------------------------------------------------------------
p4_path = Path("assets/js/phase4-admin.js")
p4_before = p4_path.read_text(encoding="utf-8")
p4 = p4_before

as_date = """function asDate(value) {
  return value ? new Date(`${value}T12:00:00`) : null;
}"""
record_name = as_date + """

function recordName(record) {
  return record?.officialName || record?.chapterName || record?.name || state.chapterId;
}"""
if "function recordName(record)" not in p4:
    if as_date not in p4:
        raise SystemExit("Could not find the Phase 4 asDate helper")
    p4 = p4.replace(as_date, record_name, 1)

old_load_pattern = re.compile(
    r'''  try \{\n    const chapterRef = doc\(db, "chapters", state\.chapterId\);\n    const \[publicSnapshot, chapterSnapshot, requirementsSnapshot, leadersSnapshot, documentsSnapshot, noticesSnapshot\] = await Promise\.all\(\[\n      getDoc\(doc\(db, "publicChapterRegistry", state\.chapterId\)\),\n      getDoc\(chapterRef\),\n      getDocs\(collection\(chapterRef, "requirements"\)\),\n      getDocs\(collection\(chapterRef, "leaders"\)\),\n      getDocs\(collection\(chapterRef, "documents"\)\),\n      getDocs\(collection\(chapterRef, "notices"\)\)\n    \]\);\n    state\.publicChapter = publicSnapshot\.exists\(\) \? \{ id: publicSnapshot\.id, \.\.\.publicSnapshot\.data\(\) \} : null;\n    state\.chapter = chapterSnapshot\.exists\(\) \? \{ id: chapterSnapshot\.id, \.\.\.chapterSnapshot\.data\(\) \} : null;\n    state\.requirements = requirementsSnapshot\.docs\.map\(\(item\) => \(\{ id: item\.id, \.\.\.item\.data\(\) \}\)\)\.sort\(\(a, b\) => \(a\.sortOrder \?\? 999\) - \(b\.sortOrder \?\? 999\)\);\n    state\.leaders = leadersSnapshot\.docs\.map\(\(item\) => \(\{ id: item\.id, \.\.\.item\.data\(\) \}\)\)\.sort\(\(a, b\) => String\(a\.displayName\)\.localeCompare\(String\(b\.displayName\)\)\);\n    state\.documents = documentsSnapshot\.docs\.map\(\(item\) => \(\{ id: item\.id, \.\.\.item\.data\(\) \}\)\)\.sort\(\(a, b\) => String\(a\.title\)\.localeCompare\(String\(b\.title\)\)\);\n    state\.notices = noticesSnapshot\.docs\.map\(\(item\) => \(\{ id: item\.id, \.\.\.item\.data\(\) \}\)\)\.sort\(\(a, b\) => \(toDate\(b\.publishedAt\)\?\.getTime\(\) \|\| 0\) - \(toDate\(a\.publishedAt\)\?\.getTime\(\) \|\| 0\)\);\n    localStorage\.setItem\("tpp-admin-workspace-chapter", state\.chapterId\);''',
    re.S,
)
new_load = '''  try {
    const chapterRef = doc(db, "chapters", state.chapterId);
    const [publicSnapshot, chapterSnapshot] = await Promise.all([
      getDoc(doc(db, "publicChapterRegistry", state.chapterId)),
      getDoc(chapterRef)
    ]);
    state.publicChapter = publicSnapshot.exists() ? { id: publicSnapshot.id, ...publicSnapshot.data() } : null;
    state.chapter = chapterSnapshot.exists() ? { id: chapterSnapshot.id, ...chapterSnapshot.data() } : null;
    state.requirements = [];
    state.leaders = [];
    state.documents = [];
    state.notices = [];

    if (state.chapter) {
      const [requirementsSnapshot, leadersSnapshot, documentsSnapshot, noticesSnapshot] = await Promise.all([
        getDocs(collection(chapterRef, "requirements")),
        getDocs(collection(chapterRef, "leaders")),
        getDocs(collection(chapterRef, "documents")),
        getDocs(collection(chapterRef, "notices"))
      ]);
      state.requirements = requirementsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
      state.leaders = leadersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")));
      state.documents = documentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
      state.notices = noticesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
    }
    localStorage.setItem("tpp-admin-workspace-chapter", state.chapterId);'''
p4, load_count = old_load_pattern.subn(new_load, p4, count=1)
if load_count != 1:
    raise SystemExit(f"Expected one Phase 4 workspace load replacement, found {load_count}")

p4 = p4.replace(
    '<h2>Published chapter not found.</h2><p>Phase 4 workspaces can only be initialized for a Chapter ID already published in <code>publicChapterRegistry</code>.</p>',
    '<h2>Chapter registry record not found.</h2><p>Create or import this Chapter ID in <code>publicChapterRegistry</code> before initializing its private workspace. The record does not need to be publicly published.</p>',
    1,
)
p4 = p4.replace(
    '${escapeHTML(state.publicChapter.officialName)} has a public registry record',
    '${escapeHTML(recordName(state.publicChapter))} has a registry record',
    1,
)
p4 = p4.replace('    officialName: publicRecord.officialName,', '    officialName: recordName(publicRecord),', 1)
p4 = p4.replace(
    '  if (!state.publicChapter) return layout(`${searchPanel()}${notPublishedState()}`);\n  if (!state.chapter) return layout(`${searchPanel()}${initializePanel()}`);',
    '  if (!state.publicChapter && !state.chapter) return layout(`${searchPanel()}${notPublishedState()}`);\n  if (!state.chapter) return layout(`${searchPanel()}${initializePanel()}`);',
    1,
)
p4 = p4.replace(
    '<p>${escapeHTML(state.error.message || "Firestore rejected the request.")}</p>',
    '<p>${escapeHTML(state.error?.code === "permission-denied" ? "The updated administrative registry rule has not been deployed yet. Deploy the current Firestore rules and try again." : state.error.message || "Firestore rejected the request.")}</p>',
    1,
)
p4 = p4.replace('<span>Phase 4</span><strong>Chapter Workspace Setup</strong>', '<span>Administration</span><strong>Chapter Workspace Setup</strong>', 1)
save(p4_path, p4_before, p4)


# ---------------------------------------------------------------------------
# Invitations and activation
# ---------------------------------------------------------------------------
p3_path = Path("assets/js/phase3.js")
p3_before = p3_path.read_text(encoding="utf-8")
p3 = p3_before

p3 = p3.replace(
    '  invitationLoading: false,\n  invitationError: null,',
    '  invitationLoading: false,\n  invitationsLoaded: false,\n  invitationError: null,',
    1,
)
p3 = p3.replace(
    '<span class="phase3-kicker">Phase 3</span><strong>Account Access</strong>',
    '<span class="phase3-kicker">Administration</span><strong>Account Access</strong>',
    1,
)
p3 = p3.replace(
    '          <p>The chapter must already have a published record in the public registry.</p>',
    '          <p>The chapter must already have an initialized private workspace.</p>',
    1,
)

membership_preread = '''  const existingProfile = await getDoc(userRef);
  const existingMembership = await getDoc(memberRef);
  if (existingMembership.exists()) throw new Error("This account already has access to the assigned chapter.");
'''
replacement_preread = '''  const existingProfile = await getDoc(userRef);
'''
if membership_preread not in p3:
    raise SystemExit("Could not find the unverified membership pre-read")
p3 = p3.replace(membership_preread, replacement_preread, 1)

old_invitation_lookup = '''    const chapterSnapshot = await getDoc(doc(db, "publicChapterRegistry", chapterId));
    if (!chapterSnapshot.exists() || chapterSnapshot.data().isPublished !== true) throw new Error("No published registry record was found for this Chapter ID.");
    const chapter = chapterSnapshot.data();'''
new_invitation_lookup = '''    const [workspaceSnapshot, registrySnapshot] = await Promise.all([
      getDoc(doc(db, "chapters", chapterId)),
      getDoc(doc(db, "publicChapterRegistry", chapterId))
    ]);
    if (!workspaceSnapshot.exists()) {
      throw new Error("Initialize this chapter's private workspace before issuing an account invitation.");
    }
    const workspace = workspaceSnapshot.data();
    const registry = registrySnapshot.exists() ? registrySnapshot.data() : {};
    const chapterName = workspace.officialName || registry.officialName || registry.chapterName || chapterId;'''
if old_invitation_lookup not in p3:
    raise SystemExit("Could not find the invitation chapter lookup")
p3 = p3.replace(old_invitation_lookup, new_invitation_lookup, 1)
p3 = p3.replace('      chapterName: chapter.officialName,', '      chapterName,', 1)

# Mark the invitation list as loaded even when it is empty. This prevents the
# empty-list render loop that destroyed focused input fields on every keystroke.
p3 = p3.replace(
    '  phase3State.invitationLoading = true;\n  phase3State.invitationError = null;',
    '  phase3State.invitationLoading = true;\n  phase3State.invitationError = null;',
    1,
)
p3 = p3.replace(
    '  } finally {\n    phase3State.invitationLoading = false;\n    if (rerender) renderPhase3();\n  }\n}\n\nasync function lookupInvitation',
    '  } finally {\n    phase3State.invitationLoading = false;\n    phase3State.invitationsLoaded = true;\n    if (rerender) renderPhase3();\n  }\n}\n\nasync function lookupInvitation',
    1,
)
p3 = p3.replace(
    '    if (route === "/admin/invitations" && !phase3State.invitationLoading && !phase3State.invitations.length && !phase3State.invitationError) {',
    '    if (route === "/admin/invitations" && !phase3State.invitationLoading && !phase3State.invitationsLoaded) {',
    1,
)

# Reset invitation state when a different Firebase account takes over the tab.
p3 = p3.replace(
    'onAuthStateChanged(auth, async (user) => {\n  phase3State.user = user;',
    'onAuthStateChanged(auth, async (user) => {\n  const previousUid = phase3State.user?.uid || null;\n  const nextUid = user?.uid || null;\n  if (previousUid !== nextUid) {\n    phase3State.invitations = [];\n    phase3State.invitationsLoaded = false;\n    phase3State.invitationError = null;\n  }\n  phase3State.user = user;',
    1,
)

p3 = p3.replace(
    'phase3State.invitationError = "Firestore could not return the invitation list. Confirm that the Phase 3 rules are deployed.";',
    'phase3State.invitationError = error?.code === "permission-denied" ? "The updated invitation rules have not been deployed. Deploy Firestore rules and refresh." : "Firestore could not return the invitation list.";',
    1,
)
p3 = p3.replace(
    '<a class="btn btn-primary" href="#/dashboard">Open my dashboard ${icons.arrow}</a>',
    '<a class="btn btn-primary" href="#/portal">Open my portal ${icons.arrow}</a>',
    1,
)

old_activation_message = '''    const message = error?.code === "auth/email-already-in-use"
      ? "An account already exists for this email. Choose “Use an existing account” instead."
      : error?.code === "auth/weak-password"
        ? "Firebase rejected the password. Use a stronger password with at least 10 characters."
        : error?.message || "The account could not be activated.";'''
new_activation_message = '''    const message = error?.code === "auth/email-already-in-use"
      ? "An account already exists for this email. Choose “Use an existing account” instead."
      : error?.code === "auth/weak-password"
        ? "Firebase rejected the password. Use a stronger password with at least 10 characters."
        : error?.code === "permission-denied"
          ? "The Firebase account was created, but chapter access could not be assigned because the updated Firestore rules are not deployed. Deploy the rules, then choose “Use an existing account” with the same email and password."
          : error?.message || "The account could not be activated.";'''
if old_activation_message not in p3:
    raise SystemExit("Could not find the new-account activation error mapping")
p3 = p3.replace(old_activation_message, new_activation_message, 1)
save(p3_path, p3_before, p3)


# ---------------------------------------------------------------------------
# Production entry point and duplicate activation handler removal
# ---------------------------------------------------------------------------
index_path = Path("index.html")
index_before = index_path.read_text(encoding="utf-8")
index = index_before
index = re.sub(r'<meta name="tpp-build" content="[^"]+">', f'<meta name="tpp-build" content="{BUILD}">', index)
index = re.sub(r'\?v=[0-9.]+', f'?v={BUILD}', index)
index = re.sub(r'\n\s*<script type="module" src="assets/js/phase3-activation-guard\.js\?v=[^"]+"></script>', '', index)
save(index_path, index_before, index)

guard_path = Path("assets/js/phase3-activation-guard.js")
if guard_path.exists():
    guard_path.unlink()
    changed.append(str(guard_path))

# Remove stale documentation references to the deleted compatibility module.
for path in [*Path("docs").rglob("*.md"), *Path(".").glob("PHASE-*-NOTES.md")]:
    before = path.read_text(encoding="utf-8")
    after = before.replace("`assets/js/phase3-activation-guard.js`", "the consolidated Phase 3 activation workflow")
    after = after.replace("assets/js/phase3-activation-guard.js", "assets/js/phase3.js")
    save(path, before, after)


# ---------------------------------------------------------------------------
# Handoff documentation and permanent validator
# ---------------------------------------------------------------------------
doc_path = Path("docs/WORKSPACE-INVITATION-ACTIVATION-FLOW.md")
doc_content = """# Workspace, Invitation, and Activation Flow

Use this order for every approved chapter:

1. Create or import the Chapter ID in `publicChapterRegistry`.
2. Sign in as Owner, Chapter Administrator, or Compliance Administrator.
3. Open `/#/admin/chapter-workspaces` and initialize `chapters/{chapterId}`.
4. Open `/#/admin/invitations` and issue a Director or Adviser invitation.
5. The recipient opens `/#/activate`, creates or connects a Firebase account, and accepts the invitation.
6. The recipient verifies the assigned email and enters `/#/portal`.

The registry record does not have to be publicly published for authorized administrators to initialize the private workspace. Public visitors can still read only records where `isPublished == true`.

## Firebase deployment

This repair changes Firestore Security Rules. Deploy them with:

```bash
firebase deploy --only firestore:rules
```

No composite indexes are required.
"""
doc_before = doc_path.read_text(encoding="utf-8") if doc_path.exists() else ""
save(doc_path, doc_before, doc_content)

validator_path = Path("scripts/validate_workspace_invitation_activation.py")
validator_content = r'''from pathlib import Path
import re
import sys

errors = []
index = Path("index.html").read_text(encoding="utf-8")
phase3 = Path("assets/js/phase3.js").read_text(encoding="utf-8")
phase4 = Path("assets/js/phase4-admin.js").read_text(encoding="utf-8")
rules = Path("firestore.rules").read_text(encoding="utf-8")

required_phase3 = [
    "invitationsLoaded: false",
    "phase3State.invitationsLoaded = true",
    '!phase3State.invitationsLoaded',
    "Initialize this chapter's private workspace before issuing an account invitation.",
    'const [workspaceSnapshot, registrySnapshot]',
]
for marker in required_phase3:
    if marker not in phase3:
        errors.append(f"Phase 3 is missing: {marker}")

if "const existingMembership = await getDoc(memberRef)" in phase3:
    errors.append("Phase 3 still pre-reads a membership before email verification")
if "phase3-activation-guard.js" in index:
    errors.append("index.html still loads the competing activation guard")
if Path("assets/js/phase3-activation-guard.js").exists():
    errors.append("The duplicate activation guard file still exists")

required_phase4 = [
    'const [publicSnapshot, chapterSnapshot]',
    'if (state.chapter) {',
    'function recordName(record)',
]
for marker in required_phase4:
    if marker not in phase4:
        errors.append(f"Phase 4 is missing: {marker}")

required_rules = [
    "function invitationChapterIsReady",
    "allow get, list: if canManageChapterWorkspaces() || resource.data.isPublished == true;",
    "&& invitationChapterIsReady(",
]
for marker in required_rules:
    if marker not in rules:
        errors.append(f"Firestore rules are missing: {marker}")

build_match = re.search(r'<meta name="tpp-build" content="([^"]+)">', index)
if not build_match:
    errors.append("index.html is missing the build marker")
else:
    build = build_match.group(1)
    for asset, version in re.findall(r'(?:href|src)="(assets/[^"?]+\.(?:css|js))\?v=([^"]+)"', index):
        if version != build:
            errors.append(f"Asset {asset} has version {version}, expected {build}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Workspace, invitation, and activation validation passed.")
'''
validator_before = validator_path.read_text(encoding="utf-8") if validator_path.exists() else ""
save(validator_path, validator_before, validator_content)

if not changed:
    raise SystemExit("No workspace/invitation/activation changes were applied")

print("Updated:")
for path in changed:
    print(f"- {path}")
