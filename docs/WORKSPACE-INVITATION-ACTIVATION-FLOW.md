# Workspace, Invitation, and Activation Flow

Use this order for every approved chapter:

1. Create or import the Chapter ID in `publicChapterRegistry`.
2. Sign in as Owner, Chapter Administrator, or Compliance Administrator.
3. Open `/#/admin/chapter-workspaces` and initialize `chapters/{chapterId}`.
4. Open `/#/admin/invitations` and issue a Director or Adviser invitation.
5. The recipient opens `/#/activate`, creates or connects a Firebase account, and accepts the invitation.
6. The recipient verifies the assigned email and enters `/#/portal`.

The registry record does not have to be publicly published for authorized administrators to initialize the private workspace. Public visitors can still read only records where `isPublished == true`.

## Firebase deployment

This repair changes Firestore Security Rules. Deploy them with:

```bash
firebase deploy --only firestore:rules
```

No composite indexes are required.
