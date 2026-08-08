from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
phase9 = (root / "assets/js/phase9.js").read_text(encoding="utf-8")
rules = (root / "firestore.rules").read_text(encoding="utf-8")
index = (root / "index.html").read_text(encoding="utf-8")
errors = []

for marker in (
    'const BUILD = "20260807.1";',
    'withdrawn: "Removed by administration"',
    'if (item?.status === "withdrawn") return "withdrawn";',
    'assignment.workflow === "single_adviser"',
    'records.filter((item) => item.status !== "withdrawn")',
    'data-p9-action="unassign-form"',
    'async function withdrawAssignment(id)',
    'action: "required_form_withdrawn"',
    'status: "withdrawn"',
    'The response history will be preserved.',
    'const allowedReturnRoles = workflowRoles(assignment.workflow);',
    'const validReturnRoles = workflowRoles(assignment.workflow);',
):
    if marker not in phase9:
        errors.append(f"Phase 9 client is missing marker: {marker}")

for marker in (
    "resource.data.status == 'changes_requested'",
    "assignment.workflow == 'single_adviser' && role == 'adviser'",
    "assignment.workflow == 'single_director' && role == 'director'",
    "resource.data.status != 'withdrawn'",
    "request.resource.data.status != 'withdrawn'",
):
    if marker not in rules:
        errors.append(f"Firestore Rules are missing marker: {marker}")

if 'content="20260807.1"' not in index or 'assets/js/phase9.js?v=20260807.1' not in index:
    errors.append("Production assets were not cache-busted to 20260807.1")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Phase 9 returned-form and unassign validation passed.")
