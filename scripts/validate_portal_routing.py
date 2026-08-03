from pathlib import Path
import re
import sys

errors = []
app = Path("assets/js/app.js").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")
phase8 = Path("assets/js/phase8.js").read_text(encoding="utf-8")
hotfix = Path("assets/portal-hotfix.css").read_text(encoding="utf-8")

required_app = [
    'function portalHomeForRole',
    'return "/admin/dashboard"',
    'return "/chapter/overview"',
    '"/portal": portalAccessPage',
    'href="#/portal"',
]
for marker in required_app:
    if marker not in app:
        errors.append(f"Missing portal routing marker: {marker}")

if 'href="#/dashboard">Open portal' in app:
    errors.append("Public Open portal button still points to the obsolete Phase 2 dashboard")
if 'Current phase</div><div class="metric-value">Phase 2' in app:
    errors.append("The base dashboard still advertises Phase 2 as the current system")
if 'phase6-loader.js' in index:
    errors.append("index.html still loads the obsolete Phase 6 loader")
if 'function hardReloadPortal' not in phase8:
    errors.append("Phase 8 is missing hard cache recovery")

build_match = re.search(r'<meta name="tpp-build" content="([^"]+)">', index)
if not build_match:
    errors.append("index.html is missing the production build identifier")
    build = ""
else:
    build = build_match.group(1)

local_assets = re.findall(r'(?:href|src)="(assets/[^"?]+\.(?:css|js))(?:\?v=([^"]+))?"', index)
for asset, version in local_assets:
    if not version:
        errors.append(f"Unversioned production asset: {asset}")
    elif build and version != build:
        errors.append(f"Asset version does not match the production build: {asset}")
    if not Path(asset).exists():
        errors.append(f"Missing production asset: {asset}")

required_theme_rules = [
    ".portal-access-card",
    "color: var(--ink)",
    "background: var(--paper)",
    "border: 1px solid var(--line)",
    ".portal-access-card > p",
    "color: var(--muted)",
    ".portal-access-option strong",
]
for marker in required_theme_rules:
    if marker not in hotfix:
        errors.append(f"Portal access stylesheet is missing theme-aware rule: {marker}")

if "background: var(--surface, #fffdf8)" in hotfix:
    errors.append("Portal access card still uses the broken hard-coded light background fallback")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Portal routing, cache, and contrast validation passed.")
