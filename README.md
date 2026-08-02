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

### Phase 3 — Account invitations and activation

- Owner and Chapter Administrator invitation workspace
- Single-use Director and Adviser activation codes
- Published Chapter ID validation before invitation issuance
- High-entropy browser-generated codes
- SHA-256 code hashing before Firestore storage
- Configurable invitation expiration
- Invitation history and revocation
- New Firebase account creation
- Existing Firebase account connection
- Atomic invitation claim, portal-profile creation, and chapter-membership creation
- Assigned-email and assigned-role enforcement in Firestore Rules
- Firebase email verification, resend, and refresh workflow
- Activation-complete chapter assignment confirmation
- Login-page and administrator-navigation integration

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
4. Review the email-verification template under **Authentication → Templates**.

### 2. Deploy Firestore Rules and indexes

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,firestore:indexes,storage
```

The Phase 2 composite indexes may take several minutes to build. Phase 3 does not require an additional composite index.

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

### 5. Issue chapter account invitations

Active `owner` and `chapterAdmin` accounts can open:

```text
/#/admin/invitations
```

The invitation form requires a published Chapter ID. The plaintext activation code is displayed only once and is not stored in Firestore.

Read:

- [`docs/ACCOUNT-ACTIVATION-DATA-MODEL.md`](docs/ACCOUNT-ACTIVATION-DATA-MODEL.md)
- [`docs/PHASE-3-SETUP.md`](docs/PHASE-3-SETUP.md)

## Public routes

```text
/                         Registry homepage
/#/verify                 Registry search
/#/verify/{chapterId}     Live verification record
/#/chapters               Published chapter directory
/#/about-verification     Registry explanation
/#/report-chapter         Public concern report
/#/activate               Chapter account activation
/#/verify-email           Firebase email verification
/#/activation-complete    Activation confirmation
/#/login                  Portal login
```

Pretty verification links such as `/verify/TPP-CH-2026-000001` are redirected by `404.html` into the application route.

## Administrative routes

```text
/#/dashboard              Role-specific dashboard
/#/profile                Account profile
/#/admin/invitations      Director and Adviser invitation management
```

## Public and private data

Public verification data belongs only in `publicChapterRegistry`. Do not place private contact details, minor information, prayer requests, applications, internal notes, incidents, or disciplinary information in public records.

Public concern reports are stored in:

```text
unauthorizedChapterReports/{reportId}
```

Account activation records use:

```text
chapterInvitations/{sha256ActivationCode}
chapterMemberships/{chapterId}__{firebaseUid}
```

Only the SHA-256 hash of an activation code is stored. The invitation recipient's authenticated email, invitation role, chapter assignment, portal profile, and membership record must agree before the Firestore batch can commit.

## Role values

```text
owner
chapterAdmin
complianceAdmin
supportAgent
director
adviser
chapterUser
```

Portal access requires:

```text
accountStatus = active
```

Director, Adviser, and future `chapterUser` accounts must also have a verified Firebase email before protected chapter data is available.

## Local testing

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`. Add `localhost` to Firebase Authentication authorized domains when required.

## Release notes

- [`PHASE-1-NOTES.md`](PHASE-1-NOTES.md)
- [`PHASE-2-NOTES.md`](PHASE-2-NOTES.md)
- [`PHASE-3-NOTES.md`](PHASE-3-NOTES.md)

## Phase roadmap

1. Foundation and design system — complete
2. Public chapter registry and verification — complete
3. Account invitations and activation — complete
4. Director and Adviser portals
5. Reports, renewals, and operational workflows
6. Internal support chat and notices
7. Full administrative management
8. Security review, testing, documentation, and production finalization
