# Phase 8 — Production Finalization

Phase 8 completes the eight-phase build of The Prayer Project Chapter Registry & Operations Portal.

## Included

### System-wide settings enforcement

- Public maintenance mode
- Registry availability gate
- Account-activation availability gate
- Support availability gate
- Public announcement banner
- Administrator recovery access while maintenance is active
- Safe defaults when the settings document is unavailable

### Reliability

- Global JavaScript error recovery panel
- Unique support reference for runtime failures
- Offline and restored-connection notices
- GitHub Pages route recovery through `404.html`
- Public crawler policy and sitemap
- Jekyll processing disabled through `.nojekyll`

### Accessibility

- Main-content keyboard focus after route changes
- Reduced-motion support
- Responsive maintenance, feature-gate, and health pages
- Accessible alerts, status regions, buttons, and focus states

### Administrative system health

Route:

```text
/#/admin/system-health
```

The system-health console checks:

- Browser network status
- Secure context
- Production hostname
- Firebase Authentication
- Active administrative profile
- Public portal settings
- Browser local storage
- Required production assets
- Read access to core Firestore collections
- Diagnostic report copying

### Continuous validation

GitHub Actions now checks:

- JavaScript syntax
- JSON validity
- Required production files
- `index.html` asset references
- Firebase project markers
- Firestore and Storage Rules brace balance
- Final deny-all rule presence warnings
- Custom-domain configuration
- Possible committed private keys and token patterns
- Phase 2–8 production loading

### Documentation

- Final deployment checklist
- Final role and permission matrix
- Security reporting and credential-response policy
- Production README

## Important architecture limitation

The portal still has no trusted Firebase Admin SDK backend. Portal account disabling blocks protected Firestore access but does not disable the Firebase Authentication account itself. Firebase Authentication account deletion and disabling must be performed manually in Firebase Console until a secure backend is added.

## Deployment

After merging Phase 8:

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,storage
```

Then complete `docs/PHASE-8-PRODUCTION-CHECKLIST.md`.

## Production branch

All Phase 1–8 files are merged to `main`. GitHub Pages must remain configured to deploy from:

```text
Branch: main
Folder: / (root)
```
