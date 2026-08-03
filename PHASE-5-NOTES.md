# Phase 5 Release Notes

## Release goal

Make chapter reporting and operational requests fully usable from submission through administrative decision.

## Definition of done

- [x] Role-aware workflow catalog
- [x] Meeting reports
- [x] Quarterly and annual activity reports
- [x] Event proposals
- [x] Leadership change requests
- [x] Institution and chapter information changes
- [x] Temporary inactivity requests
- [x] Document submissions
- [x] Annual chapter renewals
- [x] Annual Adviser confirmations
- [x] Draft saving and continued editing
- [x] Submitted, under-review, changes-requested, approved, denied, and withdrawn states
- [x] PDF, Word, PNG, and JPEG attachments
- [x] Five-file and 10 MB-per-file limits
- [x] Chapter submission history and status filters
- [x] Administrative review queue
- [x] Review notes and correction requests
- [x] Renewal and Adviser-confirmation approval synchronization
- [x] Chapter-scoped Firestore access
- [x] Role-aware Cloud Storage access
- [x] Responsive desktop, tablet, and mobile layouts
- [x] Light and dark theme compatibility

## Collections introduced

```text
chapterSubmissions/{submissionId}
chapterSubmissions/{submissionId}/attachments/{attachmentId}
```

## Storage path introduced

```text
chapter-submissions/{chapterId}/{submissionId}/{uid}/{attachmentId}-{safeFileName}
```

## Deployment requirements

Deploy both Firestore and Storage Rules:

```bash
firebase deploy --only firestore:rules,storage
```

Phase 5 does not require a new composite Firestore index.
