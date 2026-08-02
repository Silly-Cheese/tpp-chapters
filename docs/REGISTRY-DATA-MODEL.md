# Public Chapter Registry Data Model

Phase 2 reads public records from:

```text
publicChapterRegistry/{chapterId}
```

The Firestore document ID and `chapterId` field should be the same permanent ID.

## Required fields

| Field | Type | Example |
|---|---|---|
| `chapterId` | string | `TPP-CH-2026-000001` |
| `officialName` | string | `The Prayer Project at Central High School` |
| `hostInstitutionName` | string | `Central High School` |
| `institutionType` | string | `school`, `church`, or `organization` |
| `city` | string | `Little Rock` |
| `state` | string | `Arkansas` |
| `country` | string | `United States` |
| `serviceArea` | string | `Central High School community` |
| `authorizationStatus` | string | `active` |
| `standing` | string | `good_standing` |
| `approvalDate` | timestamp | Firestore timestamp |
| `effectiveDate` | timestamp | Firestore timestamp |
| `renewalDate` | timestamp | Firestore timestamp |
| `lastVerifiedAt` | timestamp | Firestore timestamp |
| `isPublished` | boolean | `true` |
| `searchTokens` | array of strings | See below |

## Optional public fields

- `summary`
- `publicMessage`
- `publicNotice`
- `updatedAt`

Do not place private contact details, minor information, application answers, internal notes, incidents, or prayer requests in this collection.

## Authorization status values

```text
active
conditional
inactive
suspended
expired
closed
revoked
```

## Standing values

```text
good_standing
action_required
under_review
probationary
not_in_good_standing
```

## Search tokens

Search uses one normalized token and Firestore `array-contains`. Include lowercase terms that a visitor may reasonably enter:

```json
[
  "tpp-ch-2026-000001",
  "central",
  "high",
  "school",
  "little",
  "rock",
  "arkansas",
  "ar"
]
```

Use plain lowercase letters and numbers. Include common abbreviations, but do not include sensitive information.

## Direct verification URL

```text
https://chapter.ask4prayers.com/verify/TPP-CH-2026-000001
```

GitHub Pages redirects that path into the application's hash route. The verification page generates a QR code for the same stable address.
