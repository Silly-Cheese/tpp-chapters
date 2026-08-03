# Phase 7 — Full Administrative Management

Phase 7 turns the separate administrative workspaces from Phases 3–6 into one unified management console.

## Included

- Administrative dashboard with live operational metrics
- Private chapter directory and chapter-record management
- Authorization, standing, institutional, and renewal controls
- Public-registry publishing, synchronization, and unpublishing
- Portal-user directory and Owner-only role/status controls
- Chapter-membership assignment, role changes, suspension, and revocation
- Unauthorized-chapter concern review
- Audit-history search and CSV export
- Owner-controlled system settings
- CSV exports for chapters, users, memberships, registry records, concerns, and audit history
- Unified links to invitations, workspace setup, submission review, support, and notice publishing
- Responsive mobile, tablet, desktop, light, and dark layouts

## Security boundary

The static portal can manage Firestore profiles, memberships, chapter records, and access decisions. It cannot use the Firebase Admin SDK to disable or delete Firebase Authentication users. Setting a portal profile to `disabled` blocks portal access through Firestore Rules but leaves the Authentication account in Firebase.

## Routes

```text
/#/admin
/#/admin/dashboard
/#/admin/chapters
/#/admin/chapter?id={chapterId}
/#/admin/users
/#/admin/memberships
/#/admin/registry
/#/admin/concerns
/#/admin/audit
/#/admin/settings
```

## Firebase changes

Phase 7 uses the existing Phase 1–6 collections and permissions. It does not require a new composite Firestore index or Storage path.

Deploy the current repository configuration after merging:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```
