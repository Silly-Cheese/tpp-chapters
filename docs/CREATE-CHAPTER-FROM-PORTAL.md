# Create a Chapter from the Portal

Owners and Chapter Administrators can create an official chapter without opening the Firebase Console.

1. Open `/#/admin/chapter-workspaces`.
2. Enter the permanent Chapter ID and select **Load workspace**.
3. When no chapter exists, complete the **Create chapter** form.
4. Choose whether the record should be visible in the public verification directory immediately.
5. Select **Create chapter and workspace**.

The portal creates `publicChapterRegistry/{chapterId}`, records an audit event, initializes `chapters/{chapterId}`, creates the standard compliance requirements, and publishes the welcome notice. The chapter is then ready for Director or Adviser invitations.

Chapter creation is limited to the Owner and Chapter Administrator roles. Compliance Administrators can manage an existing private workspace but cannot create or publish a public registry record.

No composite indexes are required. This feature uses the existing registry and workspace permissions, so no additional Firebase Rules deployment is required after the current rules are already deployed.
