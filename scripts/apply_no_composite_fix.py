from pathlib import Path
import json
import re


def replace_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected exactly one match for {label}; found {count}.")
    return updated


app_path = Path("assets/js/app.js")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    r'''\s{4}const registryQuery = query\(\n.*?\n\s{4}root\.innerHTML = records\.length \? searchResultsMarkup\(records, searchTerm\) : registryNoMatches\(searchTerm\);''',
    '''    const snapshot = await getDocs(query(
      collection(db, "publicChapterRegistry"),
      where("isPublished", "==", true)
    ));
    const normalizedPhrase = searchTerm.toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "");
    const records = snapshot.docs
      .map(recordFromSnapshot)
      .filter((record) => {
        const searchable = [
          record.chapterId,
          record.officialName,
          record.hostInstitutionName,
          record.city,
          record.state,
          record.country,
          ...(Array.isArray(record.searchTokens) ? record.searchTokens : [])
        ].join(" ").toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "");
        return searchable.includes(normalizedPhrase) || searchable.split(/\\s+/).includes(token);
      })
      .sort((a, b) => String(a.officialName || a.chapterId).localeCompare(String(b.officialName || b.chapterId)))
      .slice(0, 20);
    root.innerHTML = records.length ? searchResultsMarkup(records, searchTerm) : registryNoMatches(searchTerm);''',
    "public registry search",
    re.S,
)
app = replace_once(
    app,
    r'''async function loadDirectory\(\{ reset = false \} = \{\}\) \{.*?\n\}\n\nfunction directoryMarkup\(\) \{''',
    '''async function loadDirectory({ reset = false } = {}) {
  const root = document.querySelector("#directory-results");
  if (!root || state.directory.loading) return;
  if (reset) {
    state.directory = { records: [], cursor: null, hasMore: false, loading: false, loaded: false, error: null };
    root.innerHTML = registryLoading("Loading published chapters…");
  }
  state.directory.loading = true;
  try {
    const snapshot = await getDocs(query(
      collection(db, "publicChapterRegistry"),
      where("isPublished", "==", true)
    ));
    state.directory.records = snapshot.docs
      .map(recordFromSnapshot)
      .sort((a, b) => String(a.officialName || a.chapterId).localeCompare(String(b.officialName || b.chapterId)));
    state.directory.cursor = null;
    state.directory.hasMore = false;
    state.directory.loaded = true;
    root.innerHTML = directoryMarkup();
    bindDynamicRegistryEvents();
  } catch (error) {
    console.error("Unable to load chapter directory.", error);
    state.directory.error = error;
    root.innerHTML = registryError("Directory unavailable", "The directory could not be loaded. Confirm that the public registry rules are deployed.");
  } finally {
    state.directory.loading = false;
  }
}

function directoryMarkup() {''',
    "directory loader",
    re.S,
)
app = app.replace(
    "The required Firestore index may still be building or the security rules may not be deployed.",
    "The public registry rules may not be deployed or the service may be temporarily unavailable.",
)
app = app.replace(
    "Confirm that the public registry index and security rules are deployed.",
    "Confirm that the public registry rules are deployed.",
)
app_path.write_text(app, encoding="utf-8")

phase6_path = Path("assets/js/phase6.js")
phase6 = phase6_path.read_text(encoding="utf-8")
phase6 = replace_once(
    phase6,
    r'''\s{2}const shared = query\(collection\(db, "supportTickets"\), where\("accessKeys", "array-contains", `chapter:\$\{state\.selectedChapterId\}`\)\);\n\s{2}const personal = query\(collection\(db, "supportTickets"\), where\("accessKeys", "array-contains", `user:\$\{state\.user\.uid\}`\)\);''',
    '''  const shared = query(
    collection(db, "supportTickets"),
    where("chapterId", "==", state.selectedChapterId),
    where("visibility", "==", "chapter")
  );
  const personal = query(
    collection(db, "supportTickets"),
    where("chapterId", "==", state.selectedChapterId),
    where("visibility", "==", "adviser_private"),
    where("createdByUid", "==", state.user.uid)
  );''',
    "chapter support queries",
)
phase6 = replace_once(
    phase6,
    r'''\s{4}const path = `support-attachments/\$\{ticket\.chapterId\}/\$\{ticket\.id\}/\$\{messageId\}/\$\{state\.user\.uid\}/\$\{fileName\}`;''',
    '''    const uploaderType = SUPPORT_STAFF_ROLES.has(state.profile?.systemRole) ? "staff" : "chapter";
    const path = `support-attachments/${uploaderType}/${ticket.chapterId}/${ticket.id}/${messageId}/${state.user.uid}/${fileName}`;''',
    "support attachment path",
)
phase6_path.write_text(phase6, encoding="utf-8")
Path("assets/js/phase6-loader.js").write_text('import "./phase6.js";\n', encoding="utf-8")

phase8_path = Path("assets/js/phase8.js")
phase8 = phase8_path.read_text(encoding="utf-8")
phase8 = replace_once(
    phase8,
    r'''(\s{2}limit,\n\s{2}query)(\n\} from "https://www\.gstatic\.com/firebasejs/12\.17\.0/firebase-firestore\.js";)''',
    r'''\1,\n  where\2''',
    "Phase 8 Firestore where import",
)
phase8 = replace_once(
    phase8,
    r'''\s{2}for \(const collectionName of COLLECTION_CHECKS\) \{\n\s{4}try \{\n\s{6}await getDocs\(query\(collection\(db, collectionName\), limit\(1\)\)\);\n\s{6}add\(`Firestore: \$\{collectionName\}`, "pass", "The current administrator can read this collection\."\);\n\s{4}\} catch \(error\) \{\n\s{6}add\(`Firestore: \$\{collectionName\}`, "fail", error\?\.message \|\| "Firestore denied or failed this collection read\."\);\n\s{4}\}\n\s{2}\}''',
    '''  for (const collectionName of COLLECTION_CHECKS) {
    try {
      const healthQuery = collectionName === "publicChapterRegistry"
        ? query(collection(db, collectionName), where("isPublished", "==", true), limit(1))
        : query(collection(db, collectionName), limit(1));
      await getDocs(healthQuery);
      add(`Firestore: ${collectionName}`, "pass", "The current administrator can perform the read used by this portal area.");
    } catch (error) {
      add(`Firestore: ${collectionName}`, "fail", error?.message || "Firestore denied or failed this portal read.");
    }
  }''',
    "Phase 8 health Firestore loop",
)
phase8_path.write_text(phase8, encoding="utf-8")

rules_path = Path("firestore.rules")
rules = rules_path.read_text(encoding="utf-8")
if "allow read: if canManageSupport();\n      allow read: if canAccessSupportTicketData(resource.data);" not in rules:
    rules = replace_once(
        rules,
        r'''(\s{4}match /supportTickets/\{ticketId\} \{\n)\s{6}allow read: if canAccessSupportTicketData\(resource\.data\);''',
        r'''\1      allow read: if canManageSupport();
      allow read: if canAccessSupportTicketData(resource.data);''',
        "support administrator read rule",
    )
rules_path.write_text(rules, encoding="utf-8")

Path("firestore.indexes.json").write_text(
    json.dumps({"indexes": [], "fieldOverrides": []}, indent=2) + "\n",
    encoding="utf-8",
)

markdown_files = [Path("README.md"), *Path("docs").glob("*.md"), *Path(".").glob("PHASE-*-NOTES.md")]
for path in markdown_files:
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "firebase deploy --only firestore:rules,firestore:indexes,storage",
        "firebase deploy --only firestore:rules,storage",
    )
    path.write_text(text, encoding="utf-8")

readme_path = Path("README.md")
readme = readme_path.read_text(encoding="utf-8")
note = """## Firestore indexes

The portal does not require custom composite indexes. Registry search and sorting use a single-field published-record query followed by client-side filtering and sorting. Support-ticket access uses equality filters that Firestore serves through automatic single-field indexes and index merging.

"""
if note not in readme:
    readme = readme.replace("## Required Firebase setup", note + "## Required Firebase setup", 1)
readme_path.write_text(readme, encoding="utf-8")

print("Applied no-composite-index patch.")
