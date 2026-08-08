from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD_BUILD = "20260805.1"
NEW_BUILD = "20260807.1"

phase9_path = ROOT / "assets/js/phase9.js"
rules_path = ROOT / "firestore.rules"
index_path = ROOT / "index.html"
docs_path = ROOT / "docs/PHASE-9-REQUIRED-FORMS.md"

phase9 = phase9_path.read_text(encoding="utf-8")

phase9 = phase9.replace(
    'const TERMINAL_STATUSES = new Set(["approved", "denied", "waived", "expired", "superseded"]);',
    'const TERMINAL_STATUSES = new Set(["approved", "denied", "waived", "expired", "superseded", "withdrawn"]);'
)
phase9 = phase9.replace(
    '  superseded: "Superseded"\n};',
    '  superseded: "Superseded",\n  withdrawn: "Removed by administration"\n};'
)
phase9 = phase9.replace(
    '''function assignmentStatus(item, response = state.responses.get(item.id)) {\n  const status = response?.status || item.status || "assigned";''',
    '''function assignmentStatus(item, response = state.responses.get(item.id)) {\n  if (item?.status === "withdrawn") return "withdrawn";\n  const status = response?.status || item.status || "assigned";'''
)
phase9 = phase9.replace(
    '''function activeRoleForResponse(assignment, response) {\n  return response?.currentStep || initialStep(assignment.workflow);\n}\n\nfunction canCurrentUserEdit(assignment, response) {\n  if (!assignment || !CHAPTER_ROLES.has(selectedMembership()?.role)) return false;\n  if (TERMINAL_STATUSES.has(response?.status || assignment.status)) return false;''',
    '''function activeRoleForResponse(assignment, response) {\n  if (response?.status === "changes_requested") {\n    if (assignment.workflow === "single_director") return "director";\n    if (assignment.workflow === "single_adviser") return "adviser";\n    if (["director", "adviser"].includes(response.returnRole)) return response.returnRole;\n  }\n  return response?.currentStep || initialStep(assignment.workflow);\n}\n\nfunction canCurrentUserEdit(assignment, response) {\n  if (!assignment || !CHAPTER_ROLES.has(selectedMembership()?.role)) return false;\n  if (TERMINAL_STATUSES.has(assignment.status) || TERMINAL_STATUSES.has(response?.status)) return false;'''
)
phase9 = phase9.replace(
    '''  state.assignments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))\n    .sort((a, b) => (toDate(a.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER) - (toDate(b.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER));''',
    '''  const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));\n  state.assignments = (admin ? records : records.filter((item) => item.status !== "withdrawn"))\n    .sort((a, b) => (toDate(a.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER) - (toDate(b.dueAt)?.getTime() || Number.MAX_SAFE_INTEGER));'''
)
phase9 = phase9.replace(
    '''  state.currentAssignment = { id: assignmentSnapshot.id, ...assignmentSnapshot.data() };\n  const responseRef = doc(db, "formAssignments", id, "responses", "current");''',
    '''  state.currentAssignment = { id: assignmentSnapshot.id, ...assignmentSnapshot.data() };\n  if (!isAdmin() && state.currentAssignment.status === "withdrawn") {\n    throw new Error("This form assignment was removed by administration and is no longer active.");\n  }\n  const responseRef = doc(db, "formAssignments", id, "responses", "current");'''
)

old_row = '''function adminAssignmentRow(item) {\n  const status = assignmentStatus(item);\n  return `<article><div><strong>${esc(item.title)}</strong><span>${esc(item.chapterName || item.chapterId)} · Due ${esc(fmt(item.dueAt))}</span></div>${badge(status)}<a class="btn btn-secondary btn-small" href="#/admin/forms/review?id=${encodeURIComponent(item.id)}">Review</a></article>`;\n}'''
new_row = '''function adminAssignmentRow(item) {\n  const status = assignmentStatus(item);\n  const removeAction = isOwner() && item.status !== "withdrawn"\n    ? `<button class="btn btn-secondary btn-small" type="button" data-p9-action="unassign-form" data-id="${esc(item.id)}">Remove assignment</button>`\n    : "";\n  return `<article><div><strong>${esc(item.title)}</strong><span>${esc(item.chapterName || item.chapterId)} · Due ${esc(fmt(item.dueAt))}</span></div>${badge(status)}<a class="btn btn-secondary btn-small" href="#/admin/forms/review?id=${encodeURIComponent(item.id)}">Review</a>${removeAction}</article>`;\n}'''
if old_row not in phase9:
    raise SystemExit("adminAssignmentRow marker not found")
phase9 = phase9.replace(old_row, new_row, 1)

phase9 = phase9.replace(
    '<option value="denied" ${filter === "denied" ? "selected" : ""}>Denied</option><option value="all"',
    '<option value="denied" ${filter === "denied" ? "selected" : ""}>Denied</option><option value="withdrawn" ${filter === "withdrawn" ? "selected" : ""}>Removed</option><option value="all"'
)

old_review_start = '''function reviewPage() {\n  const assignment = state.currentAssignment;\n  const response = state.currentResponse;\n  if (!assignment) return adminLayout(empty("Assignment unavailable.", "The requested form assignment could not be found."), "Review Response");\n  const status = assignmentStatus(assignment, response);\n  return adminLayout(`'''
new_review_start = '''function reviewPage() {\n  const assignment = state.currentAssignment;\n  const response = state.currentResponse;\n  if (!assignment) return adminLayout(empty("Assignment unavailable.", "The requested form assignment could not be found."), "Review Response");\n  const status = assignmentStatus(assignment, response);\n  const allowedReturnRoles = workflowRoles(assignment.workflow);\n  const returnRoleOptions = allowedReturnRoles.map((role) => `<option value="${esc(role)}">${esc(roleLabel(role))}</option>`).join("");\n  return adminLayout(`'''
if old_review_start not in phase9:
    raise SystemExit("reviewPage start marker not found")
phase9 = phase9.replace(old_review_start, new_review_start, 1)
phase9 = phase9.replace(
    '<label>Return changes to<select name="returnRole"><option value="director">Chapter Director</option><option value="adviser">Chapter Adviser</option></select></label>',
    '<label>Return changes to<select name="returnRole">${returnRoleOptions}</select></label>'
)

old_review_response = '''async function reviewResponse(status) {\n  if (!isAdmin() || !state.currentAssignment) return;\n  const form = document.querySelector("#p9-review-form");\n  const note = form?.reviewNote.value.trim() || "";\n  const returnRole = form?.returnRole.value || "director";'''
new_review_response = '''async function reviewResponse(status) {\n  if (!isAdmin() || !state.currentAssignment) return;\n  const form = document.querySelector("#p9-review-form");\n  const note = form?.reviewNote.value.trim() || "";\n  const assignment = state.currentAssignment;\n  const validReturnRoles = workflowRoles(assignment.workflow);\n  const requestedReturnRole = form?.returnRole.value || validReturnRoles[0];\n  const returnRole = validReturnRoles.includes(requestedReturnRole) ? requestedReturnRole : validReturnRoles[0];'''
if old_review_response not in phase9:
    raise SystemExit("reviewResponse marker not found")
phase9 = phase9.replace(old_review_response, new_review_response, 1)
phase9 = phase9.replace(
    '  const assignment = state.currentAssignment;\n  const assignmentRef = doc(db, "formAssignments", assignment.id);',
    '  const assignmentRef = doc(db, "formAssignments", assignment.id);',
    1
)

insert_before_download = '''\nasync function withdrawAssignment(id) {\n  if (!isOwner()) return;\n  const assignment = state.assignments.find((item) => item.id === id) || (state.currentAssignment?.id === id ? state.currentAssignment : null);\n  if (!assignment || assignment.status === "withdrawn") return;\n  const reason = prompt(`Why are you removing ${assignment.title} from ${assignment.chapterName || assignment.chapterId}?`);\n  if (reason == null) return;\n  const cleanReason = reason.trim();\n  if (cleanReason.length < 10) throw new Error("Provide a removal reason of at least ten characters.");\n  if (!confirm(`Remove this assignment from ${assignment.chapterName || assignment.chapterId}'s portal? The response history will be preserved.`)) return;\n\n  const batch = writeBatch(db);\n  batch.update(doc(db, "formAssignments", assignment.id), {\n    status: "withdrawn",\n    withdrawalReason: cleanReason,\n    withdrawnAt: serverTimestamp(),\n    withdrawnByUid: state.user.uid,\n    withdrawnByName: state.profile?.displayName || state.user.email,\n    updatedAt: serverTimestamp()\n  });\n  if (assignment.complianceRequirementId) {\n    batch.update(doc(db, "chapters", assignment.chapterId, "requirements", assignment.complianceRequirementId), {\n      status: "not_required",\n      administrativeNote: `Required form removed by administration: ${cleanReason}`,\n      reviewedAt: serverTimestamp(),\n      updatedAt: serverTimestamp()\n    });\n  }\n  batch.set(doc(collection(db, "auditLogs")), {\n    actorUid: state.user.uid,\n    action: "required_form_withdrawn",\n    targetType: "formAssignment",\n    targetId: assignment.id,\n    summary: `Removed ${assignment.title} from ${assignment.chapterId}. ${cleanReason}`,\n    createdAt: serverTimestamp()\n  });\n  await batch.commit();\n  await loadAssignments({ admin: true });\n  toast("Assignment removed", "It no longer appears in the chapter portal. Historical responses remain available to administrators.");\n  if (route() === "/admin/forms/review") setTimeout(() => go("/admin/forms/responses?status=all"), 700);\n  else render(false);\n}\n'''
needle = '\nasync function downloadAttachment(id) {'
if needle not in phase9:
    raise SystemExit("downloadAttachment marker not found")
phase9 = phase9.replace(needle, insert_before_download + needle, 1)

phase9 = phase9.replace(
    '  document.querySelectorAll("[data-p9-review]").forEach((button) => button.addEventListener("click", () => reviewResponse(button.dataset.p9Review).catch((error) => setAlert("p9-review-alert", "danger", "Review not saved", error.message))));',
    '  document.querySelectorAll("[data-p9-review]").forEach((button) => button.addEventListener("click", () => reviewResponse(button.dataset.p9Review).catch((error) => setAlert("p9-review-alert", "danger", "Review not saved", error.message))));\n  document.querySelectorAll(\'[data-p9-action="unassign-form"]\').forEach((button) => button.addEventListener("click", () => withdrawAssignment(button.dataset.id).catch((error) => toast("Assignment not removed", error.message, "danger"))));'
)
phase9 = phase9.replace('const BUILD = "20260805.1";', f'const BUILD = "{NEW_BUILD}";')
phase9_path.write_text(phase9, encoding="utf-8")

rules = rules_path.read_text(encoding="utf-8")
rules = rules.replace(
    '''        && role == resource.data.currentStep\n        && formResponseBaseValid(assignmentId, request.resource.data)''',
    '''        && (role == resource.data.currentStep\n          || (resource.data.status == 'changes_requested'\n            && ((assignment.workflow == 'single_director' && role == 'director')\n              || (assignment.workflow == 'single_adviser' && role == 'adviser')\n              || (assignment.workflow == 'director_then_adviser'\n                && (resource.data.returnRole == role || resource.data.currentStep == role)))))\n        && formResponseBaseValid(assignmentId, request.resource.data)''',
    1
)
rules = rules.replace(
    '      allow update: if canReviewRequiredForms();\n      allow delete: if isOwner();\n\n      match /responses/{responseId} {',
    '''      allow update: if canReviewRequiredForms()\n        && (isOwner()\n          || (resource.data.status != 'withdrawn'\n            && request.resource.data.status != 'withdrawn'));\n      allow delete: if isOwner();\n\n      match /responses/{responseId} {''',
    1
)
rules_path.write_text(rules, encoding="utf-8")

index = index_path.read_text(encoding="utf-8").replace(OLD_BUILD, NEW_BUILD)
index_path.write_text(index, encoding="utf-8")

for validator in (ROOT / "scripts").glob("validate_*.py"):
    text = validator.read_text(encoding="utf-8")
    if OLD_BUILD in text:
        validator.write_text(text.replace(OLD_BUILD, NEW_BUILD), encoding="utf-8")

docs = docs_path.read_text(encoding="utf-8")
appendix = '''\n\n## Returned forms and administrative removal\n\nWhen changes are requested, single-role forms automatically return to their only valid role. Director-then-Adviser forms return only to a role that participates in that workflow. Existing returned forms with an incorrect legacy step are normalized so the intended Director or Adviser can edit and resubmit them.\n\nThe Owner may remove an assignment from a chapter from the Forms & Agreements administration pages. Removal uses the `withdrawn` assignment state rather than deleting Firestore records. The assignment disappears from the chapter portal, its linked compliance requirement becomes not required, and prior responses, certifications, attachments, and history remain available to administrators for audit purposes.\n'''
if "## Returned forms and administrative removal" not in docs:
    docs += appendix
docs_path.write_text(docs, encoding="utf-8")

print("Phase 9 returned-form and unassign migration applied.")
