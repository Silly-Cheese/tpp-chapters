# The Prayer Project — Chapter Registry & Operations Portal

The official public registry and private operations platform for Prayer Project chapters.

## Production deployment

- Production address: `https://chapter.ask4prayers.com`
- Firebase project: `tpp-chapters`
- GitHub Pages source: `main` and `/ (root)`

Completed phase branches are reviewed through pull requests and merged into `main`. GitHub Pages serves the files from `main`; Firebase Security Rules, indexes, and Storage Rules must still be deployed separately with the Firebase CLI.

The Firebase web configuration is public client configuration by design. Never commit service-account keys, Admin SDK credentials, or server secrets.

## Current release

### Phase 1 — Foundation and design system

- Responsive black, cream, white, and gold interface
- Firebase Email/Password authentication
- Persistent sessions, password reset, profiles, roles, protected routing, and light/dark themes

### Phase 2 — Public chapter registry

- Permanent Chapter ID verification
- Public chapter search and directory
- Authorization, standing, stable verification links, QR codes, and unauthorized-chapter reports

### Phase 3 — Account invitations and activation

- Secure Director and Adviser invitations
- Single-use activation codes stored as SHA-256 hashes
- New-account and existing-account activation
- Assigned chapter, role, email, and Firebase verification enforcement

### Phase 4 — Director and Adviser portals

- Chapter overview, standing, compliance, leadership, documents, notices, and acknowledgments
- Adviser-only oversight and confidential check-ins
- Administrative chapter-workspace setup

### Phase 5 — Reports and operational workflows

- Meeting and activity reports
- Event proposals, change requests, inactivity requests, document submissions, renewals, and Adviser confirmations
- Drafts, corrections, administrative decisions, and secure attachments

### Phase 6 — Support and communications

- Real-time shared and Adviser-private support tickets
- Staff assignment, escalation, internal notes, attachments, and unread tracking
- Chapter communications center and administrative notice publishing

### Phase 7 — Full administrative management

- Unified administrative dashboard with live operational metrics
- Private chapter directory and chapter-record management
- Authorization, standing, institution, and renewal controls
- Public-registry publishing, synchronization, and unpublishing
- Portal-user directory with Owner-only role and account-status controls
- Chapter-membership assignment, role changes, suspension, and revocation
- Unauthorized-chapter concern review
- Append-only audit-history search
- CSV exports for operational records
- Owner-controlled system settings
- Unified navigation to invitation, workspace, submission, support, and notice workspaces

## Required Firebase setup

### Authentication

1. Enable **Email/Password** under **Authentication → Sign-in method**.
2. Add `chapter.ask4prayers.com` and `silly-cheese.github.io` to authorized domains when necessary.
3. Review the email-verification template.

### Deploy Rules and indexes

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,firestore:indexes,storage
```

New or changed Firestore indexes can take several minutes to become available.

### Owner account

Create the Owner in Firebase Authentication, then create `systemUsers/{OWNER_UID}` with:

```text
displayName: Christopher Shelley
email: <owner email>
systemRole: owner
accountStatus: active
createdAt: <timestamp>
updatedAt: <timestamp>
```

## Main routes

### Public

```text
/#/verify
/#/verify/{chapterId}
/#/chapters
/#/report-chapter
/#/activate
/#/login
```

### Chapter leadership

```text
/#/dashboard
/#/chapter/overview
/#/chapter/compliance
/#/chapter/leadership
/#/chapter/documents
/#/chapter/notices
/#/chapter/adviser
/#/chapter/workflows
/#/chapter/submissions
/#/chapter/communications
/#/chapter/support
/#/chapter/support/new
/#/chapter/support/ticket?id={ticketId}
```

### Unified administration

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

### Specialist administration

```text
/#/admin/invitations
/#/admin/chapter-workspaces
/#/admin/submissions
/#/admin/support
/#/admin/support/ticket?id={ticketId}
/#/admin/communications
```

## Core collections

```text
systemUsers
systemSettings
publicChapterRegistry
chapterInvitations
chapterMemberships
chapters
chapterSubmissions
supportTickets
supportReadStates
unauthorizedChapterReports
auditLogs
```

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

Director, Adviser, and chapter-user accounts require verified Firebase email before private chapter data is available.

A Phase 7 `accountStatus` change controls Firestore portal access. Without a trusted Admin SDK backend, this static site cannot disable or delete the underlying Firebase Authentication account.

## Documentation

- [`PHASE-1-NOTES.md`](PHASE-1-NOTES.md)
- [`PHASE-2-NOTES.md`](PHASE-2-NOTES.md)
- [`PHASE-3-NOTES.md`](PHASE-3-NOTES.md)
- [`PHASE-4-NOTES.md`](PHASE-4-NOTES.md)
- [`PHASE-5-NOTES.md`](PHASE-5-NOTES.md)
- [`PHASE-6-NOTES.md`](PHASE-6-NOTES.md)
- [`PHASE-7-NOTES.md`](PHASE-7-NOTES.md)
- [`docs/REGISTRY-DATA-MODEL.md`](docs/REGISTRY-DATA-MODEL.md)
- [`docs/ACCOUNT-ACTIVATION-DATA-MODEL.md`](docs/ACCOUNT-ACTIVATION-DATA-MODEL.md)
- [`docs/CHAPTER-PORTAL-DATA-MODEL.md`](docs/CHAPTER-PORTAL-DATA-MODEL.md)
- [`docs/SUBMISSION-WORKFLOW-DATA-MODEL.md`](docs/SUBMISSION-WORKFLOW-DATA-MODEL.md)
- [`docs/SUPPORT-COMMUNICATIONS-DATA-MODEL.md`](docs/SUPPORT-COMMUNICATIONS-DATA-MODEL.md)
- [`docs/ADMINISTRATION-DATA-MODEL.md`](docs/ADMINISTRATION-DATA-MODEL.md)
- [`docs/PHASE-7-SETUP.md`](docs/PHASE-7-SETUP.md)

## Local testing

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` and add `localhost` to Firebase Authentication authorized domains if necessary.

## Phase roadmap

1. Foundation and design system — complete
2. Public chapter registry and verification — complete
3. Account invitations and activation — complete
4. Director and Adviser portals — complete
5. Reports, renewals, and operational workflows — complete
6. Real-time support and communications — complete
7. Full administrative management — complete
8. Security review, testing, documentation, and production finalization
