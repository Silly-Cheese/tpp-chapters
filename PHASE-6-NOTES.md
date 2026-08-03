# Phase 6 Release Notes

## Release goal

Add a complete real-time communication layer for approved chapters and Prayer Project staff.

## Definition of done

- [x] Chapter support center
- [x] Director and Adviser ticket creation
- [x] Shared chapter conversations
- [x] Confidential Adviser-only conversations
- [x] Real-time Firestore message listeners
- [x] Ticket categories, priorities, assignments, and statuses
- [x] Staff support queue
- [x] Internal staff notes separated from chapter-visible messages
- [x] Message attachments in Firebase Storage
- [x] Read-state and unread-message tracking
- [x] Chapter communications center combining notices and support activity
- [x] Administrative notice publishing by Chapter ID
- [x] Responsive mobile, tablet, and desktop interface
- [x] Firestore and Storage authorization rules
- [x] Composite indexes for support queues
- [x] Data-model and deployment documentation

## Collections introduced

```text
supportTickets/{ticketId}
supportTickets/{ticketId}/messages/{messageId}
supportTickets/{ticketId}/messages/{messageId}/attachments/{attachmentId}
supportTickets/{ticketId}/internalNotes/{noteId}
supportReadStates/{ticketId}__{uid}
```

Existing chapter notices continue to use:

```text
chapters/{chapterId}/notices/{noticeId}
chapters/{chapterId}/noticeReceipts/{noticeId}__{uid}
```

## Storage path introduced

```text
support-attachments/{chapterId}/{ticketId}/{messageId}/{uid}/{fileName}
```

## Deployment requirements

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

The support indexes can take several minutes to build after deployment.
