# Phase 9 — Required Forms, Agreements, and Compliance Assignments

Phase 9 adds a complete native form system to The Prayer Project Chapter Portal. Forms are created, assigned, completed, certified, reviewed, and archived inside the portal. No Cloud Functions, Firebase Storage, email service, or composite Firestore index is required.

## Owner routes

- `/#/admin/forms` — template library and assignment overview
- `/#/admin/forms/template` — no-code form builder
- `/#/admin/forms/assign` — create chapter-specific assignments
- `/#/admin/forms/responses` — review queue
- `/#/admin/forms/review?id=...` — response and certification review

Only the Owner may create templates, publish versions, install the starter library, and send assignments. The Owner, Chapter Administrator, and Compliance Administrator may review responses.

## Chapter routes

- `/#/chapter/forms` — assigned forms and status
- `/#/chapter/forms/fill?id=...` — draft and submit
- `/#/chapter/forms/view?id=...` — read-only record and printing

Active Chapter Directors and Chapter Advisers may access form assignments for their chapter. The workflow determines who completes each step.

## Built-in starter library

The Owner can install four published templates from the Forms & Agreements dashboard:

1. Institutional Approval Form
2. Chapter Adviser Agreement
3. Chapter Director Agreement
4. Annual Chapter Renewal

Installing the library is idempotent. Existing starter templates are not overwritten.

## Builder field types

- Short text
- Long text
- Email address
- Phone number
- Date
- Number
- Dropdown
- Multiple choice
- Checkbox list
- Yes/no
- Required acknowledgment
- Supporting file

Every field may include help text, required status, length limits, answer choices, and a completion role. The Director-then-Adviser workflow supports separate role-specific sections.

## Published version integrity

Published form versions are immutable. Editing a published form creates a new version while prior assignments retain their original title, instructions, schema, workflow, and version number.

Each assignment contains a snapshot of its published version. A later template edit cannot change language that a chapter previously certified.

## Assignment workflow

The Owner selects a published form, available date, due date, recipient scope, instructions, and compliance status. Recipient scope may be all active chapters or selected Permanent Chapter IDs.

Supported workflows:

- Director only
- Adviser only
- Director, then Adviser

Each chapter receives a separate `formAssignments` record. Required assignments also create a linked item in `chapters/{chapterId}/requirements`.

## Response lifecycle

- Assigned
- Draft
- Awaiting Adviser
- Submitted
- Under review
- Changes requested
- Approved
- Denied
- Waived
- Expired
- Superseded

Draft answers remain editable. Submission records the authenticated UID, account role, typed name, official title, form version, chapter, and timestamp.

## Administrative review

Authorized reviewers can:

- Approve
- Request changes and return the form to the Director or Adviser
- Deny
- Waive the requirement

Approval marks the linked compliance requirement complete. A waiver marks it not required. Changes requested or denial mark it action required. Every decision creates a response-history event and an append-only audit-log entry.

## Attachments

Phase 9 uses the private Firestore chunk engine introduced in build `20260803.12`.

- PDF, DOC, DOCX, PNG, JPG, and JPEG
- Maximum 2 MB per file
- Maximum five attachments per response
- No Firebase Storage bucket
- No public download URL

## Firestore collections

```text
formTemplates/{templateId}
formTemplates/{templateId}/versions/{versionId}
formCampaigns/{campaignId}
formAssignments/{assignmentId}
formAssignments/{assignmentId}/responses/current
formAssignments/{assignmentId}/responses/current/history/{historyId}
formAssignments/{assignmentId}/responses/current/attachments/{attachmentId}
formAssignments/{assignmentId}/responses/current/attachments/{attachmentId}/chunks/{chunkId}
```

## Required deployment

After Phase 9 is merged:

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules
```

Do not deploy Storage or composite indexes.

## Production test matrix

Use separate accounts and verify:

1. Owner installs the starter library.
2. Owner creates and publishes a custom form.
3. Published Version 1 cannot be edited.
4. Owner publishes Version 2 without changing a Version 1 assignment.
5. Owner assigns a Director-only form to one chapter.
6. Director saves a draft and returns later.
7. Director submits with typed certification.
8. Owner requests changes and returns it to the Director.
9. Director resubmits.
10. Owner approves and the compliance item becomes complete.
11. Owner assigns Annual Renewal using Director-then-Adviser.
12. Adviser can read the Director section but cannot alter it.
13. Adviser certifies and submits for review.
14. Chapter User accounts cannot access required forms.
15. A Director from another chapter cannot read the assignment.
16. Attachments upload, download, and remove before final approval.
17. Completed responses print without portal navigation.
18. No form route requests Firebase Storage.


## Returned forms and administrative removal

When changes are requested, single-role forms automatically return to their only valid role. Director-then-Adviser forms return only to a role that participates in that workflow. Existing returned forms with an incorrect legacy step are normalized so the intended Director or Adviser can edit and resubmit them.

The Owner may remove an assignment from a chapter from the Forms & Agreements administration pages. Removal uses the `withdrawn` assignment state rather than deleting Firestore records. The assignment disappears from the chapter portal, its linked compliance requirement becomes not required, and prior responses, certifications, attachments, and history remain available to administrators for audit purposes.
