# Invitation-Code Account Activation

Chapter accounts do not depend on outbound verification email.

The approved activation sequence is:

1. An Owner or Chapter Administrator creates a Director or Adviser invitation.
2. The recipient enters the single-use activation code.
3. The portal fixes the assigned email, chapter, and role from the invitation.
4. The recipient creates a password or signs in to an existing account using that assigned email.
5. Firestore atomically claims the invitation, activates the profile, and creates the chapter membership.
6. The account can immediately open the chapter portal.

The activation code is the approval credential. It is displayed only once to the administrator and only its SHA-256 hash is stored in Firestore. Email verification is not required for chapter access.

After this change, deploy both rulesets:

```bash
firebase deploy --only firestore:rules,storage
```

No composite indexes are required.
