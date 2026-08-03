# Chapter Portal Data Model

Phase 4 separates the public registry from the private operational workspace.

## Private chapter record

```text
chapters/{chapterId}
```

The document ID must equal the permanent Chapter ID.

Recommended fields:

```javascript
{
  chapterId: "TPP-CH-A1B2C3",
  officialName: "The Prayer Project at Example School",
  hostInstitutionName: "Example School",
  institutionType: "school",
  city: "Example City",
  state: "Arkansas",
  country: "United States",
  serviceArea: "Example School community",

  authorizationStatus: "active",
  standing: "good_standing",
  standingMessage: "All current requirements are satisfied.",

  approvalDate: Timestamp,
  effectiveDate: Timestamp,
  renewalDate: Timestamp,
  lastReviewDate: Timestamp,

  institutionalApprovalStatus: "confirmed",
  adviserConfirmationStatus: "due",
  adviserConfirmationDueDate: Timestamp,

  portalSummary: "Official private chapter operations workspace.",
  meetingSchedule: "First Tuesday of each month",
  primaryContactEmail: "chapter@example.org",

  createdAt: Timestamp,
  createdByUid: "firebase-uid",
  updatedAt: Timestamp,
  updatedByUid: "firebase-uid"
}
```

## Requirements

```text
chapters/{chapterId}/requirements/{requirementId}
```

Statuses:

```text
complete
due
overdue
under_review
not_required
```

The portal derives `overdue` when a due item has passed its `dueDate`.

## Leadership

```text
chapters/{chapterId}/leaders/{firebaseUid}
```

Leader records display the approved role, active status, agreement status, training status, and start date. Activated users may create only their own initial record. Administrators control subsequent updates.

## Documents

```text
chapters/{chapterId}/documents/{documentId}
```

Phase 4 uses HTTPS document links. Secure Firebase Storage uploads are expanded in Phase 5.

## Notices and receipts

```text
chapters/{chapterId}/notices/{noticeId}
chapters/{chapterId}/noticeReceipts/{noticeId}__{firebaseUid}
```

A receipt can be created only by the signed-in chapter member named in the receipt and only when the notice requires acknowledgment.

## Adviser check-ins

```text
chapters/{chapterId}/adviserCheckins/{checkinId}
```

Check-ins are private to the submitting Adviser and authorized Owner, Chapter Administrator, or Compliance Administrator accounts. Directors cannot read them.
