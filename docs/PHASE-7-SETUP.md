# Phase 7 Setup and Validation

## 1. Deploy the current Firebase configuration

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,storage
```

Phase 7 does not add a new index, but deploying the complete configuration ensures all Phase 1–6 rules and indexes remain current.

## 2. Open the console

```text
https://chapter.ask4prayers.com/#/admin/dashboard
```

The console is available to active portal profiles with one of these roles:

```text
owner
chapterAdmin
complianceAdmin
supportAgent
```

## 3. Validate each role

### Owner

Confirm the Owner can:

- Open every Phase 7 page
- Edit chapter records
- Publish and unpublish registry records
- Change portal user roles and account statuses
- Assign and update chapter memberships
- Review concern reports
- Export CSV data
- Save system settings

### Chapter Administrator

Confirm the Chapter Administrator can:

- Edit chapters
- Publish registry records
- Assign and update memberships
- Review concern reports
- View users and settings without Owner-only controls

### Compliance Administrator

Confirm the Compliance Administrator can:

- Edit private chapter records
- View registry records, users, and memberships
- View concern reports without saving a concern decision
- Access submission review and chapter workspace setup

### Support Agent

Confirm the Support Agent can:

- View the administrative dashboard and directories
- Review concern reports
- Open the Phase 6 support queue
- Not edit chapters, memberships, registry publication, users, or settings

## 4. Test chapter synchronization

1. Open a private chapter record as the Owner or Chapter Administrator.
2. Change standing or renewal information with an administrative reason.
3. Save the chapter.
4. Synchronize the public registry.
5. Confirm the verification page reflects public-safe fields only.
6. Unpublish the record and confirm it disappears from public search.
7. Publish it again from the private chapter record.

## 5. Test portal access controls

1. As Owner, change a test profile from `active` to `disabled`.
2. Confirm Firestore-protected portal pages deny that profile after session refresh.
3. Restore the profile to `active`.
4. Confirm that this process did not delete the Firebase Authentication account.

## 6. Test membership management

1. Select an existing Director, Adviser, or Chapter User profile.
2. Assign it to an initialized chapter.
3. Confirm the membership document ID is `{chapterId}__{uid}`.
4. Confirm the leader record appears under `chapters/{chapterId}/leaders/{uid}`.
5. Suspend and restore the membership.
6. Confirm a user cannot access a different chapter by editing the URL.

## 7. Test audit records

Complete a chapter update, registry sync, user access update, membership update, concern review, and system-settings update. Confirm each action creates a new append-only `auditLogs` document.

## 8. GitHub Pages visibility

The production site serves files from the repository's configured GitHub Pages source. In this project, completed phase pull requests are merged into `main`. Confirm:

- Repository → Settings → Pages uses `main` and `/ (root)`
- `CNAME` still contains `chapter.ask4prayers.com`
- HTTPS is enabled
- The latest `main/index.html` references all four Phase 7 stylesheets and `assets/js/phase7.js`
