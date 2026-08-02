# The Prayer Project — Chapter Registry & Operations Portal

The official public registry and private operations portal for Prayer Project chapters.

## Current release

### Phase 1 — Foundation and design system

- Responsive black, cream, white, and gold design system
- Firebase Email/Password sign-in and password reset
- Persistent authenticated sessions
- Firestore-backed portal profiles and roles
- Owner, administrator, Director, and Adviser route protection
- Profile editing with field-restricted Security Rules
- Light and dark themes
- GitHub Pages custom-domain configuration

### Phase 2 — Public chapter registry and verification

- Public Chapter ID verification
- Search by approved public search token
- Published chapter directory
- Authorization and standing displays
- Approval, renewal, and last-verified dates
- Stable verification URLs and QR codes
- Copy-link and print actions
- Public explanation of the registry
- Unauthorized chapter concern reports
- Firestore rules for public/private data separation
- Composite indexes for directory and search queries

## Production address

`https://chapter.ask4prayers.com`

## Firebase project

`tpp-chapters`

The Firebase web configuration is public client configuration by design. Never commit a service-account key, Admin SDK private credential, or other server secret.

## Required Firebase setup

### 1. Authentication

In Firebase Console:

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Add `chapter.ask4prayers.com` and `silly-cheese.github.io` to authorized domains when needed.

### 2. Deploy Firestore Rules and indexes

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,firestore:indexes,storage
```

The two Phase 2 composite indexes may take several minutes to build. General search and the directory can show an index error until Firebase marks them ready.

### 3. Create the first Owner account

1. In **Firebase Authentication → Users**, create the Owner email/password account.
2. Copy the Firebase UID.
3. Create `systemUsers/{OWNER_UID}` in Firestore with:

| Field | Type | Value |
|---|---|---|
| `displayName` | string | `Christopher Shelley` |
| `email` | string | Owner account email |
| `systemRole` | string | `owner` |
| `accountStatus` | string | `active` |
| `createdAt` | timestamp | Current date/time |
| `updatedAt` | timestamp | Current date/time |

A Firebase Authentication account alone does not grant portal access. The matching active `systemUsers` record is required.

### 4. Publish chapter records

Public records use:

```text
publicChapterRegistry/{chapterId}
```

Read [`docs/REGISTRY-DATA-MODEL.md`](docs/REGISTRY-DATA-MODEL.md) before creating a record. A safe fictional example is available in [`docs/sample-public-chapter.json`](docs/sample-public-chapter.json).

The Firestore document ID should equal the permanent Chapter ID, for example:

```text
TPP-CH-2026-000001
```

Set `isPublished` to `true` only when the record is ready for public viewing.

## Public routes

```text
/                         Registry homepage
/#/verify                 Registry search
/#/verify/{chapterId}     Live verification record
/#/chapters               Published chapter directory
/#/about-verification     Registry explanation
/#/report-chapter         Public concern report
/#/login                  Portal login
```

Pretty verification links such as `/verify/TPP-CH-2026-000001` are redirected by `404.html` into the application route.

## Public and private data

Public verification data belongs only in `publicChapterRegistry`. Do not place private contact details, minor information, prayer requests, applications, internal notes, incidents, or disciplinary information in public records.

Public concern reports are stored in:

```text
unauthorizedChapterReports/{reportId}
```

Only authorized administrative accounts may read those reports.

## Role values

```text
owner
chapterAdmin
complianceAdmin
supportAgent
director
adviser
```

Portal access requires:

```text
accountStatus = active
```

## Local testing

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`. Add `localhost` to Firebase Authentication authorized domains when required.

## Release notes

- [`PHASE-1-NOTES.md`](PHASE-1-NOTES.md)
- [`PHASE-2-NOTES.md`](PHASE-2-NOTES.md)

## Phase roadmap

1. Foundation and design system — complete
2. Public chapter registry and verification — complete
3. Account invitations and activation
4. Director and Adviser portals
5. Reports, renewals, and operational workflows
6. Internal support chat and notices
7. Full administrative management
8. Security review, testing, documentation, and production finalization
