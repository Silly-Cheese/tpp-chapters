# Phase 2 Release Notes

## Release goal

Make the public chapter registry a complete, usable source of truth for chapter verification.

## Definition of done

- [x] Public registry homepage and search experience
- [x] Direct Chapter ID verification
- [x] Search by approved public search token
- [x] Published chapter directory
- [x] Active, conditional, inactive, suspended, expired, closed, and revoked displays
- [x] Separate authorization and standing labels
- [x] Approval, effective, renewal, and last-verified dates
- [x] Host institution, location, and service-area fields
- [x] Stable verification links
- [x] QR codes for live verification records
- [x] Copy-link and print actions
- [x] Public explanation of verification
- [x] Unauthorized chapter concern report
- [x] Strict public-report Firestore validation
- [x] Public/private data separation
- [x] Empty, loading, no-match, not-found, and error states
- [x] Responsive and print-friendly layouts
- [x] Firestore composite indexes
- [x] Registry data-model documentation

## Collections introduced

```text
publicChapterRegistry/{chapterId}
unauthorizedChapterReports/{reportId}
```

## Deployment requirements

Deploy both the updated Firestore Rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The composite indexes may take several minutes to finish building. General search and the directory can return an index error until Firebase marks them ready.
