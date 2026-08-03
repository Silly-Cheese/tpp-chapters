from pathlib import Path
import json
import re

ROOT = Path(".")
LEGACY_JS_PATTERN = r"/^TPP-CH-\d{4}-\d{6}$/"
FLEXIBLE_JS_PATTERN = r"/^TPP-CH-[A-Z0-9]{1,32}$/"
VALID_RULES_REGEX = "^TPP-CH-[A-Z0-9]{1,32}$"
EXAMPLE_ID = "TPP-CH-A1B2C3"

changed = []


def write_if_changed(path: Path, before: str, after: str) -> None:
    if before != after:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))


def widen_chapter_id_inputs(text: str) -> str:
    def update_tag(match: re.Match[str]) -> str:
        tag = match.group(0)
        lowered = tag.lower()
        if not any(token in lowered for token in ("chapterid", "chapter-id", "chapter_id")):
            return tag
        if re.search(r'maxlength="\d+"', tag, flags=re.I):
            return re.sub(r'maxlength="\d+"', 'maxlength="39"', tag, count=1, flags=re.I)
        return tag

    return re.sub(r"<input\b[^>]*>", update_tag, text, flags=re.I)


text_paths = [
    *Path("assets/js").glob("*.js"),
    Path("README.md"),
    *Path(".").glob("PHASE-*-NOTES.md"),
    *Path("docs").rglob("*.md"),
    *Path("docs").rglob("*.json"),
]

for path in text_paths:
    if not path.exists():
        continue
    before = path.read_text(encoding="utf-8")
    after = before.replace(LEGACY_JS_PATTERN, FLEXIBLE_JS_PATTERN)
    after = after.replace("TPP-CH-YYYY-######", EXAMPLE_ID)
    after = after.replace("TPP-CH-YYYY-000000", EXAMPLE_ID)
    after = after.replace("TPP-CH-2026-000001", EXAMPLE_ID)
    after = after.replace(
        "Use the permanent format TPP-CH-A1B2C3.",
        "Use TPP-CH- followed by letters and/or numbers, such as TPP-CH-A1B2C3.",
    )
    after = after.replace(
        "The Chapter ID does not match the official format TPP-CH-A1B2C3.",
        "The Chapter ID must begin with TPP-CH- and end with letters and/or numbers.",
    )
    if path.suffix == ".js":
        after = widen_chapter_id_inputs(after)
    write_if_changed(path, before, after)

rules_path = Path("firestore.rules")
rules_before = rules_path.read_text(encoding="utf-8")
rules_after = rules_before
helper = f"""

    function validChapterId(chapterId) {{
      return chapterId is string
        && chapterId.size() >= 8
        && chapterId.size() <= 39
        && chapterId.matches('{VALID_RULES_REGEX}');
    }}"""
anchor = """    function membershipId(chapterId, uid) {
      return chapterId + '__' + uid;
    }"""
if "function validChapterId(chapterId)" not in rules_after:
    if anchor not in rules_after:
        raise SystemExit("Could not find the Firestore membershipId helper anchor.")
    rules_after = rules_after.replace(anchor, anchor + helper, 1)

rules_after = rules_after.replace(
    "        && request.resource.data.chapterId is string\n        && request.resource.data.chapterId.size() == 18",
    "        && validChapterId(request.resource.data.chapterId)",
)
rules_after = rules_after.replace(
    "        && chapterId is string\n        && chapterId.size() == 18",
    "        && validChapterId(chapterId)",
)
write_if_changed(rules_path, rules_before, rules_after)

format_doc = Path("docs/CHAPTER-ID-FORMAT.md")
format_doc_content = """# Chapter ID Format

Every official chapter ID begins with:

```text
TPP-CH-
```

The final section contains **1 to 32 letters and/or numbers**. The portal normalizes typed IDs to uppercase.

Valid examples:

```text
TPP-CH-ABC
TPP-CH-12345
TPP-CH-A1B2C3
```

Invalid examples include a blank suffix, spaces, punctuation, underscores, or an additional hyphen after the prefix.

The complete validation expression is:

```text
^TPP-CH-[A-Z0-9]{1,32}$
```

Existing chapter records should use their already-issued permanent ID as both the Firestore document ID and the `chapterId` field.
"""
format_before = format_doc.read_text(encoding="utf-8") if format_doc.exists() else ""
write_if_changed(format_doc, format_before, format_doc_content)

validator_path = Path("scripts/validate_chapter_id_format.py")
validator_content = r'''from pathlib import Path
import re
import sys

EXPECTED_JS = r"/^TPP-CH-[A-Z0-9]{1,32}$/"
LEGACY_MARKERS = (
    r"/^TPP-CH-\d{4}-\d{6}$/",
    "TPP-CH-YYYY-######",
    "TPP-CH-YYYY-000000",
    "chapterId.size() == 18",
    "request.resource.data.chapterId.size() == 18",
)

errors = []
required_js_files = [
    Path("assets/js/app.js"),
    Path("assets/js/phase3.js"),
    Path("assets/js/phase4-admin.js"),
]

for path in required_js_files:
    text = path.read_text(encoding="utf-8")
    if EXPECTED_JS not in text:
        errors.append(f"{path} does not contain the flexible chapter ID pattern")

rules = Path("firestore.rules").read_text(encoding="utf-8")
if "function validChapterId(chapterId)" not in rules:
    errors.append("firestore.rules is missing validChapterId")
if "chapterId.matches('^TPP-CH-[A-Z0-9]{1,32}$')" not in rules:
    errors.append("firestore.rules is missing the approved chapter ID regex")

scan_paths = [
    *Path("assets/js").glob("*.js"),
    Path("firestore.rules"),
    Path("README.md"),
    *Path("docs").rglob("*.md"),
]
for path in scan_paths:
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    for marker in LEGACY_MARKERS:
        if marker in text:
            errors.append(f"Legacy chapter ID restriction remains in {path}: {marker}")

pattern = re.compile(r"^TPP-CH-[A-Z0-9]{1,32}$")
valid_examples = ["TPP-CH-ABC", "TPP-CH-12345", "TPP-CH-A1B2C3", "TPP-CH-Z"]
invalid_examples = ["TPP-CH-", "TPP-CH-A-B", "TPP-CH-A_B", "TPP CH ABC", "TPP-CH-ABC!", "TPP-CH-" + "A" * 33]
for value in valid_examples:
    if not pattern.fullmatch(value):
        errors.append(f"Expected valid example was rejected: {value}")
for value in invalid_examples:
    if pattern.fullmatch(value):
        errors.append(f"Expected invalid example was accepted: {value}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("Flexible chapter ID validation passed.")
'''
validator_before = validator_path.read_text(encoding="utf-8") if validator_path.exists() else ""
write_if_changed(validator_path, validator_before, validator_content)

workflow_path = Path(".github/workflows/validate.yml")
workflow_before = workflow_path.read_text(encoding="utf-8")
workflow_after = workflow_before
step = """

      - name: Validate chapter ID format
        run: python3 scripts/validate_chapter_id_format.py"""
if "Validate chapter ID format" not in workflow_after:
    marker = "      - name: Run repository checks\n        run: python3 scripts/validate_repository.py"
    if marker not in workflow_after:
        raise SystemExit("Could not find repository validation step.")
    workflow_after = workflow_after.replace(marker, marker + step, 1)
write_if_changed(workflow_path, workflow_before, workflow_after)

if not changed:
    raise SystemExit("No chapter ID changes were applied.")

print("Updated chapter ID handling in:")
for item in changed:
    print(f"- {item}")
