# The Prayer Project — Chapter Registry & Operations Portal

The official public registry and private chapter-operations platform for The Prayer Project.

## Production deployment

- Production address: `https://chapter.ask4prayers.com`
- Firebase project: `tpp-chapters`
- GitHub Pages source: `main` and `/ (root)`
- Supported release: current `main`

Completed phase branches are reviewed through pull requests and merged into `main`. GitHub Pages serves the website files from `main`. Firebase Security Rules, indexes, and Storage Rules are deployed separately with the Firebase CLI.

The Firebase web configuration is public client configuration by design. Never commit service-account keys, Admin SDK credentials, passwords, activation codes, or server secrets.

## Complete eight-phase release

### Phase 1 — Foundation and design system

- Responsive black, cream, white, and gold interface
- Firebase Email/Password authentication
- Persistent sessions, password reset, profiles, role routing, protected pages, and light/dark appearance

### Phase 2 — Public chapter registry

- Permanent Chapter ID verification
- Public chapter search and directory
- Authorization and standing results
- Stable verification links and QR codes
- Unauthorized-chapter concern reports

### Phase 3 — Account invitations and activation

- Secure Director and Adviser invitations
- Single-use activation codes stored as SHA-256 hashes
- New-account and existing-account activation
- Assigned chapter, role, email, and Firebase email-verification enforcement

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

- Unified administrative dashboard and operational metrics
- Private chapter records and public-registry synchronization
- Portal-user and chapter-membership management
- Concern review, audit history, CSV exports, and system settings
- Unified navigation to specialist administration areas

### Phase 8 — Production finalization

- Public maintenance mode and feature availability gates
- Public announcement banner
- Administrator recovery access during maintenance
- Global JavaScript error recovery and support references
- Online/offline connection notices
- Accessible route focus and reduced-motion support
- Administrative system-health console
- GitHub Pages route recovery
- Continuous GitHub Actions validation
- Security policy, role matrix, and final production checklist

## Required Firebase setup

### Authentication

1. Enable **Email/Password** under **Authentication → Sign-in method**.
2. Add `chapter.ask4prayers.com` to authorized domains.
3. Add `silly-cheese.github.io` when the GitHub Pages fallback address is used.
4. Review the password-reset and email-verification templates.

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
/#/admin/system-health
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

Changing `accountStatus` controls protected Firestore portal access. Without a trusted Admin SDK backend, this static site cannot disable or delete the underlying Firebase Authentication account. That action must be completed manually in Firebase Console when necessary.

## Validation

Pull requests and pushes to `main` run `.github/workflows/validate.yml`.

Local validation:

```bash
python3 scripts/validate_repository.py
```

JavaScript syntax validation:

```bash
find assets/js -type f -name '*.js' -print0 | while IFS= read -r -d '' file; do
  node --input-type=module --check < "$file"
done
```

## Documentation

- [`PHASE-8-NOTES.md`](PHASE-8-NOTES.md)
- [`docs/PHASE-8-PRODUCTION-CHECKLIST.md`](docs/PHASE-8-PRODUCTION-CHECKLIST.md)
- [`docs/ROLE-PERMISSION-MATRIX.md`](docs/ROLE-PERMISSION-MATRIX.md)
- [`SECURITY.md`](SECURITY.md)
- [`docs/REGISTRY-DATA-MODEL.md`](docs/REGISTRY-DATA-MODEL.md)
- [`docs/ACCOUNT-ACTIVATION-DATA-MODEL.md`](docs/ACCOUNT-ACTIVATION-DATA-MODEL.md)
- [`docs/CHAPTER-PORTAL-DATA-MODEL.md`](docs/CHAPTER-PORTAL-DATA-MODEL.md)
- [`docs/SUBMISSION-WORKFLOW-DATA-MODEL.md`](docs/SUBMISSION-WORKFLOW-DATA-MODEL.md)
- [`docs/SUPPORT-COMMUNICATIONS-DATA-MODEL.md`](docs/SUPPORT-COMMUNICATIONS-DATA-MODEL.md)
- [`docs/ADMINISTRATION-DATA-MODEL.md`](docs/ADMINISTRATION-DATA-MODEL.md)

## Local testing

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` and add `localhost` to Firebase Authentication authorized domains only when local testing requires it.

## Launch standard

The platform is ready for real chapter use only after:

1. The latest `main` deployment is live on the custom domain.
2. Firestore Rules, indexes, and Storage Rules are deployed.
3. The full role matrix is tested with separate accounts.
4. The Phase 8 production checklist is completed.
5. The system-health console reports no unresolved critical failures.
