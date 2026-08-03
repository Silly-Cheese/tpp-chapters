from pathlib import Path
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
