from pathlib import Path

OLD = "20260803.9"
NEW = "20260803.10"
paths = [
    Path("scripts/validate_create_chapter_portal.py"),
    Path("scripts/validate_no_email_verification.py"),
    Path("scripts/validate_chapter_portal_v2.py"),
    Path("scripts/validate_mobile_members_roster.py"),
]

changed = []
for path in paths:
    text = path.read_text(encoding="utf-8")
    updated = text.replace(OLD, NEW)
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        changed.append(str(path))

print("Updated build validators:")
for item in changed:
    print(f"- {item}")
