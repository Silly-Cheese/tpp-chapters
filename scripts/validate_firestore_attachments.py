from pathlib import Path
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
if 'content="20260805.1"' not in files["index"]: errors.append("Production build was not bumped to 20260805.1")

if errors:
    for error in errors: print(f"ERROR: {error}")
    sys.exit(1)
print("Firestore-backed attachment validation passed.")
