from pathlib import Path
import re

BUILD = "20260803.3"
changed = []


def save(path: Path, before: str, after: str) -> None:
    if before != after:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))


# Route signed-in users to the completed role-specific portals.
app_path = Path("assets/js/app.js")
app_before = app_path.read_text(encoding="utf-8")
app = app_before

app = app.replace(
    'const ACTIVE_ACCOUNT_STATUSES = new Set(["active"]);\nconst DIRECT_ID_PATTERN',
    'const ACTIVE_ACCOUNT_STATUSES = new Set(["active"]);\nconst ADMIN_PORTAL_ROLES = new Set(["owner", "chapterAdmin", "complianceAdmin", "supportAgent"]);\nconst CHAPTER_PORTAL_ROLES = new Set(["director", "adviser", "chapterUser"]);\nconst DIRECT_ID_PATTERN',
    1,
)

profile_anchor = '''function profileStatusBadge(profile) {
  const status = profile?.accountStatus || "pending";
  const className = status === "active" ? "badge-success" : status === "disabled" ? "badge-danger" : "badge-warning";
  return `<span class="badge ${className}">${escapeHTML(titleCase(status))}</span>`;
}'''
portal_helpers = '''function profileStatusBadge(profile) {
  const status = profile?.accountStatus || "pending";
  const className = status === "active" ? "badge-success" : status === "disabled" ? "badge-danger" : "badge-warning";
  return `<span class="badge ${className}">${escapeHTML(titleCase(status))}</span>`;
}

function portalHomeForRole(role = state.profile?.systemRole) {
  if (ADMIN_PORTAL_ROLES.has(role)) return "/admin/dashboard";
  if (CHAPTER_PORTAL_ROLES.has(role)) return "/chapter/overview";
  return "/dashboard";
}

function portalButtonLabel() {
  if (ADMIN_PORTAL_ROLES.has(state.profile?.systemRole)) return "Administration console";
  if (CHAPTER_PORTAL_ROLES.has(state.profile?.systemRole)) return "My chapter";
  return "Open portal";
}'''
if profile_anchor not in app:
    raise SystemExit("Profile status anchor was not found in app.js")
app = app.replace(profile_anchor, portal_helpers, 1)

app = app.replace(
    '${state.user ? `<a class="btn btn-primary" href="#/dashboard">Open portal</a>` : `<a class="btn btn-primary" href="#/login">Sign in</a>`}',
    '<a class="btn btn-primary" href="#/portal">${state.user ? portalButtonLabel() : "Portal access"}</a>',
    1,
)

app = app.replace(
    '<a class="nav-link ${activeRoute === "/dashboard" ? "active" : ""}" href="#/dashboard">${icons.home}<span>Overview</span></a>',
    '<a class="nav-link ${activeRoute === "/dashboard" ? "active" : ""}" href="#${portalHomeForRole()}">${icons.home}<span>Overview</span></a>',
    1,
)

login_anchor = 'function loginPage() {'
portal_page = '''function portalAccessPage() {
  if (state.user && state.profile && ACTIVE_ACCOUNT_STATUSES.has(state.profile.accountStatus)) {
    const destination = portalHomeForRole();
    queueMicrotask(() => navigate(destination));
    return loadingScreen(destination.startsWith("/admin/") ? "Opening the administration console…" : "Opening your chapter workspace…");
  }
  return publicLayout(`
    <section class="portal-access-shell">
      <article class="portal-access-card">
        <p class="eyebrow">Chapter Registry & Operations Portal</p>
        <h1>One portal for every approved chapter.</h1>
        <p>The public registry is only the verification side of the system. Authorized accounts open the complete administration, Director, or Adviser workspace after sign-in.</p>
        <div class="portal-access-grid">
          <div class="portal-access-option"><strong>Administration</strong><span>Manage chapters, users, invitations, compliance, submissions, support, notices, registry records, settings, and audit history.</span></div>
          <div class="portal-access-option"><strong>Chapter leadership</strong><span>Review standing, requirements, leadership, documents, notices, reports, renewals, events, and support conversations.</span></div>
        </div>
        <div class="portal-access-actions"><a class="btn btn-primary" href="#/login">Sign in to the portal</a><a class="btn btn-secondary" href="#/activate">Activate an approved account</a><a class="btn btn-secondary" href="#/verify">Return to verification</a></div>
      </article>
    </section>`);
}

function loginPage() {'''
if login_anchor not in app:
    raise SystemExit("Login page anchor was not found in app.js")
app = app.replace(login_anchor, portal_page, 1)

app = app.replace('queueMicrotask(() => navigate("/dashboard"));', 'queueMicrotask(() => navigate("/portal"));', 1)
app = app.replace('await signInWithEmailAndPassword(auth, email, password);\n    navigate("/dashboard");', 'await signInWithEmailAndPassword(auth, email, password);\n    navigate("/portal");', 1)

old_dashboard = '''function dashboardPage() {
  return state.profile?.systemRole === "owner" ? ownerDashboard() : roleDashboard();
}'''
new_dashboard = '''function dashboardPage() {
  const destination = portalHomeForRole();
  if (destination !== "/dashboard") {
    queueMicrotask(() => navigate(destination));
    return loadingScreen(destination.startsWith("/admin/") ? "Opening the administration console…" : "Opening your chapter workspace…");
  }
  return roleDashboard();
}'''
if old_dashboard not in app:
    raise SystemExit("Dashboard function anchor was not found in app.js")
app = app.replace(old_dashboard, new_dashboard, 1)

app = app.replace('    "/login": loginPage,', '    "/portal": portalAccessPage,\n    "/login": loginPage,', 1)
app = app.replace('    "/login": "Sign In | The Prayer Project",', '    "/portal": "Portal Access | The Prayer Project",\n    "/login": "Sign In | The Prayer Project",', 1)
app = app.replace('href="${state.user ? "#/dashboard" : "#/"}"', 'href="${state.user ? `#${portalHomeForRole()}` : "#/"}"', 1)

# Remove obsolete Phase 2-only copy from fallback dashboards and system status.
replacements = {
    "The Phase 2 public registry is now connected to Firestore and available to schools, churches, families, volunteers, and community members.": "The complete Chapter Registry & Operations Portal is available for public verification, chapter leadership, support, and administration.",
    '<div class="metric-label">Current phase</div><div class="metric-value">Phase 2</div><div class="metric-note">Public registry and verification</div>': '<div class="metric-label">Platform</div><div class="metric-value">Complete</div><div class="metric-note">Phases 1–8 are available</div>',
    "Your detailed chapter standing, compliance, leadership, and documents will become available in the chapter portal phase.": "Your chapter standing, compliance, leadership, documents, workflows, notices, and support tools are available in your chapter workspace.",
    '<a class="btn btn-primary" href="#/verify">Open public registry</a>': '<a class="btn btn-primary" href="#/chapter/overview">Open chapter workspace</a>',
    '<div class="metric-label">Registry</div><div class="metric-value">Phase 2</div><div class="metric-note">Public Firestore records enabled</div>': '<div class="metric-label">Platform</div><div class="metric-value">Online</div><div class="metric-note">Public and protected portals enabled</div>',
}
for old, new in replacements.items():
    app = app.replace(old, new)

save(app_path, app_before, app)

# Bust stale GitHub Pages/browser assets and load Phase 6 directly.
index_path = Path("index.html")
index_before = index_path.read_text(encoding="utf-8")
index = index_before
index = re.sub(r'<meta name="tpp-build" content="[^"]+">\n?', '', index)
index = index.replace('<meta name="theme-color" content="#151411">', f'<meta name="theme-color" content="#151411">\n  <meta name="tpp-build" content="{BUILD}">', 1)
index = index.replace('  <link rel="stylesheet" href="assets/phase8.css">', '  <link rel="stylesheet" href="assets/phase8.css">\n  <link rel="stylesheet" href="assets/portal-hotfix.css">', 1)
index = index.replace('  <script type="module" src="assets/js/phase6-loader.js"></script>', '  <script type="module" src="assets/js/phase6.js"></script>', 1)
index = re.sub(r'((?:href|src)=")(assets/[^"?]+\.(?:css|js))(?:\?v=[^"]+)?"', lambda m: f'{m.group(1)}{m.group(2)}?v={BUILD}"', index)
save(index_path, index_before, index)

# Make the production error recovery explicitly clear stale portal files.
phase8_path = Path("assets/js/phase8.js")
phase8_before = phase8_path.read_text(encoding="utf-8")
phase8 = phase8_before
phase8 = phase8.replace('  "assets/phase8.css",', '  "assets/phase8.css",\n  "assets/portal-hotfix.css",', 1)
phase8 = phase8.replace('  "assets/js/phase6-loader.js",', '  "assets/js/phase6.js",', 1)

capture_anchor = 'function captureError(error, source = "runtime") {'
hard_reload = '''function hardReloadPortal() {
  const url = new URL(location.href);
  url.searchParams.set("portal_refresh", Date.now().toString());
  location.replace(`${url.pathname}${url.search}${url.hash}`);
}

function captureError(error, source = "runtime") {'''
if capture_anchor not in phase8:
    raise SystemExit("Phase 8 error capture anchor was not found")
phase8 = phase8.replace(capture_anchor, hard_reload, 1)

old_panel = '''  panel.innerHTML = `<div><strong>Something did not load correctly.</strong><p>Reference ${escapeHTML(id)}. Refresh the page; if the issue continues, include this reference in a support request.</p></div><button type="button" data-p8-action="reload">Reload</button><button type="button" aria-label="Dismiss error" data-p8-action="dismiss-error">×</button>`;
  document.body.append(panel);
  panel.querySelector("[data-p8-action='reload']")?.addEventListener("click", () => location.reload());'''
new_panel = '''  panel.innerHTML = `<div><strong>Something did not load correctly.</strong><p>Reference ${escapeHTML(id)}. Refresh the portal files to clear an outdated browser copy.</p><span class="p8-error-detail">${escapeHTML(message.slice(0, 180))}</span></div><button type="button" data-p8-action="hard-reload">Refresh portal files</button><button type="button" aria-label="Dismiss error" data-p8-action="dismiss-error">×</button>`;
  document.body.append(panel);
  panel.querySelector("[data-p8-action='hard-reload']")?.addEventListener("click", hardReloadPortal);'''
if old_panel not in phase8:
    raise SystemExit("Phase 8 error panel anchor was not found")
phase8 = phase8.replace(old_panel, new_panel, 1)
save(phase8_path, phase8_before, phase8)

# Add a permanent validation script for the completed portal routing.
validator = Path("scripts/validate_portal_routing.py")
validator_content = f'''from pathlib import Path
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
        errors.append(f"Missing portal routing marker: {{marker}}")

if 'href="#/dashboard">Open portal' in app:
    errors.append("Public Open portal button still points to the obsolete Phase 2 dashboard")
if 'Current phase</div><div class="metric-value">Phase 2' in app:
    errors.append("The base dashboard still advertises Phase 2 as the current system")
if 'phase6-loader.js' in index:
    errors.append("index.html still loads the obsolete Phase 6 loader")
if 'assets/js/phase6.js?v={BUILD}' not in index:
    errors.append("The direct versioned Phase 6 module is not loaded")
if 'assets/portal-hotfix.css?v={BUILD}' not in index:
    errors.append("The portal hotfix stylesheet is not versioned in index.html")
if 'function hardReloadPortal' not in phase8:
    errors.append("Phase 8 is missing hard cache recovery")

local_assets = re.findall(r'(?:href|src)="(assets/[^"?]+\.(?:css|js))(?:\?v=([^"]+))?"', index)
for asset, version in local_assets:
    if not version:
        errors.append(f"Unversioned production asset: {{asset}}")
    if not Path(asset).exists():
        errors.append(f"Missing production asset: {{asset}}")

if errors:
    for error in errors:
        print(f"ERROR: {{error}}")
    sys.exit(1)
print("Portal routing and cache validation passed.")
'''
validator_before = validator.read_text(encoding="utf-8") if validator.exists() else ""
save(validator, validator_before, validator_content)

if not changed:
    raise SystemExit("No portal routing/cache changes were applied")

print("Updated:")
for path in changed:
    print(f"- {path}")
