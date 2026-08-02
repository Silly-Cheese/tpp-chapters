# Phase 4 Release Notes

## Release goal

Turn activated Chapter Director and Chapter Adviser accounts into complete, useful private chapter workspaces.

## Definition of done

- [x] Role-aware Director and Adviser chapter portal
- [x] Automatic chapter selection for one or multiple memberships
- [x] Live authorization status and chapter standing
- [x] Renewal countdown and compliance progress
- [x] Full compliance requirement checklist
- [x] Approved leadership roster
- [x] Agreement and training status displays
- [x] Official document library with secure external links
- [x] Chapter notices with acknowledgments
- [x] Adviser-only oversight area
- [x] Confidential adviser check-in submission and history
- [x] Owner, Chapter Administrator, and Compliance Administrator setup workspace
- [x] One-click private workspace initialization from a public registry record
- [x] Standard requirement and welcome-notice creation
- [x] Leadership synchronization from active chapter memberships
- [x] Responsive desktop, tablet, and mobile layouts
- [x] Light and dark design compatibility
- [x] Firestore rules for chapter-scoped access and adviser confidentiality
- [x] Documentation and setup checklist

## Collections introduced

```text
chapters/{chapterId}
chapters/{chapterId}/requirements/{requirementId}
chapters/{chapterId}/leaders/{uid}
chapters/{chapterId}/documents/{documentId}
chapters/{chapterId}/notices/{noticeId}
chapters/{chapterId}/noticeReceipts/{noticeId}__{uid}
chapters/{chapterId}/adviserCheckins/{checkinId}
```

## Deployment requirement

Deploy the updated Firestore rules:

```bash
firebase deploy --only firestore:rules
```

No new composite Firestore index is required for Phase 4.
