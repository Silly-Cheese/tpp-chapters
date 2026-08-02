# Phase 4 Setup and Testing

## 1. Deploy Firestore rules

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules
```

## 2. Confirm prerequisites

Before initializing a private workspace, confirm that:

- The Chapter ID exists in `publicChapterRegistry`.
- `isPublished` is `true`.
- At least one Director or Adviser invitation can be activated.
- The invited account verifies its Firebase email address.

## 3. Initialize the workspace

Sign in as the Owner, a Chapter Administrator, or a Compliance Administrator and open:

```text
/#/admin/chapter-workspaces
```

Enter the permanent Chapter ID and select **Initialize chapter workspace**.

Initialization creates:

- The private `chapters/{chapterId}` record
- Seven standard compliance requirements
- A welcome notice
- Synchronized leader records for active memberships

## 4. Configure the record

Review and complete:

- Authorization status
- Chapter standing
- Institutional approval status
- Adviser confirmation status
- Approval, effective, renewal, and review dates
- Meeting schedule
- Portal summary
- Primary chapter contact email

Then publish any required documents and notices.

## 5. Test the Director portal

Sign in using an activated, email-verified Director account.

Verify:

- `/#/dashboard` opens the chapter overview
- Standing and compliance are visible
- Leadership records load
- Documents open in a new secure tab
- Notices can be acknowledged
- Adviser oversight is not visible

## 6. Test the Adviser portal

Sign in using an activated, email-verified Adviser account.

Verify:

- All common chapter pages load
- Adviser oversight appears in navigation
- A confidential check-in can be submitted
- The Adviser can see only their own check-in history
- A Director cannot read adviser check-ins

## 7. Test multiple memberships

When one Firebase account has multiple active `chapterMemberships`, verify that the chapter selector changes all page data and remembers the most recently selected chapter.

## 8. Denial-path checks

Confirm that:

- Unauthenticated users cannot read private chapter records
- Unverified chapter users are redirected to email verification
- A Director cannot open another chapter by editing a URL
- A Director cannot create or change requirements
- A Director cannot read adviser check-ins
- An Adviser cannot read another Adviser’s check-ins
- Support Agents cannot change workspace records
