# Support and Communications Data Model

## Support ticket

```text
supportTickets/{ticketId}
```

Important fields:

```text
ticketId
chapterId
chapterName
category
priority
visibility
subject
status
createdByUid
createdByName
createdByRole
assignedToUid
assignedToName
accessKeys[]
lastMessageAt
lastMessagePreview
lastMessageByUid
lastMessageByName
lastMessageSenderType
messageCount
createdAt
updatedAt
```

## Visibility

### `chapter`

Visible to active, email-verified members of the assigned chapter and authorized Prayer Project staff.

The access keys contain:

```text
chapter:{chapterId}
user:{creatorUid}
```

### `adviser_private`

Visible only to the Adviser who created the ticket and authorized Prayer Project staff.

The access keys contain:

```text
user:{creatorUid}
```

A Director cannot create or read an Adviser-private ticket.

## Messages

```text
supportTickets/{ticketId}/messages/{messageId}
```

Message fields:

```text
ticketId
chapterId
authorUid
authorName
authorRole
senderType
body
hasAttachments
attachmentCount
createdAt
```

`senderType` is either `chapter` or `staff`.

## Message attachments

```text
supportTickets/{ticketId}/messages/{messageId}/attachments/{attachmentId}
```

Cloud Storage paths are separated by uploader type:

```text
support-attachments/chapter/{chapterId}/{ticketId}/{messageId}/{uid}/{fileName}
support-attachments/staff/{chapterId}/{ticketId}/{messageId}/{uid}/{fileName}
```

Allowed types:

- PDF
- DOC
- DOCX
- PNG
- JPEG

Limits:

```text
5 files per message
10 MB per file
```

## Internal staff notes

```text
supportTickets/{ticketId}/internalNotes/{noteId}
```

Internal notes are never stored in chapter-visible messages. Only the Owner, Chapter Administrators, Compliance Administrators, and Support Agents may read or create them.

## Read states

```text
supportReadStates/{ticketId}__{uid}
```

Read-state records contain:

```text
ticketId
chapterId
uid
lastReadAt
updatedAt
```

The portal compares `lastReadAt` with the ticket's `lastMessageAt` to calculate unread activity.

## Ticket statuses

```text
open
awaiting_staff
awaiting_chapter
under_review
escalated
resolved
closed
```

## Ticket categories

```text
general_assistance
technical_support
chapter_compliance
document_review
leadership_change
renewal_assistance
institutional_concern
urgent_safety_concern
```

## Priorities

```text
low
normal
high
urgent
```

## Existing chapter notices

Phase 6 continues to use the Phase 4 notice records:

```text
chapters/{chapterId}/notices/{noticeId}
chapters/{chapterId}/noticeReceipts/{noticeId}__{uid}
```

The Phase 6 communications page combines these notices with support-ticket activity.
