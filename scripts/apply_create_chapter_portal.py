from pathlib import Path
import re

BUILD = "20260803.6"
changed = []


def save(path: Path, before: str, after: str) -> None:
    if before != after:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))


path = Path("assets/js/phase4-admin.js")
before = path.read_text(encoding="utf-8")
text = before

text = text.replace(
    'const ADMIN_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin"]);\nconst CHAPTER_ID_PATTERN',
    'const ADMIN_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin"]);\nconst CREATE_CHAPTER_ROLES = new Set(["owner", "chapterAdmin"]);\nconst CHAPTER_ID_PATTERN',
    1,
)

helper_anchor = '''function recordName(record) {
  return record?.officialName || record?.chapterName || record?.name || state.chapterId;
}'''
helper_replacement = '''function recordName(record) {
  return record?.officialName || record?.chapterName || record?.name || state.chapterId;
}

function canCreateChapter() {
  return CREATE_CHAPTER_ROLES.has(state.profile?.systemRole);
}

function searchTokens(...values) {
  const tokens = new Set();
  values.forEach((value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return;
    tokens.add(normalized);
    normalized.split(/[^a-z0-9]+/).filter(Boolean).forEach((token) => tokens.add(token));
  });
  return Array.from(tokens).slice(0, 80);
}'''
if helper_anchor not in text:
    raise SystemExit("recordName helper anchor not found")
text = text.replace(helper_anchor, helper_replacement, 1)

text = text.replace(
    '<p>Initialize and maintain the private operational record used by Chapter Directors and Chapter Advisers.</p>',
    '<p>Create, initialize, and maintain the official records used by Chapter Directors and Chapter Advisers.</p>',
    1,
)

old_missing = '''function notPublishedState() {
  return `<section class="p4-admin-empty"><div>${icons.alert}</div><h2>Chapter registry record not found.</h2><p>Create or import this Chapter ID in <code>publicChapterRegistry</code> before initializing its private workspace. The record does not need to be publicly published.</p></section>`;
}'''
new_missing = '''function notPublishedState() {
  if (!canCreateChapter()) {
    return `<section class="p4-admin-empty"><div>${icons.alert}</div><h2>Chapter record not found.</h2><p>An Owner or Chapter Administrator must create ${escapeHTML(state.chapterId)} before its private workspace can be initialized.</p></section>`;
  }
  return `<section class="p4-admin-card p4-admin-create" id="p4a-create-chapter">
    <div class="p4-admin-card-head"><div><p class="p4-kicker">New official chapter</p><h2>Create ${escapeHTML(state.chapterId)}</h2><p>This creates the registry record and initializes the private Director and Adviser workspace automatically.</p></div>${icons.plus}</div>
    <div id="p4a-create-alert"></div>
    <form class="p4-admin-form" id="p4a-create-chapter-form">
      <div class="p4-admin-form-grid">
        <label><span>Permanent Chapter ID</span><input name="chapterId" value="${escapeHTML(state.chapterId)}" readonly></label>
        <label><span>Official chapter name</span><input name="officialName" maxlength="180" placeholder="The Prayer Project at Example School" required></label>
        <label><span>Host institution</span><input name="hostInstitutionName" maxlength="180" placeholder="Example School" required></label>
        <label><span>Institution type</span><select name="institutionType"><option value="school">School</option><option value="church">Church</option><option value="organization">Organization</option></select></label>
        <label><span>City</span><input name="city" maxlength="100"></label>
        <label><span>State</span><input name="state" maxlength="100"></label>
        <label><span>Country</span><input name="country" maxlength="100" value="United States"></label>
        <label><span>Service area</span><input name="serviceArea" maxlength="180" placeholder="School or community served"></label>
        <label><span>Authorization status</span><select name="authorizationStatus"><option value="active">Active</option><option value="conditional">Conditional</option><option value="inactive">Temporarily inactive</option></select></label>
        <label><span>Chapter standing</span><select name="standing"><option value="good_standing">Good standing</option><option value="action_required">Action required</option><option value="under_review">Under review</option><option value="probationary">Probationary standing</option></select></label>
        <label><span>Approval date</span><input type="date" name="approvalDate"></label>
        <label><span>Effective date</span><input type="date" name="effectiveDate"></label>
        <label><span>Renewal date</span><input type="date" name="renewalDate"></label>
      </div>
      <label><span>Public summary</span><textarea name="summary" rows="3" maxlength="1000" placeholder="Short description shown on the public verification record."></textarea></label>
      <label class="p4-admin-checkbox"><input type="checkbox" name="isPublished" checked><span>Publish this chapter in the public verification directory now</span></label>
      <button class="btn btn-primary" id="p4a-create-chapter-submit" type="submit">${icons.plus} Create chapter and workspace</button>
    </form>
  </section>`;
}'''
if old_missing not in text:
    raise SystemExit("notPublishedState anchor not found")
text = text.replace(old_missing, new_missing, 1)

create_function = '''async function createChapterFromPortal(form) {
  if (!canCreateChapter()) throw new Error("Only the Owner or a Chapter Administrator can create a chapter.");
  const button = form.querySelector("#p4a-create-chapter-submit");
  const values = Object.fromEntries(new FormData(form).entries());
  const chapterId = String(values.chapterId || state.chapterId).trim().toUpperCase();
  const officialName = String(values.officialName || "").trim();
  const hostInstitutionName = String(values.hostInstitutionName || "").trim();
  if (!CHAPTER_ID_PATTERN.test(chapterId)) throw new Error("The permanent Chapter ID is not valid.");
  if (officialName.length < 2 || hostInstitutionName.length < 2) throw new Error("Enter the official chapter name and host institution.");

  button.disabled = true;
  button.textContent = "Creating chapter…";
  try {
    const registryRef = doc(db, "publicChapterRegistry", chapterId);
    const chapterRef = doc(db, "chapters", chapterId);
    const [registrySnapshot, chapterSnapshot] = await Promise.all([getDoc(registryRef), getDoc(chapterRef)]);
    if (registrySnapshot.exists() || chapterSnapshot.exists()) {
      throw new Error("A chapter record already exists for this permanent Chapter ID. Reload the workspace instead of creating another record.");
    }

    const nowDate = new Date();
    const registryRecord = {
      chapterId,
      officialName,
      hostInstitutionName,
      institutionType: values.institutionType || "organization",
      city: String(values.city || "").trim(),
      state: String(values.state || "").trim(),
      country: String(values.country || "United States").trim() || "United States",
      serviceArea: String(values.serviceArea || "").trim(),
      authorizationStatus: values.authorizationStatus || "active",
      standing: values.standing || "good_standing",
      approvalDate: asDate(values.approvalDate),
      effectiveDate: asDate(values.effectiveDate),
      renewalDate: asDate(values.renewalDate),
      lastVerifiedAt: serverTimestamp(),
      summary: String(values.summary || "").trim(),
      publicMessage: "This chapter is recognized by The Prayer Project.",
      publicNotice: "",
      isPublished: form.isPublished.checked,
      searchTokens: searchTokens(chapterId, officialName, hostInstitutionName, values.city, values.state, values.country, values.serviceArea),
      createdAt: serverTimestamp(),
      createdByUid: state.user.uid,
      updatedAt: serverTimestamp(),
      updatedByUid: state.user.uid
    };

    const batch = writeBatch(db);
    batch.set(registryRef, registryRecord);
    batch.set(doc(collection(db, "auditLogs")), {
      actorUid: state.user.uid,
      action: "chapter_created",
      targetType: "chapter",
      targetId: chapterId,
      summary: `Created ${officialName} (${chapterId}) from the administration portal`,
      createdAt: serverTimestamp()
    });
    await batch.commit();

    state.chapterId = chapterId;
    state.publicChapter = {
      id: chapterId,
      ...registryRecord,
      lastVerifiedAt: nowDate,
      createdAt: nowDate,
      updatedAt: nowDate
    };
    toast("Chapter record created", `${chapterId} was created. Initializing its private workspace now.`);
    await initializeWorkspace(button);
  } catch (error) {
    console.error(error);
    toast("Chapter creation failed", error?.code === "permission-denied" ? "Your account cannot create registry records. Sign in as the Owner or a Chapter Administrator." : error.message || "Firestore rejected the chapter record.");
    button.disabled = false;
    button.innerHTML = `${icons.plus} Create chapter and workspace`;
  }
}

'''
init_anchor = 'async function initializeWorkspace(button) {'
if init_anchor not in text:
    raise SystemExit("initializeWorkspace anchor not found")
text = text.replace(init_anchor, create_function + init_anchor, 1)

bind_anchor = '''  document.querySelector("#p4a-load-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadWorkspace(event.currentTarget.chapterId.value);
  });'''
bind_replacement = bind_anchor + '''
  document.querySelector("#p4a-create-chapter-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await createChapterFromPortal(event.currentTarget); } catch (error) { console.error(error); toast("Unable to create chapter", error.message); }
  });'''
if bind_anchor not in text:
    raise SystemExit("load form binding anchor not found")
text = text.replace(bind_anchor, bind_replacement, 1)

save(path, before, text)

index_path = Path("index.html")
index_before = index_path.read_text(encoding="utf-8")
index_after = re.sub(r'20260803\.5', BUILD, index_before)
save(index_path, index_before, index_after)

doc_path = Path("docs/CREATE-CHAPTER-FROM-PORTAL.md")
doc_content = '''# Create a Chapter from the Portal

Owners and Chapter Administrators can create an official chapter without opening the Firebase Console.

1. Open `/#/admin/chapter-workspaces`.
2. Enter the permanent Chapter ID and select **Load workspace**.
3. When no chapter exists, complete the **Create chapter** form.
4. Choose whether the record should be visible in the public verification directory immediately.
5. Select **Create chapter and workspace**.

The portal creates `publicChapterRegistry/{chapterId}`, records an audit event, initializes `chapters/{chapterId}`, creates the standard compliance requirements, and publishes the welcome notice. The chapter is then ready for Director or Adviser invitations.

Chapter creation is limited to the Owner and Chapter Administrator roles. Compliance Administrators can manage an existing private workspace but cannot create or publish a public registry record.

No composite indexes are required. This feature uses the existing registry and workspace permissions, so no additional Firebase Rules deployment is required after the current rules are already deployed.
'''
doc_before = doc_path.read_text(encoding="utf-8") if doc_path.exists() else ""
save(doc_path, doc_before, doc_content)

validator_path = Path("scripts/validate_create_chapter_portal.py")
validator_content = '''from pathlib import Path
import re
import sys

errors = []
phase4 = Path("assets/js/phase4-admin.js").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")

required = [
    'const CREATE_CHAPTER_ROLES = new Set(["owner", "chapterAdmin"])',
    'function canCreateChapter()',
    'function searchTokens(...values)',
    'id="p4a-create-chapter-form"',
    'async function createChapterFromPortal(form)',
    'Create chapter and workspace',
    'batch.set(registryRef, registryRecord)',
    'action: "chapter_created"',
    'await initializeWorkspace(button)',
]
for marker in required:
    if marker not in phase4:
        errors.append(f"Missing portal chapter creation marker: {marker}")

if 'Create or import this Chapter ID in <code>publicChapterRegistry</code>' in phase4:
    errors.append("The portal still instructs administrators to create the chapter manually in Firestore")
if '20260803.6' not in index:
    errors.append("Production assets were not bumped to build 20260803.6")

build_match = re.search(r'<meta name="tpp-build" content="([^"]+)">', index)
if not build_match:
    errors.append("Missing build marker")
else:
    build = build_match.group(1)
    for asset, version in re.findall(r'(?:href|src)="(assets/[^"?]+\\.(?:css|js))\\?v=([^"]+)"', index):
        if version != build:
            errors.append(f"Asset {asset} uses {version}, expected {build}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Create-chapter portal validation passed.")
'''
validator_before = validator_path.read_text(encoding="utf-8") if validator_path.exists() else ""
save(validator_path, validator_before, validator_content)

workflow_path = Path(".github/workflows/validate.yml")
workflow_before = workflow_path.read_text(encoding="utf-8")
workflow_after = workflow_before
step = '''

      - name: Validate portal chapter creation
        run: python3 scripts/validate_create_chapter_portal.py'''
if "Validate portal chapter creation" not in workflow_after:
    workflow_after += step + "\n"
save(workflow_path, workflow_before, workflow_after)

if not changed:
    raise SystemExit("No portal chapter creation changes were applied")

print("Updated:")
for item in changed:
    print(f"- {item}")
