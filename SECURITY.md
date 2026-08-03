# Security Policy

## Reporting a security concern

Do not open a public GitHub issue for a vulnerability that could expose private chapter, leadership, support, document, or account information.

Report security concerns privately to:

`pray@ask4prayers.com`

Include:

- The affected page or feature
- The account role used during testing
- Reproduction steps
- Expected and actual behavior
- Screenshots with personal information removed
- The browser and device used
- Any Phase 8 error reference shown by the portal

Do not include passwords, activation codes, Firebase tokens, private support messages, uploaded documents, or personal information belonging to another person.

## Supported release

The supported production release is the current `main` branch deployed to:

`https://chapter.ask4prayers.com`

Security fixes are applied to `main`. Old development branches are not supported deployments.

## Security boundaries

This portal uses:

- Firebase Authentication for identity
- Firestore Security Rules for document authorization
- Cloud Storage Security Rules for attachment authorization
- GitHub Pages for static site delivery
- Separate public and private chapter records
- Role and chapter-membership checks
- Verified email requirements for chapter accounts
- Append-only audit records for important administrative actions

Interface controls are not treated as security controls. Firestore and Storage Rules must deny unauthorized reads and writes even when a user manually changes a URL or browser request.

## Known architecture limitations

The portal currently has no trusted Admin SDK backend. Therefore:

- Disabling a portal profile blocks protected Firestore access but does not disable the Firebase Authentication account itself.
- The browser cannot securely create, delete, or disable another person's Firebase Authentication account.
- Custom Firebase Authentication claims are not used for chapter-specific membership.
- Secret service-account credentials must never be added to this repository or browser code.

These limitations must be considered during incident response and account removal.

## Responsible testing

Use only accounts and records you own or are explicitly authorized to test. Do not:

- Access another chapter's private data
- Read confidential Adviser conversations
- Download documents without authorization
- Attempt denial-of-service testing
- Send large volumes of Firebase requests
- Publish activation codes or account credentials
- Test with real minors' information when fictional records will work

## Credential response

If a password, activation code, token, or service-account credential is exposed:

1. Revoke or rotate it immediately.
2. Remove it from the current repository state.
3. Treat Git history and forks as potentially retaining the value.
4. Review Firebase Authentication, Firestore, Storage, and audit activity.
5. Notify affected users when appropriate.

Deleting a secret from the newest commit does not make the exposed value safe again.
