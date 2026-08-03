# Phase 5 Submission Workflow Data Model

## `chapterSubmissions/{submissionId}`

Every report, request, renewal, and confirmation uses one normalized record.

### Identity and routing

| Field | Purpose |
|---|---|
| `chapterId` | Permanent chapter identifier |
| `chapterName` | Chapter name at submission time |
| `type` | Workflow type |
| `title` | Human-readable title |
| `submittedByUid` | Firebase UID of the creator |
| `submittedByName` | Creator display name |
| `submittedByRole` | Director or Adviser role at creation |

### Workflow types

```text
meeting_report
periodic_report
event_proposal
leadership_change
institution_change
inactivity_request
document_submission
annual_renewal
adviser_confirmation
```

`annual_renewal` is limited to Chapter Directors. `adviser_confirmation` is limited to Chapter Advisers. The remaining workflows are available to both roles.

### Status lifecycle

```text
draft
submitted
under_review
changes_requested
approved
denied
withdrawn
```

A chapter leader may edit only their own `draft` or `changes_requested` submission. Administrative review fields cannot be edited by chapter users.

### Normalized workflow fields

The record contains a fixed set of text, number, date-string, and confirmation fields. Unused fields remain empty, zero, or false. This keeps Firestore Rules strict while supporting multiple workflow forms.

### Review fields

| Field | Purpose |
|---|---|
| `reviewNote` | Administrative feedback or decision explanation |
| `reviewedByUid` | Reviewing administrator UID |
| `reviewedByName` | Reviewing administrator name |
| `reviewedAt` | Most recent formal review action |

## Attachment metadata

```text
chapterSubmissions/{submissionId}/attachments/{attachmentId}
```

Each metadata record contains:

```text
chapterId
submissionId
storagePath
downloadUrl
fileName
contentType
size
uploadedByUid
uploadedAt
```

Files are accepted only while the parent submission is `draft` or `changes_requested`.

## Privacy and access

- Active chapter members may read submissions for their assigned chapter.
- A creator may edit only their own editable submissions.
- Owner, Chapter Administrator, and Compliance Administrator accounts may review and decide submissions.
- Support Agents may read operational records but cannot issue decisions.
- Attachments use matching chapter and submission checks in Cloud Storage Rules.
