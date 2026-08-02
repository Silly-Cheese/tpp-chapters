# The Prayer Project — Chapter Registry & Operations Portal

Phase 1 establishes the production foundation for the full Prayer Project chapter platform.

## Phase 1 includes

- Responsive black, cream, white, and gold design system
- Public landing page
- Firebase Email/Password sign-in
- Password-reset workflow
- Persistent authenticated sessions
- Firestore-backed portal profiles and roles
- Role-protected dashboard routing
- Owner, administrator, Director, and Adviser dashboard foundations
- Editable user display name with field-restricted Security Rules
- Public and authenticated system-status views
- Mobile navigation, loading, success, empty, and error states
- GitHub Pages custom-domain configuration
- Firestore and Cloud Storage rule files

## Production address

`https://chapter.ask4prayers.com`

## Firebase project

`tpp-chapters`

The Firebase web configuration is intentionally public client configuration. Never commit a service-account key, private Admin SDK credential, or other server secret to this repository.

## Required one-time setup

### 1. Enable Firebase Authentication

In Firebase Console:

1. Open **Authentication**.
2. Select **Sign-in method**.
3. Enable **Email/Password**.
4. Add `chapter.ask4prayers.com` and `silly-cheese.github.io` to **Authorized domains** if they are not already present.

### 2. Deploy the included Firestore and Storage rules

Either copy `firestore.rules` and `storage.rules` into the Firebase Console rule editors, or deploy them using the Firebase CLI:

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 3. Create the first Owner account

Because this is a static GitHub Pages application, privileged account creation must not occur in browser code.

1. In Firebase Console, open **Authentication → Users**.
2. Create the Owner email/password account.
3. Copy the generated Firebase UID.
4. In Firestore, create this document:

```text
Collection: systemUsers
Document ID: <OWNER_FIREBASE_UID>
```

Add these fields:

| Field | Type | Value |
|---|---|---|
| `displayName` | string | `Christopher Shelley` |
| `email` | string | Owner account email |
| `systemRole` | string | `owner` |
| `accountStatus` | string | `active` |
| `createdAt` | timestamp | Current date/time |
| `updatedAt` | timestamp | Current date/time |

The portal will not grant access merely because a Firebase Auth account exists. The matching active `systemUsers/{uid}` record is required.

### 4. Enable GitHub Pages

In repository settings:

1. Open **Pages**.
2. Deploy from the `main` branch and `/ (root)` folder.
3. Confirm the custom domain is `chapter.ask4prayers.com`.
4. Enable **Enforce HTTPS** after the certificate is available.

The repository includes the required `CNAME` file.

## Role values

The Phase 1 router recognizes these exact Firestore role strings:

```text
owner
chapterAdmin
complianceAdmin
supportAgent
director
adviser
```

## Account status values

Phase 1 grants portal access only when:

```text
accountStatus = active
```

Other values render a restricted or pending state.

## Local testing

Because the app uses JavaScript modules, serve the repository through a local HTTP server rather than opening `index.html` directly:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

For Firebase Authentication, add `localhost` to the project's authorized domains if required.

## Phase roadmap

1. Foundation and design system — complete in this release
2. Public chapter registry and verification
3. Account invitations and activation
4. Director and Adviser portals
5. Reports, renewals, and operational workflows
6. Internal support chat and notices
7. Full administrative management
8. Security review, testing, documentation, and production finalization
