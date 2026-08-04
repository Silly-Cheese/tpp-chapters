from pathlib import Path

BUILD_OLD = "20260803.10"
BUILD_NEW = "20260803.11"
changed = []


def save(path: Path, content: str) -> None:
    before = path.read_text(encoding="utf-8") if path.exists() else ""
    if before != content:
        path.write_text(content, encoding="utf-8")
        changed.append(str(path))


phase6_path = Path("assets/js/phase6.js")
phase6 = phase6_path.read_text(encoding="utf-8")

old_types = '''const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
]);'''
new_types = '''const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
]);
const FILE_TYPE_BY_EXTENSION = Object.freeze({
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg"
});'''
if old_types not in phase6:
    raise SystemExit("Could not find attachment type constants")
phase6 = phase6.replace(old_types, new_types, 1)

old_validate = '''function validateFiles(files) {
  const items = Array.from(files || []);
  if (items.length > FILE_LIMIT) throw new Error(`Attach no more than ${FILE_LIMIT} files.`);
  for (const file of items) {
    if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name} is not an approved file type.`);
    if (file.size > FILE_SIZE_LIMIT) throw new Error(`${file.name} is larger than 10 MB.`);
  }
  return items;
}'''
new_validate = '''function normalizedFileType(file) {
  const browserType = String(file?.type || "").trim().toLowerCase();
  if (ALLOWED_TYPES.has(browserType)) return browserType;
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  return FILE_TYPE_BY_EXTENSION[extension] || "";
}

function validateFiles(files) {
  const items = Array.from(files || []);
  if (items.length > FILE_LIMIT) throw new Error(`Attach no more than ${FILE_LIMIT} files.`);
  return items.map((file) => {
    const contentType = normalizedFileType(file);
    if (!contentType) throw new Error(`${file.name} is not an approved PDF, Word, PNG, or JPEG file.`);
    if (!Number.isFinite(file.size) || file.size <= 0) throw new Error(`${file.name} is empty and cannot be uploaded.`);
    if (file.size > FILE_SIZE_LIMIT) throw new Error(`${file.name} is larger than 10 MB.`);
    return { file, contentType };
  });
}

function attachmentErrorMessage(error, fileName = "The attachment") {
  const code = String(error?.code || "");
  const details = String(error?.message || error?.serverResponse || "");
  if (code === "storage/quota-exceeded" || /402|billing|blaze|spark|UserProjectAccountProblem/i.test(details)) {
    return `${fileName} could not be uploaded because Cloud Storage for Firebase requires the Blaze plan and an active billing account.`;
  }
  if (code === "storage/bucket-not-found" || /bucket.+not found/i.test(details)) {
    return `${fileName} could not be uploaded because the Firebase Storage bucket has not been created.`;
  }
  if (code === "storage/unauthorized" || code === "permission-denied") {
    return `${fileName} could not be uploaded because the live Storage Rules do not authorize this chapter account.`;
  }
  if (code === "storage/canceled") return `${fileName} upload was canceled.`;
  if (code === "storage/retry-limit-exceeded") return `${fileName} could not be uploaded after repeated network retries.`;
  return `${fileName} could not be uploaded. ${details || "Firebase Storage rejected the file."}`;
}'''
if old_validate not in phase6:
    raise SystemExit("Could not find attachment validation function")
phase6 = phase6.replace(old_validate, new_validate, 1)

old_upload = '''async function uploadMessageAttachments(ticket, messageId, files) {
  const uploaded = [];
  for (const file of files) {
    const fileName = `${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const uploaderType = SUPPORT_STAFF_ROLES.has(state.profile?.systemRole) ? "staff" : "chapter";
    const path = `support-attachments/${uploaderType}/${ticket.chapterId}/${ticket.id}/${messageId}/${state.user.uid}/${fileName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type, customMetadata: { ticketId: ticket.id, chapterId: ticket.chapterId, messageId, uploadedByUid: state.user.uid } });
    const downloadUrl = await getDownloadURL(storageRef);
    const attachmentRef = doc(collection(db, "supportTickets", ticket.id, "messages", messageId, "attachments"));
    await setDoc(attachmentRef, {
      ticketId: ticket.id,
      chapterId: ticket.chapterId,
      messageId,
      uploadedByUid: state.user.uid,
      fileName: file.name,
      storagePath: path,
      downloadUrl,
      contentType: file.type,
      size: file.size,
      createdAt: serverTimestamp()
    });
    uploaded.push(attachmentRef.id);
  }
  if (uploaded.length) await updateDoc(doc(db, "supportTickets", ticket.id, "messages", messageId), { hasAttachments: true, attachmentCount: uploaded.length });
}'''
new_upload = '''async function uploadMessageAttachments(ticket, messageId, files) {
  const uploaded = [];
  for (const item of files) {
    const file = item.file || item;
    const contentType = item.contentType || normalizedFileType(file);
    const fileName = `${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const uploaderType = SUPPORT_STAFF_ROLES.has(state.profile?.systemRole) ? "staff" : "chapter";
    const path = `support-attachments/${uploaderType}/${ticket.chapterId}/${ticket.id}/${messageId}/${state.user.uid}/${fileName}`;
    const storageRef = ref(storage, path);
    try {
      await uploadBytes(storageRef, file, {
        contentType,
        customMetadata: {
          ticketId: ticket.id,
          chapterId: ticket.chapterId,
          messageId,
          uploadedByUid: state.user.uid,
          originalFileName: safeFileName(file.name)
        }
      });
      const downloadUrl = await getDownloadURL(storageRef);
      const attachmentRef = doc(collection(db, "supportTickets", ticket.id, "messages", messageId, "attachments"));
      await setDoc(attachmentRef, {
        ticketId: ticket.id,
        chapterId: ticket.chapterId,
        messageId,
        uploadedByUid: state.user.uid,
        fileName: file.name,
        storagePath: path,
        downloadUrl,
        contentType,
        size: file.size,
        createdAt: serverTimestamp()
      });
      uploaded.push(attachmentRef.id);
    } catch (error) {
      const attachmentError = new Error(attachmentErrorMessage(error, file.name));
      attachmentError.code = error?.code || "attachment/upload-failed";
      attachmentError.cause = error;
      throw attachmentError;
    }
  }
  if (uploaded.length) {
    await updateDoc(doc(db, "supportTickets", ticket.id, "messages", messageId), {
      hasAttachments: true,
      attachmentCount: uploaded.length
    });
  }
}'''
if old_upload not in phase6:
    raise SystemExit("Could not find support attachment uploader")
phase6 = phase6.replace(old_upload, new_upload, 1)

old_create_intro = '''  submit.disabled = true;
  submit.textContent = "Creating ticket…";
  try {
    const ticketRef = doc(collection(db, "supportTickets"));'''
new_create_intro = '''  submit.disabled = true;
  submit.textContent = "Creating ticket…";
  let createdTicketId = "";
  let ticketCommitted = false;
  try {
    const ticketRef = doc(collection(db, "supportTickets"));
    createdTicketId = ticketRef.id;'''
if old_create_intro not in phase6:
    raise SystemExit("Could not find create-ticket introduction")
phase6 = phase6.replace(old_create_intro, new_create_intro, 1)

old_create_commit = '''    await batch.commit();
    if (files.length) await uploadMessageAttachments({ id: ticketRef.id, ...ticketData }, messageRef.id, files);
    navigate(`/chapter/support/ticket?id=${encodeURIComponent(ticketRef.id)}`);
  } catch (error) {
    console.error("Unable to create support ticket.", error);
    setAlert("p6-form-alert", "danger", "Ticket not created", error.message || "Firebase rejected the support request.");'''
new_create_commit = '''    await batch.commit();
    ticketCommitted = true;
    if (files.length) await uploadMessageAttachments({ id: ticketRef.id, ...ticketData }, messageRef.id, files);
    navigate(`/chapter/support/ticket?id=${encodeURIComponent(ticketRef.id)}`);
  } catch (error) {
    console.error("Unable to create support ticket.", error);
    if (ticketCommitted && createdTicketId) {
      setAlert("p6-form-alert", "warning", "Ticket created without its attachment", error.message || "The ticket was saved, but Firebase rejected the file upload.");
      setTimeout(() => navigate(`/chapter/support/ticket?id=${encodeURIComponent(createdTicketId)}`), 1800);
    } else {
      setAlert("p6-form-alert", "danger", "Ticket not created", error.message || "Firebase rejected the support request.");
    }'''
if old_create_commit not in phase6:
    raise SystemExit("Could not find create-ticket commit block")
phase6 = phase6.replace(old_create_commit, new_create_commit, 1)

old_send_intro = '''  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Sending…";
  try {'''
new_send_intro = '''  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Sending…";
  let messageCommitted = false;
  try {'''
if old_send_intro not in phase6:
    raise SystemExit("Could not find send-message introduction")
phase6 = phase6.replace(old_send_intro, new_send_intro, 1)

old_send_commit = '''    await batch.commit();
    if (files.length) await uploadMessageAttachments(ticket, messageRef.id, files);
    form.reset();
  } catch (error) {
    console.error("Unable to send support message.", error);
    toast("Message not sent", error.message || "Firebase rejected the reply.", "danger");'''
new_send_commit = '''    await batch.commit();
    messageCommitted = true;
    if (files.length) await uploadMessageAttachments(ticket, messageRef.id, files);
    form.reset();
  } catch (error) {
    console.error("Unable to send support message.", error);
    toast(messageCommitted ? "Message sent without its attachment" : "Message not sent", error.message || "Firebase rejected the reply.", messageCommitted ? "warning" : "danger");'''
if old_send_commit not in phase6:
    raise SystemExit("Could not find send-message commit block")
phase6 = phase6.replace(old_send_commit, new_send_commit, 1)
save(phase6_path, phase6)

storage_path = Path("storage.rules")
storage = storage_path.read_text(encoding="utf-8")
old_chapter_read = '''      allow read: if signedIn()
        && request.auth.uid == uid
        && chapterCanAccessSupportTicket(chapterId, ticketId);'''
new_shared_read = '''      allow read: if chapterCanAccessSupportTicket(chapterId, ticketId)
        || staffCanAccessSupportTicket(chapterId, ticketId);'''
if storage.count(old_chapter_read) != 1:
    raise SystemExit("Could not uniquely find chapter attachment read rule")
storage = storage.replace(old_chapter_read, new_shared_read, 1)
old_staff_read = '''      allow read: if signedIn()
        && request.auth.uid == uid
        && staffCanAccessSupportTicket(chapterId, ticketId);'''
if storage.count(old_staff_read) != 1:
    raise SystemExit("Could not uniquely find staff attachment read rule")
storage = storage.replace(old_staff_read, new_shared_read, 1)
save(storage_path, storage)

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8").replace(BUILD_OLD, BUILD_NEW)
save(index_path, index)

for validator in Path("scripts").glob("validate_*.py"):
    text = validator.read_text(encoding="utf-8")
    updated = text.replace(BUILD_OLD, BUILD_NEW)
    save(validator, updated)

validator_path = Path("scripts/validate_support_attachments.py")
validator = f'''from pathlib import Path
import sys

errors = []
phase6 = Path("assets/js/phase6.js").read_text(encoding="utf-8")
storage = Path("storage.rules").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")

for marker in (
    "FILE_TYPE_BY_EXTENSION",
    "normalizedFileType(file)",
    "Cloud Storage for Firebase requires the Blaze plan",
    "Ticket created without its attachment",
    "Message sent without its attachment",
    "originalFileName: safeFileName(file.name)",
):
    if marker not in phase6:
        errors.append(f"Missing attachment implementation marker: {{marker}}")

shared_read = "allow read: if chapterCanAccessSupportTicket(chapterId, ticketId)\\n        || staffCanAccessSupportTicket(chapterId, ticketId);"
if storage.count(shared_read) != 2:
    errors.append("Both chapter and staff attachment paths must be readable by authorized ticket participants")
if "request.auth.uid == uid\\n        && chapterCanAccessSupportTicket" in storage:
    errors.append("Chapter attachment reads are still restricted to the uploader")
if "request.auth.uid == uid\\n        && staffCanAccessSupportTicket" in storage:
    errors.append("Staff attachment reads are still restricted to the uploader")
if 'content="{BUILD_NEW}"' not in index:
    errors.append("Production build was not bumped to {BUILD_NEW}")

if errors:
    for error in errors:
        print(f"ERROR: {{error}}")
    sys.exit(1)
print("Support attachment validation passed.")
'''
save(validator_path, validator)

if not changed:
    raise SystemExit("No support attachment changes were applied")
print("Updated:")
for item in changed:
    print(f"- {item}")
