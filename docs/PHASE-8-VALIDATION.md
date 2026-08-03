# Phase 8 Validation Record

## Automated validation

The Phase 8 pull request runs `.github/workflows/validate.yml` against the final branch head.

The workflow validates:

- Every JavaScript file under `assets/js` using Node.js module syntax parsing
- Every JSON file in the repository
- Required production files
- Local assets referenced by `index.html`
- Firebase project identifiers
- Firestore and Storage Rules structure
- Final deny-all rule presence warnings
- Custom-domain `CNAME`
- Phase 2–8 loading from the production entry page
- Common private-key, service-account, and token patterns

## Rules migration validation

The Phase 8 migration successfully changed the `systemSettings/{documentId}` rule to:

```text
allow get: if documentId == 'portal' || isActive();
allow list: if isActive();
allow create, update, delete: if isOwner();
```

This allows unauthenticated visitors to read only the safe portal settings document required for maintenance mode, public announcements, and feature availability. It does not grant public settings writes or collection listing.

The temporary migration workflow removed itself after committing the rule update.

## Manual validation still required

Automated static checks cannot prove real Firebase permission behavior. Complete the following after deployment:

- Test each role with a separate Firebase Authentication account.
- Test every denial path in `docs/ROLE-PERMISSION-MATRIX.md`.
- Test real Firestore and Storage Rules after deployment.
- Test the custom domain on desktop and mobile browsers.
- Run `/#/admin/system-health` as an administrator.
- Complete `docs/PHASE-8-PRODUCTION-CHECKLIST.md`.

## Release decision

A green repository validation confirms the static release is structurally deployable. Real chapter use must wait until Firebase deployment and multi-account permission testing are complete.
