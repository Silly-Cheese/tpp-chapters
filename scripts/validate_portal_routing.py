from pathlib import Path
import re
import sys

errors = []
app = Path("assets/js/app.js").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")
phase8 = Path("assets/js/phase8.js").read_text(encoding="utf-8")

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
if 'assets/js/phase6.js?v=20260803.3' not in index:
    errors.append("The direct versioned Phase 6 module is not loaded")
if 'assets/portal-hotfix.css?v=20260803.3' not in index:
    errors.append("The portal hotfix stylesheet is not versioned in index.html")
if 'function hardReloadPortal' not in phase8:
    errors.append("Phase 8 is missing hard cache recovery")

local_assets = re.findall(r'(?:href|src)="(assets/[^"?]+\.(?:css|js))(?:\?v=([^"]+))?"', index)
for asset, version in local_assets:
    if not version:
        errors.append(f"Unversioned production asset: {asset}")
    if not Path(asset).exists():
        errors.append(f"Missing production asset: {asset}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)
print("Portal routing and cache validation passed.")
