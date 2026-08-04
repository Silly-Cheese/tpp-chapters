from pathlib import Path
import json
import re

OLD_BUILD = "20260803.11"
NEW_BUILD = "20260803.12"
changed = []


def save(path: Path, text: str) -> None:
    before = path.read_text(encoding="utf-8") if path.exists() else ""
    if before != text:
        path.write_text(text, encoding="utf-8")
        changed.append(str(path))


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Could not find {label}")
    return text.replace(old, new, 1)


# Firebase core: remove Cloud Storage entirely.
firebase_path = Path("assets/js/firebase.js")
firebase = firebase_path.read_text(encoding="utf-8")
firebase = firebase.replace('import { getStorage } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js";\n', '')
firebase = firebase.replace('  storageBucket: "tpp-chapters.firebasestorage.app",\n', '')
firebase = firebase.replace('export const storage = getStorage(firebaseApp);\n', '')
save(firebase_path, firebase)

config_path = Path("firebase.json")
config = json.loads(config_path.read_text(encoding="utf-8"))
config.pop("storage", None)
save(config_path, json.dumps(config, indent=2) + "\n")

# Phase 5 submissions.
p5_path = Path("assets/js/phase5.js")
p5 = p5_path.read_text(encoding="utf-8")
p5_storage_import = '''import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js";
import { auth, db, storage, authPersistenceReady } from "./firebase.js";'''
p5_shared_import = '''import { auth, db, authPersistenceReady } from "./firebase.js";
import {
  ATTACHMENT_FILE_LIMIT,
  ATTACHMENT_MAX_BYTES,
  deleteFirestoreAttachment,
  downloadFirestoreAttachment,
  saveFirestoreAttachment,
  validateAttachmentFiles
} from "./firestore-attachments.js";'''
p5 = replace_once(p5, p5_storage_import, p5_shared_import, "Phase 5 Storage import")
p5 = re.sub(
    r'const FILE_LIMIT = 5;\nconst FILE_SIZE_LIMIT = 10 \* 1024 \* 1024;\nconst ALLOWED_TYPES = new Set\(\[.*?\]\);',
    'const FILE_LIMIT = ATTACHMENT_FILE_LIMIT;\nconst FILE_SIZE_LIMIT = ATTACHMENT_MAX_BYTES;',
    p5,
    count=1,
    flags=re.S,
)
p5 = replace_once(
    p5,
    '''function attachmentsMarkup(item) {
  if (!item.id || !state.attachments.length) return `<div class="p5-attachment-list"><p>No files attached yet.</p></div>`;
  return `<div class="p5-attachment-list">${state.attachments.map((attachment) => `<article><div>${icons.attachment}<span><strong>${escapeHTML(attachment.fileName)}</strong><small>${Math.max(1, Math.round((attachment.size || 0) / 1024))} KB</small></span></div><div><a class="btn btn-secondary" href="${escapeHTML(attachment.downloadUrl)}" target="_blank" rel="noopener">Open</a>${EDITABLE_STATUSES.has(item.status) && item.submittedByUid === state.user.uid ? `<button class="btn btn-secondary" type="button" data-p5-action="delete-attachment" data-id="${escapeHTML(attachment.id)}">Remove</button>` : ""}</div></article>`).join("")}</div>`;
}''',
    '''function attachmentsMarkup(item) {
  if (!item.id || !state.attachments.length) return `<div class="p5-attachment-list"><p>No files attached yet.</p></div>`;
  return `<div class="p5-attachment-list">${state.attachments.map((attachment) => `<article><div>${icons.attachment}<span><strong>${escapeHTML(attachment.fileName)}</strong><small>${Math.max(1, Math.round((attachment.size || 0) / 1024))} KB · Private Firestore file</small></span></div><div><button class="btn btn-secondary" type="button" data-p5-action="download-attachment" data-id="${escapeHTML(attachment.id)}" data-file-name="${escapeHTML(attachment.fileName)}" data-content-type="${escapeHTML(attachment.contentType)}">Download</button>${EDITABLE_STATUSES.has(item.status) && item.submittedByUid === state.user.uid ? `<button class="btn btn-secondary" type="button" data-p5-action="delete-attachment" data-id="${escapeHTML(attachment.id)}">Remove</button>` : ""}</div></article>`).join("")}</div>`;
}''',
    "Phase 5 attachment markup",
)
p5 = re.sub(
    r'function validateFiles\(files, existingCount = 0\) \{.*?\n\}\n\nasync function uploadAttachments\(submissionId, files\) \{.*?\n\}\n',
    '''function validateFiles(files, existingCount = 0) {
  return validateAttachmentFiles(files, existingCount);
}

async function uploadAttachments(submissionId, files) {
  const uploaded = [];
  for (const item of files) {
    const attachmentRef = doc(collection(db, "chapterSubmissions", submissionId, "attachments"));
    await saveFirestoreAttachment({
      db,
      attachmentRef,
      item,
      metadata: {
        chapterId: state.selectedChapterId,
        submissionId,
        uploadedByUid: state.user.uid
      }
    });
    uploaded.push(attachmentRef.id);
  }
  return uploaded;
}
''',
    p5,
    count=1,
    flags=re.S,
)
p5 = replace_once(
    p5,
    '  const files = Array.from(document.querySelector("#p5-files")?.files || []);\n  try {\n    if (!form.reportValidity()) return;\n    validateFiles(files, state.attachments.length);',
    '  const selectedFiles = Array.from(document.querySelector("#p5-files")?.files || []);\n  let files = [];\n  try {\n    if (!form.reportValidity()) return;\n    files = validateFiles(selectedFiles, state.attachments.length);',
    "Phase 5 file selection",
)
p5 = replace_once(
    p5,
    '''  await deleteObject(ref(storage, attachment.storagePath));
  await deleteDoc(doc(db, "chapterSubmissions", state.currentSubmission.id, "attachments", id));''',
    '''  await deleteFirestoreAttachment({
    db,
    attachmentRef: doc(db, "chapterSubmissions", state.currentSubmission.id, "attachments", id)
  });''',
    "Phase 5 attachment deletion",
)
p5 = replace_once(
    p5,
    '''async function loadAdminAttachments(id) {
  const target = document.querySelector("#p5-admin-attachments");
  if (!target) return;
  target.innerHTML = `<div class="spinner"></div>`;
  const snapshot = await getDocs(collection(db, "chapterSubmissions", id, "attachments"));
  const attachments = snapshot.docs.map((item) => item.data());
  target.innerHTML = attachments.length ? attachments.map((attachment) => `<a href="${escapeHTML(attachment.downloadUrl)}" target="_blank" rel="noopener">${icons.attachment}<span><strong>${escapeHTML(attachment.fileName)}</strong><small>${Math.max(1, Math.round((attachment.size || 0) / 1024))} KB</small></span></a>`).join("") : `<p>No attachments.</p>`;
}''',
    '''async function downloadSubmissionAttachment(submissionId, attachmentId, fileName, contentType, button = null) {
  if (button) button.disabled = true;
  try {
    await downloadFirestoreAttachment({
      attachmentRef: doc(db, "chapterSubmissions", submissionId, "attachments", attachmentId),
      fileName,
      contentType
    });
  } catch (error) {
    alert(error.message || "The attachment could not be downloaded.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadAdminAttachments(id) {
  const target = document.querySelector("#p5-admin-attachments");
  if (!target) return;
  target.innerHTML = `<div class="spinner"></div>`;
  const snapshot = await getDocs(collection(db, "chapterSubmissions", id, "attachments"));
  const attachments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  target.innerHTML = attachments.length ? attachments.map((attachment) => `<button class="btn btn-secondary" type="button" data-p5-admin-download data-submission-id="${escapeHTML(id)}" data-id="${escapeHTML(attachment.id)}" data-file-name="${escapeHTML(attachment.fileName)}" data-content-type="${escapeHTML(attachment.contentType)}">${icons.attachment}<span><strong>${escapeHTML(attachment.fileName)}</strong><small>${Math.max(1, Math.round((attachment.size || 0) / 1024))} KB · Download</small></span></button>`).join("") : `<p>No attachments.</p>`;
  target.querySelectorAll("[data-p5-admin-download]").forEach((button) => button.addEventListener("click", () => downloadSubmissionAttachment(button.dataset.submissionId, button.dataset.id, button.dataset.fileName, button.dataset.contentType, button)));
}''',
    "Phase 5 admin attachment loader",
)
p5 = replace_once(
    p5,
    '  document.querySelectorAll(\'[data-p5-action="delete-attachment"]\').forEach((button) => button.addEventListener("click", () => deleteAttachment(button.dataset.id)));',
    '  document.querySelectorAll(\'[data-p5-action="download-attachment"]\').forEach((button) => button.addEventListener("click", () => downloadSubmissionAttachment(state.currentSubmission.id, button.dataset.id, button.dataset.fileName, button.dataset.contentType, button)));\n  document.querySelectorAll(\'[data-p5-action="delete-attachment"]\').forEach((button) => button.addEventListener("click", () => deleteAttachment(button.dataset.id)));',
    "Phase 5 download event",
)
p5 = p5.replace("Maximum 10 MB", "Maximum 2 MB").replace("10 MB each", "2 MB each")
save(p5_path, p5)

# Phase 6 support tickets.
p6_path = Path("assets/js/phase6.js")
p6 = p6_path.read_text(encoding="utf-8")
p6 = re.sub(
    r'import \{\n  getDownloadURL,\n  ref,\n  uploadBytes\n\} from "https://www\.gstatic\.com/firebasejs/12\.17\.0/firebase-storage\.js";\nimport \{ auth, db, storage, authPersistenceReady \} from "\./firebase\.js";',
    '''import { auth, db, authPersistenceReady } from "./firebase.js";
import {
  downloadFirestoreAttachment,
  saveFirestoreAttachment,
  validateAttachmentFiles
} from "./firestore-attachments.js";''',
    p6,
    count=1,
)
p6 = re.sub(
    r'const FILE_LIMIT = 5;\nconst FILE_SIZE_LIMIT = 10 \* 1024 \* 1024;\nconst ALLOWED_TYPES = new Set\(\[.*?\]\);\nconst FILE_TYPE_BY_EXTENSION = Object\.freeze\(\{.*?\}\);',
    '',
    p6,
    count=1,
    flags=re.S,
)
p6 = re.sub(
    r'function normalizedFileType\(file\) \{.*?\n\}\n\nfunction validateFiles\(files\) \{.*?\n\}\n\nfunction attachmentErrorMessage\(error, fileName = "The attachment"\) \{.*?\n\}\n',
    '''function validateFiles(files) {
  return validateAttachmentFiles(files);
}
''',
    p6,
    count=1,
    flags=re.S,
)
p6 = re.sub(
    r'async function uploadMessageAttachments\(ticket, messageId, files\) \{.*?\n\}\n\nasync function createTicket',
    '''async function uploadMessageAttachments(ticket, messageId, files) {
  const uploaded = [];
  for (const item of files) {
    const attachmentRef = doc(collection(db, "supportTickets", ticket.id, "messages", messageId, "attachments"));
    await saveFirestoreAttachment({
      db,
      attachmentRef,
      item,
      metadata: {
        ticketId: ticket.id,
        chapterId: ticket.chapterId,
        messageId,
        uploadedByUid: state.user.uid
      }
    });
    uploaded.push(attachmentRef.id);
  }
  if (uploaded.length) {
    await updateDoc(doc(db, "supportTickets", ticket.id, "messages", messageId), {
      hasAttachments: true,
      attachmentCount: uploaded.length
    });
  }
}

async function downloadMessageAttachment(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing…";
  try {
    await downloadFirestoreAttachment({
      attachmentRef: doc(db, "supportTickets", button.dataset.ticketId, "messages", button.dataset.messageId, "attachments", button.dataset.attachmentId),
      fileName: button.dataset.fileName,
      contentType: button.dataset.contentType
    });
  } catch (error) {
    toast("Attachment unavailable", error.message || "The private file could not be downloaded.", "danger");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function createTicket''',
    p6,
    count=1,
    flags=re.S,
)
p6 = replace_once(
    p6,
    '''function messageMarkup(message) {
  const mine = message.authorUid === state.user?.uid;
  const staff = message.senderType === "staff";
  return `<article class="p6-message ${mine ? "mine" : ""} ${staff ? "staff" : "chapter"}"><div class="p6-message-avatar">${escapeHTML(initials(message.authorName))}</div><div class="p6-message-body"><header><strong>${escapeHTML(message.authorName)}</strong><span>${escapeHTML(roleLabel(message.authorRole))}</span><time>${escapeHTML(formatDate(message.createdAt, { time: true }))}</time></header><p>${escapeHTML(message.body).replaceAll("\\n", "<br>")}</p>${message.attachments?.length ? `<div class="p6-message-files">${message.attachments.map((file) => `<a href="${escapeHTML(file.downloadUrl)}" target="_blank" rel="noopener">${icons.attachment}<span>${escapeHTML(file.fileName)}</span></a>`).join("")}</div>` : ""}</div></article>`;
}''',
    '''function messageMarkup(message) {
  const mine = message.authorUid === state.user?.uid;
  const staff = message.senderType === "staff";
  return `<article class="p6-message ${mine ? "mine" : ""} ${staff ? "staff" : "chapter"}"><div class="p6-message-avatar">${escapeHTML(initials(message.authorName))}</div><div class="p6-message-body"><header><strong>${escapeHTML(message.authorName)}</strong><span>${escapeHTML(roleLabel(message.authorRole))}</span><time>${escapeHTML(formatDate(message.createdAt, { time: true }))}</time></header><p>${escapeHTML(message.body).replaceAll("\\n", "<br>")}</p>${message.attachments?.length ? `<div class="p6-message-files">${message.attachments.map((file) => `<button type="button" data-p6-action="download-attachment" data-ticket-id="${escapeHTML(message.ticketId)}" data-message-id="${escapeHTML(message.id)}" data-attachment-id="${escapeHTML(file.id)}" data-file-name="${escapeHTML(file.fileName)}" data-content-type="${escapeHTML(file.contentType)}">${icons.attachment}<span>${escapeHTML(file.fileName)}</span></button>`).join("")}</div>` : ""}</div></article>`;
}''',
    "Phase 6 message attachment markup",
)
p6 = replace_once(
    p6,
    '  document.querySelectorAll(\'[data-p6-action="ack-notice"]\').forEach((button) => button.addEventListener("click", () => acknowledgeNotice(button.dataset.noticeId)));',
    '  document.querySelectorAll(\'[data-p6-action="download-attachment"]\').forEach((button) => button.addEventListener("click", () => downloadMessageAttachment(button)));\n  document.querySelectorAll(\'[data-p6-action="ack-notice"]\').forEach((button) => button.addEventListener("click", () => acknowledgeNotice(button.dataset.noticeId)));',
    "Phase 6 download event",
)
p6 = p6.replace("Maximum 10 MB each", "Maximum 2 MB each").replace("10 MB each", "2 MB each")
p6 = p6.replace("Firebase rejected the file upload.", "Firestore rejected the private file data.")
save(p6_path, p6)

# Firestore rules: metadata and chunk authorization.
rules_path = Path("firestore.rules")
rules = rules_path.read_text(encoding="utf-8")
rules = re.sub(
    r'    function validAttachment\(submissionId\) \{.*?\n    \}\n\n    function supportTicket',
    '''    function validAttachment(submissionId, attachmentId) {
      let submission = get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data;
      return hasChapterMembership(request.resource.data.chapterId)
        && submission.submittedByUid == request.auth.uid
        && submission.chapterId == request.resource.data.chapterId
        && submission.status in ['draft', 'changes_requested']
        && request.resource.data.keys().hasAll([
          'attachmentId', 'chapterId', 'submissionId', 'fileName',
          'contentType', 'size', 'chunkCount', 'storageMode',
          'uploadedByUid', 'uploadedAt'
        ])
        && request.resource.data.keys().hasOnly([
          'attachmentId', 'chapterId', 'submissionId', 'fileName',
          'contentType', 'size', 'chunkCount', 'storageMode',
          'uploadedByUid', 'uploadedAt'
        ])
        && request.resource.data.attachmentId == attachmentId
        && request.resource.data.submissionId == submissionId
        && request.resource.data.uploadedByUid == request.auth.uid
        && request.resource.data.fileName is string
        && request.resource.data.fileName.size() >= 1
        && request.resource.data.fileName.size() <= 240
        && request.resource.data.contentType in [
          'application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/png', 'image/jpeg'
        ]
        && request.resource.data.size is int
        && request.resource.data.size > 0
        && request.resource.data.size <= 2097152
        && request.resource.data.chunkCount is int
        && request.resource.data.chunkCount >= 1
        && request.resource.data.chunkCount <= 7
        && request.resource.data.storageMode == 'firestore_chunks'
        && request.resource.data.uploadedAt == request.time;
    }

    function validSubmissionAttachmentChunk(submissionId, attachmentId) {
      let submission = get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data;
      let attachment = getAfter(/databases/$(database)/documents/chapterSubmissions/$(submissionId)/attachments/$(attachmentId)).data;
      return hasChapterMembership(submission.chapterId)
        && submission.submittedByUid == request.auth.uid
        && submission.status in ['draft', 'changes_requested']
        && attachment.uploadedByUid == request.auth.uid
        && attachment.storageMode == 'firestore_chunks'
        && request.resource.data.keys().hasAll(['attachmentId', 'index', 'data', 'createdAt'])
        && request.resource.data.keys().hasOnly(['attachmentId', 'index', 'data', 'createdAt'])
        && request.resource.data.attachmentId == attachmentId
        && request.resource.data.index is int
        && request.resource.data.index >= 0
        && request.resource.data.index < attachment.chunkCount
        && request.resource.data.data is string
        && request.resource.data.data.size() > 0
        && request.resource.data.data.size() <= 450000
        && request.resource.data.createdAt == request.time;
    }

    function supportTicket''',
    rules,
    count=1,
    flags=re.S,
)
rules = re.sub(
    r'    function validSupportAttachment\(ticketId, messageId\) \{.*?\n    \}\n\n    function validSupportReadState',
    '''    function validSupportAttachment(ticketId, messageId, attachmentId) {
      let ticket = supportTicket(ticketId);
      let message = get(/databases/$(database)/documents/supportTickets/$(ticketId)/messages/$(messageId)).data;
      return canAccessSupportTicketData(ticket)
        && (message.authorUid == request.auth.uid || canManageSupport())
        && request.resource.data.keys().hasAll([
          'attachmentId', 'ticketId', 'chapterId', 'messageId',
          'uploadedByUid', 'fileName', 'contentType', 'size',
          'chunkCount', 'storageMode', 'uploadedAt'
        ])
        && request.resource.data.keys().hasOnly([
          'attachmentId', 'ticketId', 'chapterId', 'messageId',
          'uploadedByUid', 'fileName', 'contentType', 'size',
          'chunkCount', 'storageMode', 'uploadedAt'
        ])
        && request.resource.data.attachmentId == attachmentId
        && request.resource.data.ticketId == ticketId
        && request.resource.data.chapterId == ticket.chapterId
        && request.resource.data.messageId == messageId
        && request.resource.data.uploadedByUid == request.auth.uid
        && request.resource.data.fileName is string
        && request.resource.data.fileName.size() >= 1
        && request.resource.data.fileName.size() <= 240
        && request.resource.data.contentType in [
          'application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/png', 'image/jpeg'
        ]
        && request.resource.data.size is int
        && request.resource.data.size > 0
        && request.resource.data.size <= 2097152
        && request.resource.data.chunkCount is int
        && request.resource.data.chunkCount >= 1
        && request.resource.data.chunkCount <= 7
        && request.resource.data.storageMode == 'firestore_chunks'
        && request.resource.data.uploadedAt == request.time;
    }

    function validSupportAttachmentChunk(ticketId, messageId, attachmentId) {
      let ticket = supportTicket(ticketId);
      let attachment = getAfter(/databases/$(database)/documents/supportTickets/$(ticketId)/messages/$(messageId)/attachments/$(attachmentId)).data;
      return canAccessSupportTicketData(ticket)
        && attachment.uploadedByUid == request.auth.uid
        && attachment.storageMode == 'firestore_chunks'
        && request.resource.data.keys().hasAll(['attachmentId', 'index', 'data', 'createdAt'])
        && request.resource.data.keys().hasOnly(['attachmentId', 'index', 'data', 'createdAt'])
        && request.resource.data.attachmentId == attachmentId
        && request.resource.data.index is int
        && request.resource.data.index >= 0
        && request.resource.data.index < attachment.chunkCount
        && request.resource.data.data is string
        && request.resource.data.data.size() > 0
        && request.resource.data.data.size() <= 450000
        && request.resource.data.createdAt == request.time;
    }

    function validSupportReadState''',
    rules,
    count=1,
    flags=re.S,
)
rules = replace_once(rules, 'allow create: if validAttachment(submissionId);', 'allow create: if validAttachment(submissionId, attachmentId);', "submission attachment rule")
rules = replace_once(
    rules,
    '''        allow delete: if canReviewSubmissions()
          || (signedIn()
            && get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data.submittedByUid == request.auth.uid
            && get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data.status in ['draft', 'changes_requested']);
      }''',
    '''        allow delete: if canReviewSubmissions()
          || (signedIn()
            && get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data.submittedByUid == request.auth.uid
            && get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data.status in ['draft', 'changes_requested']);

        match /chunks/{chunkId} {
          allow read: if canReadChapterOperations()
            || hasChapterMembership(get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data.chapterId);
          allow create: if validSubmissionAttachmentChunk(submissionId, attachmentId);
          allow update: if false;
          allow delete: if canReviewSubmissions()
            || (signedIn()
              && get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data.submittedByUid == request.auth.uid
              && get(/databases/$(database)/documents/chapterSubmissions/$(submissionId)).data.status in ['draft', 'changes_requested']);
        }
      }''',
    "submission chunk match",
)
rules = replace_once(rules, 'allow create: if validSupportAttachment(ticketId, messageId);', 'allow create: if validSupportAttachment(ticketId, messageId, attachmentId);', "support attachment rule")
rules = replace_once(
    rules,
    '''          allow update: if false;
          allow delete: if isOwner() || canManageSupport();
        }''',
    '''          allow update: if false;
          allow delete: if isOwner() || canManageSupport();

          match /chunks/{chunkId} {
            allow read: if canAccessSupportTicketData(supportTicket(ticketId));
            allow create: if validSupportAttachmentChunk(ticketId, messageId, attachmentId);
            allow update: if false;
            allow delete: if isOwner() || canManageSupport();
          }
        }''',
    "support chunk match",
)
save(rules_path, rules)

# Version and permanent validation.
index_path = Path("index.html")
save(index_path, index_path.read_text(encoding="utf-8").replace(OLD_BUILD, NEW_BUILD))
for validator in Path("scripts").glob("validate_*.py"):
    text = validator.read_text(encoding="utf-8").replace(OLD_BUILD, NEW_BUILD)
    save(validator, text)

validator_path = Path("scripts/validate_firestore_attachments.py")
validator = '''from pathlib import Path
import json
import sys

errors = []
files = {
    "firebase": Path("assets/js/firebase.js").read_text(),
    "phase5": Path("assets/js/phase5.js").read_text(),
    "phase6": Path("assets/js/phase6.js").read_text(),
    "shared": Path("assets/js/firestore-attachments.js").read_text(),
    "rules": Path("firestore.rules").read_text(),
    "index": Path("index.html").read_text(),
}
config = json.loads(Path("firebase.json").read_text())

for marker in ("firebase-storage.js", "uploadBytes(", "getDownloadURL(", "getStorage(", "storagePath", "downloadUrl"):
    for name in ("firebase", "phase5", "phase6"):
        if marker in files[name]: errors.append(f"{name} still contains Firebase Storage marker: {marker}")
if "storage" in config: errors.append("firebase.json still deploys Firebase Storage")
if Path("storage.rules").exists(): errors.append("storage.rules should be removed")
for marker in ("saveFirestoreAttachment", "downloadFirestoreAttachment", "firestore_chunks", "CHUNK_BYTES", "2 * 1024 * 1024"):
    if marker not in files["shared"]: errors.append(f"Shared Firestore attachment engine is missing {marker}")
for marker in ("validSubmissionAttachmentChunk", "validSupportAttachmentChunk", "data.size() <= 450000", "size <= 2097152"):
    if marker not in files["rules"]: errors.append(f"Firestore Rules are missing {marker}")
if 'content="20260803.12"' not in files["index"]: errors.append("Production build was not bumped to 20260803.12")

if errors:
    for error in errors: print(f"ERROR: {error}")
    sys.exit(1)
print("Firestore-backed attachment validation passed.")
'''
save(validator_path, validator)

# Storage Rules are intentionally removed; Firestore is now the only file backend.
storage_rules = Path("storage.rules")
if storage_rules.exists():
    storage_rules.unlink()
    changed.append("storage.rules (removed)")

if not changed:
    raise SystemExit("No Firestore attachment changes were applied")
print("Updated:")
for item in changed:
    print(f"- {item}")
