# Phase 1 Release Notes

## Release goal

Create the secure, polished foundation that every later chapter feature will reuse.

## Definition of done

- [x] Firebase app initialized with the supplied production project
- [x] Email/password sign-in works
- [x] Password reset works
- [x] Authentication persists across browser restarts
- [x] Sign-out works from every protected page
- [x] Active Firestore profile required for portal access
- [x] Role-specific dashboard routing works
- [x] Owner dashboard works
- [x] Director, Adviser, and staff role foundations work
- [x] User display-name update works under restricted rules
- [x] Public landing page works
- [x] Public and authenticated status pages work
- [x] Responsive navigation works
- [x] Light and dark themes work
- [x] Loading, empty, warning, success, and denied states exist
- [x] Firestore rules deny all unimplemented future data
- [x] Storage rules deny uploads until their secure phase
- [x] GitHub Pages CNAME is included

## Security boundary

This static website intentionally cannot create privileged users, assign its own roles, or use the Firebase Admin SDK. The first Owner account must be created in Firebase Console and paired with a protected Firestore role document. Later invitation workflows will preserve that boundary.
