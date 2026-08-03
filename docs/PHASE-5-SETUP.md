# Phase 5 Setup and Testing

## 1. Deploy Firebase Rules

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,storage
```

Both rule files are required. Firestore stores the submission and attachment metadata; Cloud Storage stores the uploaded file bytes.

## 2. Confirm Firebase Storage is available

Open **Firebase Console → Storage** and confirm the `tpp-chapters.firebasestorage.app` bucket is initialized.

## 3. Test as a Chapter Director

1. Sign in with an email-verified Director account.
2. Open `/#/chapter/workflows`.
3. Save a meeting report as a draft.
4. Reopen and edit the draft.
5. Add a permitted attachment.
6. Submit the report.
7. Confirm the report becomes read-only.
8. Submit an annual renewal.
9. Confirm the Director cannot open the Adviser-confirmation workflow.

## 4. Test as a Chapter Adviser

1. Sign in with an email-verified Adviser account.
2. Submit an annual Adviser confirmation.
3. Submit or review a routine chapter activity report.
4. Confirm the Adviser cannot create an annual chapter renewal.
5. Confirm the Adviser can view other submissions for the same chapter but cannot edit them.

## 5. Test administrative review

Open:

```text
/#/admin/submissions
```

Using an Owner, Chapter Administrator, or Compliance Administrator account:

1. Mark a submitted item under review.
2. Request changes with a review note.
3. Confirm the creator can edit and resubmit it.
4. Approve a resubmitted item.
5. Deny another item with an explanation.
6. Approve an Adviser confirmation and verify the private chapter record updates.
7. Approve an annual renewal and verify the private chapter renewal fields update.

## 6. Test attachments

Verify that:

- PDF, DOC, DOCX, PNG, and JPEG files upload.
- Files larger than 10 MB are rejected.
- More than five files are rejected.
- Unsupported file types are rejected.
- A user from another chapter cannot read or upload files.
- A creator cannot add files after a submission leaves an editable status.
- Administrative reviewers can open attachments.

## 7. Required denial tests

Test these cases explicitly:

- Unverified chapter account attempts to open workflows.
- Director attempts to submit Adviser confirmation.
- Adviser attempts to submit annual renewal.
- Chapter user changes a URL to another chapter's submission.
- Creator attempts to edit an approved or denied record.
- User attempts to alter review fields.
- Support Agent attempts to approve or deny a submission.
