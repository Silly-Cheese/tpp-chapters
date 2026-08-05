from pathlib import Path

OLD_BUILD = "20260803.12"
NEW_BUILD = "20260805.1"

root = Path(__file__).resolve().parents[1]
changed = []


def save(path: Path, text: str) -> None:
    before = path.read_text(encoding="utf-8") if path.exists() else ""
    if before != text:
        path.write_text(text, encoding="utf-8")
        changed.append(str(path.relative_to(root)))


# Load Phase 9 in production and force browsers to retrieve the new release.
index_path = root / "index.html"
index = index_path.read_text(encoding="utf-8").replace(OLD_BUILD, NEW_BUILD)
if "assets/phase9.css" not in index:
    index = index.replace(
        f'  <link rel="stylesheet" href="assets/support-center-fix.css?v={NEW_BUILD}">',
        f'  <link rel="stylesheet" href="assets/support-center-fix.css?v={NEW_BUILD}">\n'
        f'  <link rel="stylesheet" href="assets/phase9.css?v={NEW_BUILD}">'
    )
if "assets/js/phase9.js" not in index:
    index = index.replace(
        f'  <script type="module" src="assets/js/chapter-portal-mobile-members.js?v={NEW_BUILD}"></script>',
        f'  <script type="module" src="assets/js/chapter-portal-mobile-members.js?v={NEW_BUILD}"></script>\n'
        f'  <script type="module" src="assets/js/phase9.js?v={NEW_BUILD}"></script>'
    )
save(index_path, index)

# Keep the permanent build assertions aligned with this release.
for path in sorted((root / "scripts").glob("validate_*.py")):
    text = path.read_text(encoding="utf-8")
    if OLD_BUILD in text:
        save(path, text.replace(OLD_BUILD, NEW_BUILD))

rules_path = root / "firestore.rules"
rules = rules_path.read_text(encoding="utf-8")

helpers = r'''
    function canManageFormTemplates() {
      return isOwner();
    }

    function canReviewRequiredForms() {
      return hasRole(['owner', 'chapterAdmin', 'complianceAdmin']);
    }

    function formAssignment(assignmentId) {
      return get(/databases/$(database)/documents/formAssignments/$(assignmentId)).data;
    }

    function canAccessFormAssignmentData(data) {
      return canReviewRequiredForms()
        || (data.chapterId is string
          && hasChapterMembershipRole(data.chapterId, ['director', 'adviser']));
    }

    function canAccessFormAssignment(assignmentId) {
      return exists(/databases/$(database)/documents/formAssignments/$(assignmentId))
        && canAccessFormAssignmentData(formAssignment(assignmentId));
    }

    function formResponseStatusEditable(status) {
      return status in ['draft', 'awaiting_adviser', 'submitted', 'changes_requested'];
    }

    function formResponseBaseValid(assignmentId, data) {
      let assignment = formAssignment(assignmentId);
      return data.keys().hasAll([
          'assignmentId', 'campaignId', 'templateId', 'versionId', 'chapterId',
          'workflow', 'status', 'currentStep', 'returnRole',
          'directorAnswersJson', 'adviserAnswersJson',
          'directorCertificationName', 'directorCertificationTitle',
          'directorCertifiedAt', 'directorUid',
          'adviserCertificationName', 'adviserCertificationTitle',
          'adviserCertifiedAt', 'adviserUid', 'submittedAt',
          'reviewNote', 'reviewedByUid', 'reviewedByName', 'reviewedAt',
          'createdByUid', 'createdAt', 'updatedByUid', 'updatedAt'
        ])
        && data.keys().hasOnly([
          'assignmentId', 'campaignId', 'templateId', 'versionId', 'chapterId',
          'workflow', 'status', 'currentStep', 'returnRole',
          'directorAnswersJson', 'adviserAnswersJson',
          'directorCertificationName', 'directorCertificationTitle',
          'directorCertifiedAt', 'directorUid',
          'adviserCertificationName', 'adviserCertificationTitle',
          'adviserCertifiedAt', 'adviserUid', 'submittedAt',
          'reviewNote', 'reviewedByUid', 'reviewedByName', 'reviewedAt',
          'createdByUid', 'createdAt', 'updatedByUid', 'updatedAt'
        ])
        && data.assignmentId == assignmentId
        && data.campaignId == assignment.campaignId
        && data.templateId == assignment.templateId
        && data.versionId == assignment.versionId
        && data.chapterId == assignment.chapterId
        && data.workflow == assignment.workflow
        && data.status in [
          'draft', 'awaiting_adviser', 'submitted', 'changes_requested',
          'approved', 'denied', 'waived'
        ]
        && data.currentStep in ['director', 'adviser', 'review', 'complete']
        && data.returnRole in ['', 'director', 'adviser']
        && data.directorAnswersJson is string
        && data.directorAnswersJson.size() <= 200000
        && data.adviserAnswersJson is string
        && data.adviserAnswersJson.size() <= 200000
        && data.directorCertificationName is string
        && data.directorCertificationName.size() <= 100
        && data.directorCertificationTitle is string
        && data.directorCertificationTitle.size() <= 100
        && (data.directorCertifiedAt == null || data.directorCertifiedAt is timestamp)
        && data.directorUid is string
        && data.directorUid.size() <= 128
        && data.adviserCertificationName is string
        && data.adviserCertificationName.size() <= 100
        && data.adviserCertificationTitle is string
        && data.adviserCertificationTitle.size() <= 100
        && (data.adviserCertifiedAt == null || data.adviserCertifiedAt is timestamp)
        && data.adviserUid is string
        && data.adviserUid.size() <= 128
        && (data.submittedAt == null || data.submittedAt is timestamp)
        && data.reviewNote is string
        && data.reviewNote.size() <= 3000
        && data.reviewedByUid is string
        && data.reviewedByUid.size() <= 128
        && data.reviewedByName is string
        && data.reviewedByName.size() <= 100
        && (data.reviewedAt == null || data.reviewedAt is timestamp)
        && data.createdByUid is string
        && data.createdByUid.size() > 0
        && data.createdAt is timestamp
        && data.updatedByUid is string
        && data.updatedByUid.size() > 0
        && data.updatedAt is timestamp;
    }

    function validNewFormResponse(assignmentId) {
      let assignment = formAssignment(assignmentId);
      let role = chapterMembership(assignment.chapterId).role;
      return hasChapterMembershipRole(assignment.chapterId, ['director', 'adviser'])
        && assignment.status == 'assigned'
        && formResponseBaseValid(assignmentId, request.resource.data)
        && formResponseStatusEditable(request.resource.data.status)
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.updatedByUid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && request.resource.data.reviewedByUid == ''
        && request.resource.data.reviewedByName == ''
        && request.resource.data.reviewedAt == null
        && request.resource.data.reviewNote == ''
        && ((role == 'director'
              && assignment.workflow in ['single_director', 'director_then_adviser']
              && request.resource.data.adviserAnswersJson == '{}'
              && request.resource.data.adviserCertificationName == ''
              && request.resource.data.adviserCertificationTitle == ''
              && request.resource.data.adviserCertifiedAt == null
              && request.resource.data.adviserUid == '')
            || (role == 'adviser'
              && assignment.workflow == 'single_adviser'
              && request.resource.data.directorAnswersJson == '{}'
              && request.resource.data.directorCertificationName == ''
              && request.resource.data.directorCertificationTitle == ''
              && request.resource.data.directorCertifiedAt == null
              && request.resource.data.directorUid == ''));
    }

    function validFormResponseUpdate(assignmentId) {
      let assignment = formAssignment(assignmentId);
      let role = chapterMembership(assignment.chapterId).role;
      let commonKeys = [
        'status', 'currentStep', 'returnRole', 'submittedAt', 'reviewNote',
        'updatedByUid', 'updatedAt'
      ];
      return hasChapterMembershipRole(assignment.chapterId, ['director', 'adviser'])
        && !resource.data.status in ['approved', 'denied', 'waived']
        && role == resource.data.currentStep
        && formResponseBaseValid(assignmentId, request.resource.data)
        && formResponseStatusEditable(request.resource.data.status)
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.reviewedByUid == resource.data.reviewedByUid
        && request.resource.data.reviewedByName == resource.data.reviewedByName
        && request.resource.data.reviewedAt == resource.data.reviewedAt
        && request.resource.data.updatedByUid == request.auth.uid
        && request.resource.data.updatedAt == request.time
        && ((role == 'director'
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(
                commonKeys.concat([
                  'directorAnswersJson', 'directorCertificationName',
                  'directorCertificationTitle', 'directorCertifiedAt', 'directorUid'
                ]))
              && assignment.workflow in ['single_director', 'director_then_adviser'])
            || (role == 'adviser'
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(
                commonKeys.concat([
                  'adviserAnswersJson', 'adviserCertificationName',
                  'adviserCertificationTitle', 'adviserCertifiedAt', 'adviserUid'
                ]))
              && assignment.workflow in ['single_adviser', 'director_then_adviser']));
    }

    function validFormHistoryEvent(assignmentId) {
      let assignment = formAssignment(assignmentId);
      return canAccessFormAssignment(assignmentId)
        && request.resource.data.keys().hasAll([
          'assignmentId', 'chapterId', 'eventType', 'actorUid',
          'actorName', 'actorRole', 'note', 'createdAt'
        ])
        && request.resource.data.keys().hasOnly([
          'assignmentId', 'chapterId', 'eventType', 'actorUid',
          'actorName', 'actorRole', 'note', 'createdAt'
        ])
        && request.resource.data.assignmentId == assignmentId
        && request.resource.data.chapterId == assignment.chapterId
        && request.resource.data.eventType in [
          'director_submitted', 'response_submitted', 'approved',
          'changes_requested', 'denied', 'waived'
        ]
        && request.resource.data.actorUid == request.auth.uid
        && request.resource.data.actorName is string
        && request.resource.data.actorName.size() >= 2
        && request.resource.data.actorName.size() <= 100
        && request.resource.data.actorRole is string
        && request.resource.data.actorRole.size() <= 40
        && request.resource.data.note is string
        && request.resource.data.note.size() <= 3000
        && request.resource.data.createdAt == request.time;
    }

    function validFormAttachment(assignmentId) {
      let assignment = formAssignment(assignmentId);
      return canAccessFormAssignment(assignmentId)
        && request.resource.data.keys().hasAll([
          'assignmentId', 'chapterId', 'responseId', 'fieldId',
          'uploadedByUid', 'uploadedByRole', 'attachmentId', 'fileName',
          'contentType', 'size', 'chunkCount', 'storageMode', 'uploadedAt'
        ])
        && request.resource.data.keys().hasOnly([
          'assignmentId', 'chapterId', 'responseId', 'fieldId',
          'uploadedByUid', 'uploadedByRole', 'attachmentId', 'fileName',
          'contentType', 'size', 'chunkCount', 'storageMode', 'uploadedAt'
        ])
        && request.resource.data.assignmentId == assignmentId
        && request.resource.data.chapterId == assignment.chapterId
        && request.resource.data.responseId == 'current'
        && request.resource.data.uploadedByUid == request.auth.uid
        && request.resource.data.uploadedByRole is string
        && request.resource.data.uploadedByRole.size() <= 40
        && request.resource.data.attachmentId is string
        && request.resource.data.attachmentId.size() > 0
        && request.resource.data.fileName is string
        && request.resource.data.fileName.size() >= 1
        && request.resource.data.fileName.size() <= 240
        && request.resource.data.contentType in [
          'application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/png', 'image/jpeg'
        ]
        && request.resource.data.size is int
        && request.resource.data.size > 0
        && request.resource.data.size <= 2097152
        && request.resource.data.chunkCount is int
        && request.resource.data.chunkCount >= 1
        && request.resource.data.chunkCount <= 8
        && request.resource.data.storageMode == 'firestore_chunks'
        && request.resource.data.uploadedAt == request.time;
    }

    function formAttachmentAfter(assignmentId, attachmentId) {
      return getAfter(/databases/$(database)/documents/formAssignments/$(assignmentId)/responses/current/attachments/$(attachmentId)).data;
    }

    function validFormAttachmentChunk(assignmentId, attachmentId) {
      let attachment = formAttachmentAfter(assignmentId, attachmentId);
      return canAccessFormAssignment(assignmentId)
        && attachment.uploadedByUid == request.auth.uid
        && request.resource.data.keys().hasAll([
          'attachmentId', 'index', 'data', 'createdAt'
        ])
        && request.resource.data.keys().hasOnly([
          'attachmentId', 'index', 'data', 'createdAt'
        ])
        && request.resource.data.attachmentId == attachmentId
        && request.resource.data.index is int
        && request.resource.data.index >= 0
        && request.resource.data.index < 8
        && request.resource.data.data is string
        && request.resource.data.data.size() > 0
        && request.resource.data.data.size() <= 500000
        && request.resource.data.createdAt == request.time;
    }
'''

if "function canManageFormTemplates()" not in rules:
    marker = "    match /systemUsers/{uid} {"
    if marker not in rules:
        raise SystemExit("Could not locate Firestore helper insertion point")
    rules = rules.replace(marker, helpers + "\n" + marker, 1)

matches = r'''
    match /formTemplates/{templateId} {
      allow read: if isActive();
      allow create, update, delete: if canManageFormTemplates();

      match /versions/{versionId} {
        allow read: if isActive();
        allow create: if canManageFormTemplates()
          && request.resource.data.templateId == templateId
          && request.resource.data.versionId == versionId
          && request.resource.data.locked == true
          && request.resource.data.schemaJson is string
          && request.resource.data.schemaJson.size() > 2
          && request.resource.data.schemaJson.size() <= 700000
          && request.resource.data.publishedByUid == request.auth.uid
          && request.resource.data.publishedAt == request.time;
        allow update, delete: if false;
      }
    }

    match /formCampaigns/{campaignId} {
      allow read: if canReviewRequiredForms();
      allow create, update, delete: if isOwner();
    }

    match /formAssignments/{assignmentId} {
      allow read: if canAccessFormAssignmentData(resource.data);
      allow create: if isOwner()
        && request.resource.data.assignmentId == assignmentId
        && validChapterId(request.resource.data.chapterId)
        && request.resource.data.status == 'assigned'
        && request.resource.data.workflow in [
          'single_director', 'single_adviser', 'director_then_adviser'
        ]
        && request.resource.data.schemaJson is string
        && request.resource.data.schemaJson.size() > 2
        && request.resource.data.schemaJson.size() <= 700000
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;
      allow update: if canReviewRequiredForms();
      allow delete: if isOwner();

      match /responses/{responseId} {
        allow read: if canAccessFormAssignment(assignmentId);
        allow create: if responseId == 'current'
          && (validNewFormResponse(assignmentId) || canReviewRequiredForms());
        allow update: if responseId == 'current'
          && (validFormResponseUpdate(assignmentId) || canReviewRequiredForms());
        allow delete: if isOwner();

        match /history/{historyId} {
          allow read: if canAccessFormAssignment(assignmentId);
          allow create: if validFormHistoryEvent(assignmentId);
          allow update, delete: if false;
        }

        match /attachments/{attachmentId} {
          allow read: if canAccessFormAssignment(assignmentId);
          allow create: if validFormAttachment(assignmentId);
          allow update: if false;
          allow delete: if canReviewRequiredForms()
            || (hasChapterMembershipRole(formAssignment(assignmentId).chapterId, ['director', 'adviser'])
              && resource.data.uploadedByUid == request.auth.uid);

          match /chunks/{chunkId} {
            allow read: if canAccessFormAssignment(assignmentId);
            allow create: if validFormAttachmentChunk(assignmentId, attachmentId);
            allow update: if false;
            allow delete: if canReviewRequiredForms()
              || hasChapterMembershipRole(formAssignment(assignmentId).chapterId, ['director', 'adviser']);
          }
        }
      }
    }
'''

if "match /formTemplates/{templateId}" not in rules:
    marker = "    match /supportTickets/{ticketId} {"
    if marker not in rules:
        raise SystemExit("Could not locate Firestore match insertion point")
    rules = rules.replace(marker, matches + "\n" + marker, 1)

save(rules_path, rules)

print("Phase 9 migration updated:")
for item in changed:
    print(f"- {item}")
