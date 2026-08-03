from pathlib import Path
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
