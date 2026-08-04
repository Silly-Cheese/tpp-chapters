from pathlib import Path
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
        errors.append(f"Phase 6 is missing support hardening marker: {marker}")

for marker in (
    "allow get: if canReadChapterOperations() || hasChapterMembership(chapterId);",
    "ticket.visibility == 'chapter'",
    "signedIn() && resource.data.uid == request.auth.uid",
):
    if marker not in rules:
        errors.append(f"Firestore rules are missing support marker: {marker}")

if "('chapter:' + ticket.chapterId) in ticket.accessKeys" in rules:
    errors.append("Support-ticket reads still depend on a query-unprovable accessKeys predicate")
if 'content="20260803.11"' not in index:
    errors.append("Production build was not bumped to 20260803.11")
if 'assets/support-center-fix.css?v=20260803.11' not in index:
    errors.append("Support Center fix stylesheet is not loaded")
if ".p6-gate h1" not in css or '[data-theme="dark"] .p6-gate' not in css:
    errors.append("Support gate contrast rules are incomplete")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Support Center permissions validation passed.")
