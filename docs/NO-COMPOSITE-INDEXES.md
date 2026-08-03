# No Custom Composite Indexes

The Chapter Registry & Operations Portal is designed to run without custom Firestore composite indexes.

## Registry behavior

Public chapter records are retrieved with the single required condition `isPublished == true`. Search matching and alphabetical sorting are then completed in the browser. Direct Chapter ID verification continues to use a direct document read.

## Support behavior

Chapter support queries use chapter ID, visibility, and creator equality conditions. Administrative support reads are explicitly authorized by Firestore Security Rules. Message and note ordering uses ordinary single-field indexes.

## Deployment

Deploy the current rules and Storage policy with:

```bash
firebase login
firebase use tpp-chapters
firebase deploy --only firestore:rules,storage
```

The repository's `firestore.indexes.json` intentionally contains no custom composite indexes.

## Existing Firebase indexes

Previously created composite indexes are no longer required by the portal. They may be deleted from Firebase Console after the updated website and rules are deployed and verified.
