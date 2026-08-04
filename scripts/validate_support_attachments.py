from pathlib import Path
import sys

errors = []
phase6 = Path("assets/js/phase6.js").read_text(encoding="utf-8")
storage = Path("storage.rules").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")

for marker in (
    "FILE_TYPE_BY_EXTENSION",
    "normalizedFileType(file)",
    "Cloud Storage for Firebase requires the Blaze plan",
    "Ticket created without its attachment",
    "Message sent without its attachment",
    "originalFileName: safeFileName(file.name)",
):
    if marker not in phase6:
        errors.append(f"Missing attachment implementation marker: {marker}")

shared_read = "allow read: if chapterCanAccessSupportTicket(chapterId, ticketId)\n        || staffCanAccessSupportTicket(chapterId, ticketId);"
if storage.count(shared_read) != 2:
    errors.append("Both chapter and staff attachment paths must be readable by authorized ticket participants")
if 'content="20260803.12"' not in index:
    errors.append("Production build was not bumped to 20260803.12")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Support attachment validation passed.")
