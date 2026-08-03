const sourceUrl = new URL("./phase6.js", import.meta.url);
const firebaseUrl = new URL("./firebase.js", import.meta.url).href;

const response = await fetch(sourceUrl, { cache: "no-store" });
if (!response.ok) {
  throw new Error(`Unable to load Phase 6 communications module (${response.status}).`);
}

let source = await response.text();

const originalQueries = `  const shared = query(collection(db, "supportTickets"), where("accessKeys", "array-contains", \`chapter:\${state.selectedChapterId}\`));
  const personal = query(collection(db, "supportTickets"), where("accessKeys", "array-contains", \`user:\${state.user.uid}\`));`;

const securedQueries = `  const shared = query(
    collection(db, "supportTickets"),
    where("chapterId", "==", state.selectedChapterId),
    where("visibility", "==", "chapter"),
    where("accessKeys", "array-contains", \`chapter:\${state.selectedChapterId}\`)
  );
  const personal = query(
    collection(db, "supportTickets"),
    where("chapterId", "==", state.selectedChapterId),
    where("visibility", "==", "adviser_private"),
    where("createdByUid", "==", state.user.uid),
    where("accessKeys", "array-contains", \`user:\${state.user.uid}\`)
  );`;

const originalAttachmentPath = `    const path = \`support-attachments/\${ticket.chapterId}/\${ticket.id}/\${messageId}/\${state.user.uid}/\${fileName}\`;`;
const securedAttachmentPath = `    const uploaderType = SUPPORT_STAFF_ROLES.has(state.profile?.systemRole) ? "staff" : "chapter";
    const path = \`support-attachments/\${uploaderType}/\${ticket.chapterId}/\${ticket.id}/\${messageId}/\${state.user.uid}/\${fileName}\`;`;

if (!source.includes(originalQueries) || !source.includes(originalAttachmentPath)) {
  throw new Error("Phase 6 source compatibility check failed. Refresh after the deployment completes.");
}

source = source
  .replace(originalQueries, securedQueries)
  .replace(originalAttachmentPath, securedAttachmentPath)
  .replace('from "./firebase.js";', `from "${firebaseUrl}";`)
  .concat(`\n//# sourceURL=${sourceUrl.href}\n`);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
