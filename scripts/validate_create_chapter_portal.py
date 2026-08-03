from pathlib import Path
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
if '20260803.9' not in index:
    errors.append("Production assets were not bumped to build 20260803.9")

build_match = re.search(r'<meta name="tpp-build" content="([^"]+)">', index)
if not build_match:
    errors.append("Missing build marker")
else:
    build = build_match.group(1)
    for asset, version in re.findall(r'(?:href|src)="(assets/[^"?]+\.(?:css|js))\?v=([^"]+)"', index):
        if version != build:
            errors.append(f"Asset {asset} uses {version}, expected {build}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Create-chapter portal validation passed.")
