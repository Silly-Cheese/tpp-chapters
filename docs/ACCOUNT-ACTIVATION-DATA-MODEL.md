# Account Activation Data Model

Phase 3 introduces two collections:

```text
chapterInvitations/{sha256ActivationCode}
chapterMemberships/{chapterId}__{firebaseUid}
```

## `chapterInvitations`

The document ID is the lowercase hexadecimal SHA-256 hash of the normalized activation code. The plaintext code is never stored.

```javascript
{
  activationCodeHash: "64-character-sha256-hex",
  codeHint: "A9K2Q",
  email: "director@example.org",
  displayName: "Example Director",
  chapterId: "TPP-CH-2026-000001",
  chapterName: "The Prayer Project at Example School",
  role: "director", // director | adviser
  status: "pending", // pending | claimed | revoked
  expiresAt: Timestamp,
  note: "",
  version: 1,
  createdByUid: "administrator-firebase-uid",
  createdAt: Timestamp,
  updatedAt: Timestamp,

  // Added only after successful claim:
  claimedByUid: "recipient-firebase-uid",
  claimedAt: Timestamp
}
```

A pending invitation whose `expiresAt` has passed is treated as expired by the interface and cannot be read or claimed under the Security Rules.

## `chapterMemberships`

The document ID combines the permanent Chapter ID and Firebase UID:

```text
TPP-CH-2026-000001__FIREBASE_UID
```

```javascript
{
  uid: "recipient-firebase-uid",
  email: "director@example.org",
  displayName: "Example Director",
  chapterId: "TPP-CH-2026-000001",
  chapterName: "The Prayer Project at Example School",
  role: "director", // director | adviser
  status: "active",
  invitationId: "64-character-sha256-hex",
  grantedBy: "invitation",
  grantedAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Phase 4 will use these membership documents as the source of chapter-specific Director and Adviser access.

## New `systemUsers` profile created during first activation

```javascript
{
  displayName: "Example Director",
  email: "director@example.org",
  systemRole: "director",
  accountStatus: "active",
  primaryChapterId: "TPP-CH-2026-000001",
  primaryChapterRole: "director",
  activationInvitationId: "64-character-sha256-hex",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

If the authenticated Firebase account already has a valid `systemUsers` record, Phase 3 leaves that global profile unchanged and creates only the additional chapter membership.

## Atomic claim

A successful activation uses one Firestore batch:

1. Change the invitation from `pending` to `claimed`.
2. Create the `systemUsers/{uid}` profile when one does not already exist.
3. Create the chapter membership.

Firestore Rules use `getAfter()` to require that these records agree before any write commits. A partial activation cannot be committed.

## Email verification

Director, Adviser, and future `chapterUser` global roles require a verified Firebase email before `isActive()` grants access to protected chapter data. Owner and staff roles remain governed by their existing administrator profile status.
