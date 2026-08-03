# The Prayer Project — Chapter Registry & Operations Portal

The official public registry and private operations platform for Prayer Project chapters.

## Current release

### Phase 1 — Foundation and design system

- Responsive black, cream, white, and gold interface
- Firebase Email/Password authentication
- Persistent sessions, password reset, profiles, roles, and protected routing
- Owner, staff, Director, and Adviser account foundations
- Light and dark themes

### Phase 2 — Public chapter registry

- Permanent Chapter ID verification
- Public chapter search and directory
- Authorization and standing displays
- Stable verification links and QR codes
- Unauthorized chapter concern reports

### Phase 3 — Account invitations and activation

- Secure Director and Adviser invitations
- Single-use activation codes stored as SHA-256 hashes
- New-account and existing-account activation
- Assigned chapter, role, and email enforcement
- Firebase email verification
- Atomic portal profile and chapter membership creation

### Phase 4 — Director and Adviser portals

- Chapter overview, standing, and compliance requirements
- Approved leadership roster and official document library
- Chapter notices and individual acknowledgments
- Adviser-only oversight and confidential check-ins
- Administrative chapter-workspace setup

### Phase 5 — Reports and operational workflows

- Meeting and activity reports
- Event proposals and change requests
- Temporary inactivity and document submissions
- Annual chapter renewals and Adviser confirmations
- Drafts, corrections, resubmission, and administrative decisions
- Secure PDF, Word, PNG, and JPEG attachments

### Phase 6 — Support and communications

- Real-time chapter support tickets and message threads
- Shared chapter conversations
- Confidential Adviser-only conversations
- Ticket categories, priorities, statuses, assignment, and escalation
- Staff support queue and internal staff notes
- Message attachments through Firebase Storage
- Read-state and unread-message tracking
- Communications center combining chapter notices and support activity
- Administrative chapter-notice publishing

## Production address

`https://chapter.ask4prayers.com`

## Firebase project

`tpp-chapters`

The Firebase web configuration is public client configuration by design. Never commit service-account keys, Admin SDK credentials, or server secrets.

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

Phase 6 adds support-ticket indexes and changes both Firestore and Cloud Storage Rules. New indexes can take several minutes to become available.

### Owner account

Create the Owner in Firebase Authentication, then create:

```text
systemUsers/{OWNER_UID}
```

with:

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

### Administration

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

Support records use:

```text
supportTickets/{ticketId}/messages/{messageId}
supportTickets/{ticketId}/messages/{messageId}/attachments/{attachmentId}
supportTickets/{ticketId}/internalNotes/{noteId}
supportReadStates/{ticketId}__{uid}
```

Support attachment objects use:

```text
support-attachments/chapter/{chapterId}/{ticketId}/{messageId}/{uid}/{fileName}
support-attachments/staff/{chapterId}/{ticketId}/{messageId}/{uid}/{fileName}
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

## Documentation

- [`PHASE-1-NOTES.md`](PHASE-1-NOTES.md)
- [`PHASE-2-NOTES.md`](PHASE-2-NOTES.md)
- [`PHASE-3-NOTES.md`](PHASE-3-NOTES.md)
- [`PHASE-4-NOTES.md`](PHASE-4-NOTES.md)
- [`PHASE-5-NOTES.md`](PHASE-5-NOTES.md)
- [`PHASE-6-NOTES.md`](PHASE-6-NOTES.md)
- [`docs/REGISTRY-DATA-MODEL.md`](docs/REGISTRY-DATA-MODEL.md)
- [`docs/ACCOUNT-ACTIVATION-DATA-MODEL.md`](docs/ACCOUNT-ACTIVATION-DATA-MODEL.md)
- [`docs/CHAPTER-PORTAL-DATA-MODEL.md`](docs/CHAPTER-PORTAL-DATA-MODEL.md)
- [`docs/SUBMISSION-WORKFLOW-DATA-MODEL.md`](docs/SUBMISSION-WORKFLOW-DATA-MODEL.md)
- [`docs/SUPPORT-COMMUNICATIONS-DATA-MODEL.md`](docs/SUPPORT-COMMUNICATIONS-DATA-MODEL.md)
- [`docs/PHASE-6-SETUP.md`](docs/PHASE-6-SETUP.md)

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
7. Full administrative management
8. Security review, testing, documentation, and production finalization
