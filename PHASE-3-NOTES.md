# Phase 3 Release Notes — Account Invitations and Activation

## Release goal

Provide a complete, secure, browser-based account activation workflow for approved Chapter Directors and Chapter Advisers without introducing Cloud Functions or exposing Firebase Admin credentials.

## Definition of done

- [x] Owner and Chapter Administrator invitation workspace
- [x] Invitation creation tied to a published permanent Chapter ID
- [x] Director and Adviser role selection
- [x] Configurable 3-, 7-, 14-, or 30-day expiration
- [x] High-entropy single-use activation codes
- [x] SHA-256 code hashing before Firestore storage
- [x] Plaintext activation code displayed only once
- [x] Copy-code and copy-activation-link actions
- [x] Pending, claimed, expired, and revoked invitation history
- [x] Administrator invitation revocation
- [x] Public activation-code lookup by exact hash-derived document ID
- [x] New Firebase Email/Password account creation
- [x] Existing Firebase account connection
- [x] Atomic invitation claim, profile creation, and chapter membership creation
- [x] Assigned-email matching enforced by Firestore Security Rules
- [x] Firebase email-verification workflow
- [x] Verification resend and refresh actions
- [x] Chapter membership confirmation screen
- [x] Login-page and administrator-navigation integration
- [x] Responsive desktop, tablet, and mobile layouts
- [x] Dark-mode compatibility through the existing design variables
- [x] Updated Firestore rules and documentation

## Security boundary

This release intentionally does not use the Firebase Admin SDK. Administrators issue invitation records, while recipients create or connect their own Firebase Authentication accounts. Firestore Security Rules determine whether the invitation, authenticated email, requested chapter role, new portal profile, and new membership all agree.

The browser cannot choose an arbitrary chapter or role during activation. Those values come from the administrator-issued invitation and are validated again in Firestore Rules.

## Activation code format

```text
TPP-XXXXX-XXXXX-XXXXX-XXXXX
```

The 20-character random portion uses an ambiguity-reduced 32-character alphabet. The plaintext code is never written to Firestore. Only its SHA-256 hash and final five-character hint are stored.

## Deployment requirement

Deploy the updated rules after merging:

```bash
firebase use tpp-chapters
firebase deploy --only firestore:rules
```

No new composite Firestore index is required for Phase 3.
