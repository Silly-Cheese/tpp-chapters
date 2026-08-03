# Phase 8 Production Checklist

Complete this checklist after Phase 8 merges and after every future security-rule, authentication, or custom-domain change.

## 1. GitHub Pages

- [ ] Repository default branch is `main`.
- [ ] Pages source is **Deploy from a branch**.
- [ ] Pages branch is `main` and folder is `/ (root)`.
- [ ] Custom domain is `chapter.ask4prayers.com`.
- [ ] Enforce HTTPS is enabled.
- [ ] `CNAME` contains exactly `chapter.ask4prayers.com`.
- [ ] The latest Pages deployment completed successfully.
- [ ] The root page, login page, public verification page, and admin dashboard load without missing assets.
- [ ] A direct non-hash URL is recovered by `404.html`.

## 2. Firebase Authentication

- [ ] Email/Password authentication is enabled.
- [ ] Authorized domains include `chapter.ask4prayers.com`.
- [ ] Authorized domains include `silly-cheese.github.io` when the GitHub Pages fallback is used.
- [ ] `localhost` is authorized only when local testing requires it.
- [ ] Password-reset and email-verification templates use Prayer Project wording.
- [ ] Owner, Chapter Administrator, Compliance Administrator, Support Agent, Director, and Adviser test accounts are separate.
- [ ] Test passwords are not reused for production users.

## 3. Firebase deployment

Run:

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Then confirm:

- [ ] Firestore Rules deployment succeeded.
- [ ] Storage Rules deployment succeeded.
- [ ] All Firestore indexes show **Enabled**.
- [ ] The public `systemSettings/portal` document can be read without authentication.
- [ ] Only the Owner can change `systemSettings/portal`.
- [ ] No test-mode rule remains in Firestore or Storage.

## 4. Owner and staff setup

- [ ] Owner Firebase Authentication account exists.
- [ ] Matching `systemUsers/{OWNER_UID}` record uses `systemRole: owner` and `accountStatus: active`.
- [ ] Staff profiles use only approved role values.
- [ ] No staff account is shared by multiple people.
- [ ] A recovery plan exists if the primary Owner loses access.
- [ ] Removed staff have their portal profile disabled immediately.
- [ ] Because there is no Admin SDK backend, removed staff Auth accounts are also handled manually in Firebase Console when necessary.

## 5. Public portal testing

- [ ] Published chapter search works by Chapter ID.
- [ ] Published chapter search works by name or institution.
- [ ] Unpublished chapters do not appear publicly.
- [ ] Suspended, expired, closed, and revoked statuses display correctly.
- [ ] Public records contain no private contact information.
- [ ] Unauthorized-chapter concern submission works.
- [ ] Registry-disabled mode shows the Phase 8 feature notice.
- [ ] Public banner displays and can be dismissed for the browser session.
- [ ] Maintenance mode displays for public visitors.

## 6. Activation testing

- [ ] Administrator can issue a Director invitation.
- [ ] Administrator can issue an Adviser invitation.
- [ ] Invitation code is displayed only at creation time.
- [ ] Stored invitation identifier is a SHA-256 hash rather than the plaintext code.
- [ ] New-account activation works.
- [ ] Existing-account activation works.
- [ ] Assigned email, chapter, and role are enforced.
- [ ] Used, revoked, and expired codes are rejected.
- [ ] Email verification is required before private chapter access.
- [ ] Activation-disabled mode shows the Phase 8 feature notice.

## 7. Chapter portal testing

- [ ] Director sees only assigned chapters.
- [ ] Adviser sees only assigned chapters.
- [ ] Multi-chapter account switching works.
- [ ] Standing, compliance, leadership, documents, and notices load.
- [ ] Required notice acknowledgment works.
- [ ] Adviser-only oversight is hidden from Directors.
- [ ] Confidential Adviser check-ins cannot be read by Directors.

## 8. Submission workflow testing

- [ ] Draft save works.
- [ ] Submission works.
- [ ] Administrative review works.
- [ ] Changes-requested correction and resubmission work.
- [ ] Approval and denial work.
- [ ] Director-only renewal restriction works.
- [ ] Adviser-only confirmation restriction works.
- [ ] PDF, DOC, DOCX, PNG, and JPEG uploads work.
- [ ] Oversized and unsupported files are rejected.
- [ ] Submitted records become read-only unless changes are requested.

## 9. Support testing

- [ ] Director can create a shared chapter ticket.
- [ ] Adviser can create a shared chapter ticket.
- [ ] Adviser can create a confidential Adviser-only ticket.
- [ ] Director cannot list or open Adviser-private tickets.
- [ ] Messages update in real time.
- [ ] Staff assignment, escalation, status changes, and internal notes work.
- [ ] Chapter accounts cannot read staff-only internal notes.
- [ ] Message attachments obey size and type limits.
- [ ] Unread indicators clear after opening a ticket.
- [ ] Support-disabled mode shows the Phase 8 feature notice.

## 10. Administration testing

- [ ] Unified dashboard metrics load.
- [ ] Chapter editor saves private changes.
- [ ] Registry synchronization writes only public-safe fields.
- [ ] User role and account-status controls are Owner-only.
- [ ] Membership assignment creates or updates the synchronized leader record.
- [ ] Concern review works for authorized roles.
- [ ] Audit history remains append-only.
- [ ] CSV exports download usable files.
- [ ] System settings save correctly.
- [ ] Signed-in Owner cannot remove their own Owner role.

## 11. Phase 8 health and resilience

- [ ] `/#/admin/system-health` opens for every active administrative role.
- [ ] The health check reports all required assets accessible.
- [ ] Firestore collection checks pass for the intended administrator.
- [ ] Diagnostic report copy works.
- [ ] Offline notice appears when the browser loses connectivity.
- [ ] A forced JavaScript error displays a recoverable error reference rather than a blank screen.
- [ ] Route changes move keyboard focus to the main content.
- [ ] Reduced-motion preferences are respected.
- [ ] Mobile layouts are usable at 320px width.

## 12. Security denial tests

Use `docs/ROLE-PERMISSION-MATRIX.md` and test each denial with a separate account. Browser-hidden controls are not sufficient proof. Verify Firestore or Storage rejects the request.

- [ ] Cross-chapter reads denied.
- [ ] Cross-chapter writes denied.
- [ ] Confidential Adviser access denied to Directors.
- [ ] Official status writes denied to chapter accounts.
- [ ] Registry publishing denied to unauthorized staff.
- [ ] Membership assignment denied to unauthorized staff.
- [ ] Owner settings denied to non-Owners.
- [ ] Protected data denied after sign-out.

## 13. Final cleanup

- [ ] Fictional test chapters are clearly labeled or removed.
- [ ] Test invitations are revoked.
- [ ] Test support tickets and uploads are removed when no longer needed.
- [ ] No real minors' information appears in test records.
- [ ] No password, activation code, token, private key, or service-account file is committed.
- [ ] GitHub Actions validation passes on `main`.
- [ ] Phase 8 system-health report is saved with launch records.

## Launch standard

The system is ready for real chapter use only when:

1. The latest `main` deployment is live.
2. Firebase Rules and indexes are deployed.
3. The role matrix has been tested with separate accounts.
4. No high-severity denial test fails.
5. The Owner can reach both the administrative console and system-health page.
