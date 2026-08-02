# Phase 3 Setup and Test Guide

## 1. Deploy Firestore Rules

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules
```

## 2. Confirm Firebase Authentication settings

In Firebase Console:

1. Open **Authentication → Sign-in method**.
2. Confirm **Email/Password** is enabled.
3. Open **Authentication → Settings → Authorized domains**.
4. Confirm these domains are authorized:
   - `chapter.ask4prayers.com`
   - `silly-cheese.github.io`
   - `localhost` for local testing, when needed
5. Review the Firebase email-verification template under **Authentication → Templates**.

## 3. Confirm administrator access

The invitation workspace is available to active users whose `systemUsers/{uid}.systemRole` is either:

```text
owner
chapterAdmin
```

Open:

```text
https://chapter.ask4prayers.com/#/admin/invitations
```

## 4. Create a published chapter record first

The invitation form validates the Chapter ID against:

```text
publicChapterRegistry/{chapterId}
```

The record must exist and contain:

```javascript
{
  officialName: "The Prayer Project at Example School",
  isPublished: true
}
```

## 5. Test a new-account activation

1. Create a Director or Adviser invitation.
2. Copy the code or activation link immediately.
3. Open the link in a private/incognito browser window.
4. Create the new account using the assigned email.
5. Confirm the invitation changes to `claimed`.
6. Confirm `systemUsers/{uid}` is created.
7. Confirm `chapterMemberships/{chapterId}__{uid}` is created.
8. Open the Firebase verification email and verify the address.
9. Return to the portal and select **I verified my email**.

## 6. Test an existing-account activation

1. Issue a new invitation to an email that already has a Firebase Authentication account.
2. Choose **Use an existing account**.
3. Sign in using the existing password.
4. Confirm that the membership is created without overwriting the existing global profile.

## 7. Test denial paths

Confirm that the portal rejects:

- An incomplete or incorrect activation code
- A revoked code
- A claimed code
- An expired code
- An account whose email differs from the invitation
- A self-selected chapter or role
- Chapter-data access before email verification
- Invitation-page access by a non-administrator

## Operational note

The portal cannot retrieve a plaintext activation code after the administrator dismisses the one-time display. Create a replacement invitation if the recipient loses the code.
