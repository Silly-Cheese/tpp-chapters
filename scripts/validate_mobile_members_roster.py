from pathlib import Path
import re
import sys

errors = []
index = Path("index.html").read_text(encoding="utf-8")
script = Path("assets/js/chapter-portal-mobile-members.js").read_text(encoding="utf-8")
styles = Path("assets/chapter-portal-mobile-members.css").read_text(encoding="utf-8")
rules = Path("firestore.rules").read_text(encoding="utf-8")

for marker in (
    'const MEMBER_ROUTE = "/chapter/members"',
    'data-member-action="close-menu"',
    'data-member-drawer-backdrop',
    'href="#/chapter/members"',
    'id="cp2-member-form"',
    'async function saveMember(form)',
    'async function archiveMember(memberId)',
    'This creates a private roster record. It does not create a portal login.',
):
    if marker not in script:
        errors.append(f"Member portal script is missing: {marker}")

for marker in (
    ".cp2-drawer-close",
    ".cp2-backdrop",
    ".cp2-sidebar.open + .cp2-backdrop",
    "background: #171612 !important",
    ".cp2-member-layout",
    ".cp2-member-row",
    "body.cp2-drawer-locked",
):
    if marker not in styles:
        errors.append(f"Member portal stylesheet is missing: {marker}")

for marker in (
    "function validNewChapterRosterMember(chapterId)",
    "function validChapterRosterMemberUpdate(chapterId)",
    "match /members/{memberId}",
    "hasChapterMembershipRole(chapterId, ['director', 'adviser'])",
):
    if marker not in rules:
        errors.append(f"Firestore member roster rules are missing: {marker}")

build = re.search(r'<meta name="tpp-build" content="([^"]+)">', index)
if not build or build.group(1) != "20260803.11":
    errors.append("Production build must be 20260803.11")
for asset in (
    "assets/chapter-portal-mobile-members.css?v=20260803.11",
    "assets/js/chapter-portal-mobile-members.js?v=20260803.11",
):
    if asset not in index:
        errors.append(f"Production entry point is missing: {asset}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("Mobile drawer and member roster validation passed.")
