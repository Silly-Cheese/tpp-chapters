from pathlib import Path
import re

BUILD = "20260803.7"
changed = []


def save(path: Path, before: str, after: str) -> None:
    if before != after:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing expected migration anchor: {label}")
    return text.replace(old, new, 1)


# Phase 3: activation code + assigned email + password, with no email-message dependency.
path = Path("assets/js/phase3.js")
before = path.read_text(encoding="utf-8")
text = before
for line in ("  getIdToken,\n", "  reload,\n", "  sendEmailVerification,\n"):
    text = text.replace(line, "", 1)
text = require_replace(
    text,
    '<div>${icons.mail}<span><strong>Email verified</strong> Chapter accounts must verify their assigned email address.</span></div>',
    '<div>${icons.mail}<span><strong>Assigned email</strong> The invitation fixes the login email and chapter role before account creation.</span></div>',
    "Phase 3 trust copy",
)
text, count = re.subn(
    r'function verifyEmailPage\(\) \{.*?\n\}\n\nasync function getOwnMemberships\(\)',
    '''function verifyEmailPage() {
  queueMicrotask(() => navigate("/activation-complete"));
  return phase3PublicLayout(`<section class="phase3-card phase3-message-card"><div class="spinner"></div><h1>Opening your activated account…</h1><p>Email verification is not required for invitation-based chapter access.</p></section>`, { compact: true });
}

async function getOwnMemberships()''',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not replace the email verification page")
text, count = re.subn(
    r'\n  if \(CHAPTER_ROLES\.has\(phase3State\.profile\?\.systemRole\) && !phase3State\.user\.emailVerified\) \{.*?\n  \}',
    "",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not remove the activation-complete verification gate")
text = require_replace(
    text,
    '''    await claimInvitation({ user: createdUser, displayName });
    try {
      await sendEmailVerification(createdUser, { url: `${location.origin}/#/verify-email` });
    } catch (verificationError) {
      console.warn("Account activated, but the first verification email could not be sent.", verificationError);
    }
    navigate("/verify-email");''',
    '''    await claimInvitation({ user: createdUser, displayName });
    navigate("/activation-complete");''',
    "new-account activation completion",
)
text = require_replace(
    text,
    '''    await claimInvitation({ user: credential.user, displayName });
    if (!credential.user.emailVerified) {
      try {
        await sendEmailVerification(credential.user, { url: `${location.origin}/#/verify-email` });
      } catch (verificationError) {
        console.warn("Invitation claimed, but the verification email could not be sent.", verificationError);
      }
      navigate("/verify-email");
    } else {
      navigate("/activation-complete");
    }''',
    '''    await claimInvitation({ user: credential.user, displayName });
    navigate("/activation-complete");''',
    "existing-account activation completion",
)
text, count = re.subn(
    r'\nasync function checkEmailVerification\(button\) \{.*?\n\}\n\nasync function resendVerification\(button\) \{.*?\n\}\n',
    "\n",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not remove verification email handlers")
text = require_replace(
    text,
    '  if (!target || !phase3State.user?.emailVerified) return;',
    '  if (!target || !phase3State.user) return;',
    "membership summary verification gate",
)
text, count = re.subn(
    r'\n  if \(phase3State\.user && phase3State\.profile && CHAPTER_ROLES\.has\(phase3State\.profile\.systemRole\) && !phase3State\.user\.emailVerified\) \{.*?\n  \}',
    "",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not remove base portal verification redirect")
text = text.replace('      if (action === "check-verification") await checkEmailVerification(element);\n', "")
text = text.replace('      if (action === "resend-verification") await resendVerification(element);\n', "")
text = text.replace('? "Verify Email | The Prayer Project"', '? "Account Activated | The Prayer Project"')
save(path, before, text)

# Phase 4: load and render memberships for every valid activated chapter account.
path = Path("assets/js/phase4.js")
before = path.read_text(encoding="utf-8")
text = before.replace('  if (!state.user?.emailVerified) return;\n', "", 1)
text = text.replace('''    if (!state.user.emailVerified && CHAPTER_PROFILE_ROLES.has(state.profile?.systemRole)) {
      location.hash = "/verify-email";
      return;
    }
''', "", 1)
text = require_replace(
    text,
    '''    if (user?.emailVerified) {
      await loadMemberships();
      if (state.selectedChapterId) await loadChapterWorkspace(state.selectedChapterId, { rerender: false });
    } else {
      state.memberships = [];
      state.selectedChapterId = null;
    }''',
    '''    if (user && CHAPTER_PROFILE_ROLES.has(state.profile?.systemRole)) {
      await loadMemberships();
      if (state.selectedChapterId) await loadChapterWorkspace(state.selectedChapterId, { rerender: false });
    } else {
      state.memberships = [];
      state.selectedChapterId = null;
    }''',
    "Phase 4 authentication initialization",
)
save(path, before, text)

# Phase 5: operational workflows use active invitation membership, not inbox verification.
path = Path("assets/js/phase5.js")
before = path.read_text(encoding="utf-8")
text = before.replace('  if (!state.user?.emailVerified) return;\n', "", 1)
text = text.replace(
    'if (!state.user || !state.profile || !CHAPTER_ROLES.has(state.profile.systemRole) || !state.user.emailVerified) return;',
    'if (!state.user || !state.profile || !CHAPTER_ROLES.has(state.profile.systemRole)) return;',
    1,
)
text = text.replace(
    'if (!state.profile || !CHAPTER_ROLES.has(state.profile.systemRole) || !state.user.emailVerified) {',
    'if (!state.profile || !CHAPTER_ROLES.has(state.profile.systemRole)) {',
    1,
)
text = text.replace('A verified Director or Adviser account is required.', 'An active Director or Adviser account is required.')
text = text.replace(
    'if (user?.emailVerified && CHAPTER_ROLES.has(state.profile?.systemRole)) await loadMemberships();',
    'if (user && CHAPTER_ROLES.has(state.profile?.systemRole)) await loadMemberships();',
    1,
)
save(path, before, text)

# Phase 6: support and communications follow the same invitation-based membership model.
path = Path("assets/js/phase6.js")
before = path.read_text(encoding="utf-8")
text = before.replace('  if (!state.user?.emailVerified) return;\n', "", 1)
text = text.replace(
    'if (!state.profile || !CHAPTER_ROLES.has(state.profile.systemRole) || !state.user.emailVerified) {',
    'if (!state.profile || !CHAPTER_ROLES.has(state.profile.systemRole)) {',
    1,
)
text = text.replace('A verified Chapter Director or Adviser account is required.', 'An active Chapter Director or Adviser account is required.')
text = text.replace(
    'if (user?.emailVerified && CHAPTER_ROLES.has(state.profile?.systemRole)) await loadMemberships();',
    'if (user && CHAPTER_ROLES.has(state.profile?.systemRole)) await loadMemberships();',
    1,
)
save(path, before, text)

# Base profile: explain the actual activation method rather than showing an unused verification state.
path = Path("assets/js/app.js")
before = path.read_text(encoding="utf-8")
text = before.replace(
    '<div class="detail-row"><dt>Email verified</dt><dd>${state.user.emailVerified ? "Yes" : "Not yet"}</dd></div>',
    '<div class="detail-row"><dt>Activation method</dt><dd>Single-use invitation code</dd></div>',
    1,
)
save(path, before, text)

# Firestore: active profile + active chapter membership is the authorization boundary.
path = Path("firestore.rules")
before = path.read_text(encoding="utf-8")
text = before
text, count = re.subn(
    r'''\n    function chapterRoleRequiresVerifiedEmail\(\) \{.*?\n    \}\n\n    function hasRequiredEmailVerification\(\) \{.*?\n    \}\n''',
    "\n",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not remove Firestore email-verification helper functions")
text = require_replace(
    text,
    '''    function isActive() {
      return hasUserRecord()
        && currentUser().accountStatus == 'active'
        && hasRequiredEmailVerification();
    }''',
    '''    function isActive() {
      return hasUserRecord()
        && currentUser().accountStatus == 'active';
    }''',
    "Firestore active-user helper",
)
text = text.replace('        && request.auth.token.email_verified == true\n', "")
save(path, before, text)

# Storage: active chapter membership is enough for approved uploads and downloads.
path = Path("storage.rules")
before = path.read_text(encoding="utf-8")
text = before.replace('        && request.auth.token.email_verified == true\n', "")
save(path, before, text)

# Cache-bust every production entry asset.
path = Path("index.html")
before = path.read_text(encoding="utf-8")
text = re.sub(r'<meta name="tpp-build" content="[^"]+">', f'<meta name="tpp-build" content="{BUILD}">', before)
text = re.sub(r'\?v=[0-9.]+"', f'?v={BUILD}"', text)
save(path, before, text)

# Current operating guidance.
path = Path("docs/INVITATION-CODE-ACTIVATION.md")
content = '''# Invitation-Code Account Activation

Chapter accounts do not depend on outbound verification email.

The approved activation sequence is:

1. An Owner or Chapter Administrator creates a Director or Adviser invitation.
2. The recipient enters the single-use activation code.
3. The portal fixes the assigned email, chapter, and role from the invitation.
4. The recipient creates a password or signs in to an existing account using that assigned email.
5. Firestore atomically claims the invitation, activates the profile, and creates the chapter membership.
6. The account can immediately open the chapter portal.

The activation code is the approval credential. It is displayed only once to the administrator and only its SHA-256 hash is stored in Firestore. Email verification is not required for chapter access.

After this change, deploy both rulesets:

```bash
firebase deploy --only firestore:rules,storage
```

No composite indexes are required.
'''
before = path.read_text(encoding="utf-8") if path.exists() else ""
save(path, before, content)

# Permanent regression validation, added to CI separately after migration.
path = Path("scripts/validate_no_email_verification.py")
content = '''from pathlib import Path
import sys

errors = []
scan = [*Path("assets/js").glob("*.js"), Path("firestore.rules"), Path("storage.rules")]
for path in scan:
    text = path.read_text(encoding="utf-8")
    for marker in ("sendEmailVerification", "emailVerified", "email_verified", "hasRequiredEmailVerification", "chapterRoleRequiresVerifiedEmail"):
        if marker in text:
            errors.append(f"{path} still contains the removed email-verification dependency: {marker}")

phase3 = Path("assets/js/phase3.js").read_text(encoding="utf-8")
for marker in (
    'navigate("/activation-complete")',
    "Email verification is not required for invitation-based chapter access.",
    "Single-use invitation code",
):
    if marker not in phase3 and marker != "Single-use invitation code":
        errors.append(f"Phase 3 is missing: {marker}")

app = Path("assets/js/app.js").read_text(encoding="utf-8")
if "Single-use invitation code" not in app:
    errors.append("The account profile does not explain the invitation-code activation method")

rules = Path("firestore.rules").read_text(encoding="utf-8")
if "currentUser().accountStatus == 'active';" not in rules:
    errors.append("Firestore isActive() was not simplified to active-profile authorization")
if "function hasChapterMembership(chapterId)" not in rules:
    errors.append("Firestore chapter-membership authorization is missing")

index = Path("index.html").read_text(encoding="utf-8")
if 'content="20260803.7"' not in index:
    errors.append("The production build was not cache-busted to 20260803.7")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Invitation-code activation validation passed.")
'''
before = path.read_text(encoding="utf-8") if path.exists() else ""
save(path, before, content)

if not changed:
    raise SystemExit("No email-verification migration changes were applied")

print("Updated:")
for item in changed:
    print(f"- {item}")
