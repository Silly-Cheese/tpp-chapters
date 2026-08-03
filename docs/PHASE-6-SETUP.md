# Phase 6 Setup and Test Guide

## 1. Deploy Firebase configuration

Phase 6 changes Firestore Rules, Firestore indexes, and Storage Rules.

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,storage
```

Wait until the two new `supportTickets` indexes show **Enabled** in Firebase Console.

## 2. Required account roles

### Chapter accounts

```text
director
adviser
```

Chapter accounts require:

```text
accountStatus = active
Firebase email verified
active chapterMemberships record
```

### Support staff

```text
owner
chapterAdmin
complianceAdmin
supportAgent
```

Only the first three roles may publish chapter notices. All four may manage support tickets and internal notes.

## 3. Chapter routes

```text
/#/chapter/communications
/#/chapter/support
/#/chapter/support/new
/#/chapter/support/ticket?id={ticketId}
```

## 4. Administrative routes

```text
/#/admin/support
/#/admin/support/ticket?id={ticketId}
/#/admin/communications
```

## 5. Functional test

1. Sign in as a Director.
2. Create a shared chapter ticket.
3. Attach a valid PDF or image.
4. Sign in as a Support Agent.
5. Open the ticket in the support queue.
6. Assign the ticket to the Support Agent.
7. Add an internal staff note.
8. Reply to the chapter and attach a file.
9. Sign back in as the Director and confirm the reply appears in real time.
10. Confirm the ticket shows unread activity until opened.
11. Close the ticket from the chapter portal.

## 6. Adviser-private test

1. Sign in as a Chapter Adviser.
2. Create a ticket using **Confidential Adviser conversation**.
3. Confirm the Adviser can read and reply.
4. Confirm authorized support staff can read and reply.
5. Sign in as the Chapter Director.
6. Confirm the Director cannot list or directly open the private ticket.
7. Confirm the Director cannot read its messages, attachments, or read-state record.

## 7. Notice test

1. Sign in as the Owner, Chapter Administrator, or Compliance Administrator.
2. Open `/#/admin/communications`.
3. Publish a notice for an initialized permanent Chapter ID.
4. Require acknowledgment.
5. Sign in as the Director and Adviser.
6. Confirm the notice appears in the communications center.
7. Confirm each leader must acknowledge separately.

## 8. Attachment denial tests

Confirm Firebase rejects:

- Files over 10 MB
- Unsupported file types
- Uploads to another chapter's ticket
- Chapter uploads to Adviser-private tickets created by another Adviser
- Unauthenticated uploads
- Attachment metadata written by a user who cannot access the ticket

## 9. Internal-note denial tests

Confirm Directors and Advisers cannot:

- Read internal notes
- List internal notes
- Create internal notes
- Infer internal-note content from chapter-visible messages

## 10. Known architecture boundary

Real-time messages use Firestore snapshot listeners. The platform does not display online presence or typing indicators. Those features would require an additional presence system, normally Firebase Realtime Database or a trusted backend.
