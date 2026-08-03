from pathlib import Path
import sys

errors = []
index = Path("index.html").read_text(encoding="utf-8")
portal = Path("assets/js/chapter-portal-v2.js").read_text(encoding="utf-8")
guard = Path("assets/js/portal-permission-guard.js").read_text(encoding="utf-8")
css = Path("assets/chapter-portal-v2.css").read_text(encoding="utf-8")

required_portal = [
    "data-chapter-portal-v2",
    "async function loadMemberships()",
    "async function loadWorkspace()",
    'href="#/chapter/workflows"',
    'href="#/chapter/submissions"',
    'href="#/chapter/communications"',
    'href="#/chapter/support"',
    "Portal rules need to be synchronized.",
    "Some optional information is temporarily unavailable.",
]
for marker in required_portal:
    if marker not in portal:
        errors.append(f"Unified chapter portal is missing: {marker}")

for marker in ("unhandledrejection", "stopImmediatePropagation", "tpp:background-permission-error"):
    if marker not in guard:
        errors.append(f"Permission guard is missing: {marker}")

for marker in (".cp2-shell", ".cp2-actions", ".cp2-gate", "[data-theme=\"dark\"]"):
    if marker not in css:
        errors.append(f"Unified chapter portal stylesheet is missing: {marker}")

if 'content="20260803.8"' not in index:
    errors.append("Production build is not 20260803.8")
for asset in (
    "assets/chapter-portal-v2.css?v=20260803.8",
    "assets/js/portal-permission-guard.js?v=20260803.8",
    "assets/js/chapter-portal-v2.js?v=20260803.8",
):
    if asset not in index:
        errors.append(f"Production entry point is missing: {asset}")

if index.index("portal-permission-guard.js") > index.index("phase4.js"):
    errors.append("Permission guard must load before Phase 4–6 modules")
if index.index("chapter-portal-v2.js") < index.index("phase8.js"):
    errors.append("Unified chapter portal must load after the legacy modules")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Unified chapter portal validation passed.")
