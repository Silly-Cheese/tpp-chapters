import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

export const ATTACHMENT_FILE_LIMIT = 5;
export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
const CHUNK_BYTES = 320 * 1024;

const TYPE_BY_EXTENSION = Object.freeze({
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg"
});

const ALLOWED_TYPES = new Set(Object.values(TYPE_BY_EXTENSION));

export function normalizedAttachmentType(file) {
  const browserType = String(file?.type || "").trim().toLowerCase();
  if (ALLOWED_TYPES.has(browserType)) return browserType;
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  return TYPE_BY_EXTENSION[extension] || "";
}

export function validateAttachmentFiles(files, existingCount = 0) {
  const items = Array.from(files || []);
  if (existingCount + items.length > ATTACHMENT_FILE_LIMIT) {
    throw new Error(`No more than ${ATTACHMENT_FILE_LIMIT} attachments are allowed.`);
  }
  return items.map((file) => {
    const contentType = normalizedAttachmentType(file);
    if (!contentType) throw new Error(`${file.name} is not an approved PDF, Word, PNG, or JPEG file.`);
    if (!Number.isFinite(file.size) || file.size <= 0) throw new Error(`${file.name} is empty and cannot be attached.`);
    if (file.size > ATTACHMENT_MAX_BYTES) throw new Error(`${file.name} is larger than 2 MB.`);
    return { file, contentType };
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function saveFirestoreAttachment({ db, attachmentRef, item, metadata }) {
  const file = item.file || item;
  const contentType = item.contentType || normalizedAttachmentType(file);
  if (!contentType) throw new Error(`${file.name} is not an approved attachment type.`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    chunks.push(bytesToBase64(bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.length))));
  }

  const batch = writeBatch(db);
  batch.set(attachmentRef, {
    ...metadata,
    attachmentId: attachmentRef.id,
    fileName: file.name,
    contentType,
    size: file.size,
    chunkCount: chunks.length,
    storageMode: "firestore_chunks",
    uploadedAt: serverTimestamp()
  });
  chunks.forEach((data, index) => {
    const chunkRef = doc(collection(attachmentRef, "chunks"), String(index).padStart(4, "0"));
    batch.set(chunkRef, {
      attachmentId: attachmentRef.id,
      index,
      data,
      createdAt: serverTimestamp()
    });
  });
  await batch.commit();
  return attachmentRef.id;
}

export async function downloadFirestoreAttachment({ attachmentRef, fileName, contentType }) {
  const snapshot = await getDocs(collection(attachmentRef, "chunks"));
  const chunks = snapshot.docs
    .map((item) => item.data())
    .sort((a, b) => Number(a.index) - Number(b.index));
  if (!chunks.length) throw new Error("This attachment has no Firestore file data.");

  const parts = chunks.map((chunk) => base64ToBytes(chunk.data));
  const blob = new Blob(parts, { type: contentType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "attachment";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function deleteFirestoreAttachment({ db, attachmentRef }) {
  const chunks = await getDocs(collection(attachmentRef, "chunks"));
  const batch = writeBatch(db);
  chunks.docs.forEach((item) => batch.delete(item.ref));
  batch.delete(attachmentRef);
  await batch.commit();
}
