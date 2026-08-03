# Administrative Management Data Model

Phase 7 is a management layer over the existing authoritative collections. It does not duplicate chapter, user, submission, or support records.

## Primary collections

### `systemUsers/{uid}`

Administrative user directory and portal access profile.

Important fields:

```text
displayName
email
systemRole
accountStatus
primaryChapterId
primaryChapterRole
createdAt
updatedAt
updatedByUid
```

Only the Owner can change another user's system role or portal account status. A disabled Firestore profile is not the same as a disabled Firebase Authentication user.

### `chapters/{chapterId}`

Private authoritative chapter operations record.

Phase 7 updates fields including:

```text
officialName
hostInstitutionName
institutionType
authorizationStatus
standing
primaryContactEmail
city
state
country
serviceArea
meetingSchedule
portalSummary
approvalDate
effectiveDate
renewalDate
lastReviewDate
updatedAt
updatedByUid
```

### `publicChapterRegistry/{chapterId}`

Public verification record. Phase 7 synchronizes approved public fields from the private chapter record and controls `isPublished`.

### `chapterMemberships/{chapterId}__{uid}`

One chapter-access record per user and chapter.

Administrative assignments include:

```text
uid
email
displayName
chapterId
chapterName
role
status
invitationId
grantedBy
grantedAt
createdAt
updatedAt
updatedByUid
```

New Director and Adviser accounts should normally use the secure invitation flow. Manual Phase 7 assignment is intended for an existing chapter-account profile.

### `unauthorizedChapterReports/{reportId}`

Original public concern report plus administrative review fields:

```text
status
staffNote
assignedToUid
assignedToName
reviewedAt
updatedAt
```

The original public fields remain preserved.

### `systemSettings/portal`

Owner-controlled portal configuration:

```text
organizationName
registryTitle
supportEmail
renewalWindowDays
bannerTone
maintenanceMode
publicBanner
registryEnabled
activationEnabled
supportEnabled
updatedAt
updatedByUid
updatedByName
```

### `auditLogs/{auditId}`

Append-only administrative record using the existing schema:

```text
actorUid
action
targetType
targetId
summary
createdAt
```

## Role boundaries

### Owner

- Full Phase 7 management
- User role and portal-status control
- Chapter and membership management
- Registry publishing
- Concern review
- System settings

### Chapter Administrator

- Chapter and membership management
- Registry publishing
- Concern review
- No staff-role or system-settings changes

### Compliance Administrator

- Chapter operational management
- Registry synchronization
- Read-only user and membership directories
- Read-only public concern reports under the current rules

### Support Agent

- Read-only chapter, user, membership, and registry directories
- Concern-report review
- Support queue management through Phase 6
- No chapter, membership, registry, or system-settings changes
