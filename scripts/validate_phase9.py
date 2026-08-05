from pathlib import Path
import sys

errors = []

index = Path("index.html").read_text(encoding="utf-8")
phase9 = Path("assets/js/phase9.js").read_text(encoding="utf-8")
css = Path("assets/phase9.css").read_text(encoding="utf-8")
rules = Path("firestore.rules").read_text(encoding="utf-8")

for marker in (
    'content="20260805.1"',
    'assets/phase9.css?v=20260805.1',
    'assets/js/phase9.js?v=20260805.1',
):
    if marker not in index:
        errors.append(f"Production entry point is missing Phase 9 marker: {marker}")

for marker in (
    '"/admin/forms"',
    '"/admin/forms/template"',
    '"/admin/forms/assign"',
    '"/admin/forms/responses"',
    '"/admin/forms/review"',
    '"/admin/memberships"',
    '"/admin/registry"',
    '"/admin/audit"',
    '"/chapter/forms"',
    '"/chapter/forms/fill"',
    '"/chapter/forms/view"',
    '"/chapter/members"',
    '"/chapter/documents"',
    '"/chapter/notices"',
    'FORM-INSTITUTIONAL-APPROVAL',
    'FORM-ADVISER-AGREEMENT',
    'FORM-DIRECTOR-AGREEMENT',
    'FORM-ANNUAL-RENEWAL',
    'saveTemplate({ publish: true })',
    'director_then_adviser',
    'Authenticated certification',
    'saveFirestoreAttachment',
    'complianceRequirementId',
    'required_form_campaign_created',
    'if (document.querySelector("[data-phase9-root]")) return;',
    'validateRequiredAnswers(role, answers, form)',
    'Attach the required file:',
    'The chapter must formally submit this response before an administrative decision can be recorded.',
    'const selectedFileCount =',
    'if (submit && selectedFileCount)',
    'const stagingData =',
    'const finalBatch = writeBatch(db);',
):
    if marker not in phase9:
        errors.append(f"Phase 9 application is missing: {marker}")

for marker in (
    '.p9-builder-section',
    '.p9-chapter-form-card',
    '.p9-certification',
    '.p9-record-section',
    '@media print',
    '.p9-chapter-scrim',
):
    if marker not in css:
        errors.append(f"Phase 9 stylesheet is missing: {marker}")

for marker in (
    'function canManageFormTemplates()',
    'function canReviewRequiredForms()',
    'function validNewFormResponse(assignmentId)',
    'function validFormResponseUpdate(assignmentId)',
    'function validFormAttachment(assignmentId)',
    'match /formTemplates/{templateId}',
    'match /formCampaigns/{campaignId}',
    'match /formAssignments/{assignmentId}',
    'match /responses/{responseId}',
    'match /history/{historyId}',
    'match /attachments/{attachmentId}',
    'match /chunks/{chunkId}',
    "request.resource.data.actorRole in [\n                'owner', 'chapterAdmin', 'complianceAdmin'",
    'request.resource.data.actorRole == chapterMembership(assignment.chapterId).role',
):
    if marker not in rules:
        errors.append(f"Firestore Rules are missing Phase 9 marker: {marker}")

if 'allow update, delete: if false;' not in rules:
    errors.append("Published form versions are not explicitly immutable")
if 'schemaJson.size() <= 700000' not in rules:
    errors.append("Form schema size is not bounded")
if 'request.resource.data.size <= 2097152' not in rules:
    errors.append("Form attachments are not limited to 2 MB")
if 'firestore.indexes.json' not in Path("firebase.json").read_text(encoding="utf-8"):
    errors.append("Firestore index configuration is missing")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("Phase 9 required forms validation passed.")
