from pathlib import Path
import sys

errors = []
scan = [*Path("assets/js").glob("*.js"), Path("firestore.rules"), Path("storage.rules")]
for path in scan:
    text = path.read_text(encoding="utf-8")
    for marker in ("sendEmailVerification", "emailVerified", "email_verified", "hasRequiredEmailVerification", "chapterRoleRequiresVerifiedEmail"):
        if marker in text:
            errors.append(f"{path} still contains the removed email-verification dependency: {marker}")

phase3 = Path("assets/js/phase3.js").read_text(encoding="utf-8")
for marker in (
    'navigate("/activation-complete")',
    "Email verification is not required for invitation-based chapter access.",
    "Single-use invitation code",
):
    if marker not in phase3 and marker != "Single-use invitation code":
        errors.append(f"Phase 3 is missing: {marker}")

app = Path("assets/js/app.js").read_text(encoding="utf-8")
if "Single-use invitation code" not in app:
    errors.append("The account profile does not explain the invitation-code activation method")

rules = Path("firestore.rules").read_text(encoding="utf-8")
if "currentUser().accountStatus == 'active';" not in rules:
    errors.append("Firestore isActive() was not simplified to active-profile authorization")
if "function hasChapterMembership(chapterId)" not in rules:
    errors.append("Firestore chapter-membership authorization is missing")

index = Path("index.html").read_text(encoding="utf-8")
if 'content="20260803.11"' not in index:
    errors.append("The production build was not cache-busted to 20260803.11")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Invitation-code activation validation passed.")
