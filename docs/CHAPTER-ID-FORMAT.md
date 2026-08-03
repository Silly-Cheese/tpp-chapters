# Chapter ID Format

Every official chapter ID begins with:

```text
TPP-CH-
```

The final section contains **1 to 32 letters and/or numbers**. The portal normalizes typed IDs to uppercase.

Valid examples:

```text
TPP-CH-ABC
TPP-CH-12345
TPP-CH-A1B2C3
```

Invalid examples include a blank suffix, spaces, punctuation, underscores, or an additional hyphen after the prefix.

The complete validation expression is:

```text
^TPP-CH-[A-Z0-9]{1,32}$
```

Existing chapter records should use their already-issued permanent ID as both the Firestore document ID and the `chapterId` field.
