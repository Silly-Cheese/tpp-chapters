from pathlib import Path
import re

js_path = Path("assets/js/phase9.js")
js = js_path.read_text(encoding="utf-8")

# Keep the entire existing Administration Console available while Phase 9 is open.
old_admin = '''        <span class="p7-nav-label">Management</span>
        ${adminNavLink("/admin/dashboard", "Dashboard", icons.home)}
        ${adminNavLink("/admin/chapters", "Chapters", icons.shield)}
        ${adminNavLink("/admin/users", "Users", icons.users)}
        ${adminNavLink("/admin/forms", "Forms & agreements", icons.forms)}
        <span class="p7-nav-label">Form operations</span>'''
new_admin = '''        <span class="p7-nav-label">Management</span>
        ${adminNavLink("/admin/dashboard", "Dashboard", icons.home)}
        ${adminNavLink("/admin/chapters", "Chapters", icons.shield)}
        ${adminNavLink("/admin/users", "Users", icons.users)}
        ${adminNavLink("/admin/memberships", "Memberships", icons.users)}
        ${adminNavLink("/admin/registry", "Public registry", icons.shield)}
        ${adminNavLink("/admin/concerns", "Concern reports", icons.alert)}
        ${adminNavLink("/admin/audit", "Audit history", icons.forms)}
        ${adminNavLink("/admin/settings", "System settings", icons.shield)}
        ${adminNavLink("/admin/forms", "Forms & agreements", icons.forms)}
        <span class="p7-nav-label">Form operations</span>'''
if old_admin in js:
    js = js.replace(old_admin, new_admin, 1)

old_specialist = '''        <a class="p7-nav-link" href="#/admin/chapter-workspaces">${icons.shield}<span>Workspace setup</span></a>
        <a class="p7-nav-link" href="#/admin/submissions">${icons.forms}<span>Submission review</span></a>
        <a class="p7-nav-link" href="#/admin/support">${icons.alert}<span>Support queue</span></a>'''
new_specialist = '''        <a class="p7-nav-link" href="#/admin/invitations">${icons.plus}<span>Account invitations</span></a>
        <a class="p7-nav-link" href="#/admin/chapter-workspaces">${icons.shield}<span>Workspace setup</span></a>
        <a class="p7-nav-link" href="#/admin/submissions">${icons.forms}<span>Submission review</span></a>
        <a class="p7-nav-link" href="#/admin/support">${icons.alert}<span>Support queue</span></a>
        <a class="p7-nav-link" href="#/admin/communications">${icons.send}<span>Notice publishing</span></a>'''
if old_specialist in js:
    js = js.replace(old_specialist, new_specialist, 1)

# Highlight Required Forms on its nested fill/view routes.
old_chapter_link = '''function chapterNavLink(path, label, graphic, count = 0) {
  return `<a class="${route() === path ? "active" : ""}" href="#${path}">${graphic}<span>${esc(label)}</span>${count ? `<em>${count}</em>` : ""}</a>`;
}'''
new_chapter_link = '''function chapterNavLink(path, label, graphic, count = 0) {
  const current = route();
  const active = current === path || (path === "/chapter/forms" && current.startsWith("/chapter/forms/"));
  return `<a class="${active ? "active" : ""}" href="#${path}">${graphic}<span>${esc(label)}</span>${count ? `<em>${count}</em>` : ""}</a>`;
}'''
if old_chapter_link in js:
    js = js.replace(old_chapter_link, new_chapter_link, 1)

# Keep every established Chapter Portal destination visible on Phase 9 pages.
old_chapter_nav = '''        ${chapterNavLink("/chapter/overview", "Overview", icons.home)}
        ${chapterNavLink("/chapter/compliance", "Standing & compliance", icons.shield)}
        ${chapterNavLink("/chapter/leadership", "Leadership", icons.users)}
        ${chapterNavLink("/chapter/forms", "Required forms", icons.forms, pending)}
        <span>Operations</span>'''
new_chapter_nav = '''        ${chapterNavLink("/chapter/overview", "Overview", icons.home)}
        ${chapterNavLink("/chapter/compliance", "Standing & compliance", icons.shield)}
        ${chapterNavLink("/chapter/leadership", "Leadership", icons.users)}
        ${chapterNavLink("/chapter/members", "Members", icons.users)}
        ${chapterNavLink("/chapter/documents", "Documents", icons.forms)}
        ${chapterNavLink("/chapter/notices", "Notices", icons.alert)}
        ${chapterNavLink("/chapter/forms", "Required forms", icons.forms, pending)}
        ${membership?.role === "adviser" ? chapterNavLink("/chapter/adviser", "Adviser oversight", icons.shield) : ""}
        <span>Operations</span>'''
if old_chapter_nav in js:
    js = js.replace(old_chapter_nav, new_chapter_nav, 1)

# Never finalize a certification until all newly selected files are safely stored.
new_save_response = r'''async function saveResponse({ submit = false } = {}) {
  const form = document.querySelector("#p9-response-form");
  const assignment = state.currentAssignment;
  if (!form || !assignment || !canCurrentUserEdit(assignment, state.currentResponse)) return;
  const role = selectedMembership().role;
  const answers = collectAnswers(form, role);
  if (submit) {
    validateRequiredAnswers(role, answers, form);
    if (!form.certificationConfirmed.checked) throw new Error("Confirm the authenticated certification before submitting.");
    if (form.certificationName.value.trim().length < 2 || form.certificationTitle.value.trim().length < 2) throw new Error("Enter your full name and official title for certification.");
  }
  const responseRef = doc(db, "formAssignments", assignment.id, "responses", "current");
  const existing = state.currentResponse;
  const nextStatus = submit
    ? (assignment.workflow === "director_then_adviser" && role === "director" ? "awaiting_adviser" : "submitted")
    : "draft";
  const nextStep = submit
    ? (assignment.workflow === "director_then_adviser" && role === "director" ? "adviser" : "review")
    : role;
  const selectedFileCount = Array.from(form.querySelectorAll('input[type="file"][data-field-id]'))
    .reduce((total, input) => total + (input.files?.length || 0), 0);
  const baseData = {
    assignmentId: assignment.id,
    campaignId: assignment.campaignId,
    templateId: assignment.templateId,
    versionId: assignment.versionId,
    chapterId: assignment.chapterId,
    workflow: assignment.workflow,
    status: nextStatus,
    currentStep: nextStep,
    returnRole: "",
    directorAnswersJson: role === "director" ? JSON.stringify(answers) : (existing?.directorAnswersJson || "{}"),
    adviserAnswersJson: role === "adviser" ? JSON.stringify(answers) : (existing?.adviserAnswersJson || "{}"),
    directorCertificationName: role === "director" && submit ? form.certificationName.value.trim() : (existing?.directorCertificationName || ""),
    directorCertificationTitle: role === "director" && submit ? form.certificationTitle.value.trim() : (existing?.directorCertificationTitle || ""),
    directorCertifiedAt: role === "director" && submit ? serverTimestamp() : (existing?.directorCertifiedAt || null),
    directorUid: role === "director" && submit ? state.user.uid : (existing?.directorUid || ""),
    adviserCertificationName: role === "adviser" && submit ? form.certificationName.value.trim() : (existing?.adviserCertificationName || ""),
    adviserCertificationTitle: role === "adviser" && submit ? form.certificationTitle.value.trim() : (existing?.adviserCertificationTitle || ""),
    adviserCertifiedAt: role === "adviser" && submit ? serverTimestamp() : (existing?.adviserCertifiedAt || null),
    adviserUid: role === "adviser" && submit ? state.user.uid : (existing?.adviserUid || ""),
    submittedAt: submit && nextStatus === "submitted" ? serverTimestamp() : (existing?.submittedAt || null),
    reviewNote: submit ? "" : (existing?.reviewNote || ""),
    reviewedByUid: existing?.reviewedByUid || "",
    reviewedByName: existing?.reviewedByName || "",
    reviewedAt: existing?.reviewedAt || null,
    createdByUid: existing?.createdByUid || state.user.uid,
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedByUid: state.user.uid,
    updatedAt: serverTimestamp()
  };

  if (submit && selectedFileCount) {
    const stagingData = {
      ...baseData,
      status: "draft",
      currentStep: role,
      returnRole: existing?.returnRole || "",
      directorCertificationName: existing?.directorCertificationName || "",
      directorCertificationTitle: existing?.directorCertificationTitle || "",
      directorCertifiedAt: existing?.directorCertifiedAt || null,
      directorUid: existing?.directorUid || "",
      adviserCertificationName: existing?.adviserCertificationName || "",
      adviserCertificationTitle: existing?.adviserCertificationTitle || "",
      adviserCertifiedAt: existing?.adviserCertifiedAt || null,
      adviserUid: existing?.adviserUid || "",
      submittedAt: existing?.submittedAt || null,
      reviewNote: existing?.reviewNote || ""
    };
    await setDoc(responseRef, stagingData, { merge: true });
    await uploadResponseFiles(form, responseRef);

    const finalBatch = writeBatch(db);
    const certification = role === "director"
      ? {
          directorCertificationName: form.certificationName.value.trim(),
          directorCertificationTitle: form.certificationTitle.value.trim(),
          directorCertifiedAt: serverTimestamp(),
          directorUid: state.user.uid
        }
      : {
          adviserCertificationName: form.certificationName.value.trim(),
          adviserCertificationTitle: form.certificationTitle.value.trim(),
          adviserCertifiedAt: serverTimestamp(),
          adviserUid: state.user.uid
        };
    finalBatch.update(responseRef, {
      status: nextStatus,
      currentStep: nextStep,
      returnRole: "",
      ...certification,
      submittedAt: nextStatus === "submitted" ? serverTimestamp() : (existing?.submittedAt || null),
      reviewNote: "",
      updatedByUid: state.user.uid,
      updatedAt: serverTimestamp()
    });
    finalBatch.set(doc(collection(responseRef, "history")), {
      assignmentId: assignment.id,
      chapterId: assignment.chapterId,
      eventType: nextStatus === "awaiting_adviser" ? "director_submitted" : "response_submitted",
      actorUid: state.user.uid,
      actorName: state.profile?.displayName || state.user.email,
      actorRole: role,
      note: "",
      createdAt: serverTimestamp()
    });
    await finalBatch.commit();
  } else {
    const batch = writeBatch(db);
    batch.set(responseRef, baseData, { merge: true });
    if (submit) {
      batch.set(doc(collection(responseRef, "history")), {
        assignmentId: assignment.id,
        chapterId: assignment.chapterId,
        eventType: nextStatus === "awaiting_adviser" ? "director_submitted" : "response_submitted",
        actorUid: state.user.uid,
        actorName: state.profile?.displayName || state.user.email,
        actorRole: role,
        note: "",
        createdAt: serverTimestamp()
      });
    }
    await batch.commit();
    if (!submit) await uploadResponseFiles(form, responseRef);
  }

  await loadCurrentAssignment(assignment.id);
  setAlert("p9-response-alert", "success", submit ? "Response submitted" : "Draft saved", submit ? (nextStatus === "awaiting_adviser" ? "The Chapter Adviser may now review and certify the form." : "The response is now awaiting administrative review.") : "Your answers were saved privately.");
  if (submit) setTimeout(() => go(`/chapter/forms/view?id=${encodeURIComponent(assignment.id)}`), 1100);
}
'''

pattern = re.compile(r'async function saveResponse\(\{ submit = false \} = \{\}\) \{.*?\n\}\n\nasync function reviewResponse', re.S)
match = pattern.search(js)
if match and "selectedFileCount" not in match.group(0):
    js = pattern.sub(new_save_response + "\nasync function reviewResponse", js, count=1)

js_path.write_text(js, encoding="utf-8")

# Limit history-event creation to the actor class that actually owns each event.
rules_path = Path("firestore.rules")
rules = rules_path.read_text(encoding="utf-8")
old_history = '''        && request.resource.data.eventType in [
          'director_submitted', 'response_submitted', 'approved',
          'changes_requested', 'denied', 'waived'
        ]
        && request.resource.data.actorUid == request.auth.uid
        && request.resource.data.actorName is string'''
new_history = '''        && request.resource.data.actorUid == request.auth.uid
        && ((canReviewRequiredForms()
              && request.resource.data.eventType in [
                'approved', 'changes_requested', 'denied', 'waived'
              ]
              && request.resource.data.actorRole in [
                'owner', 'chapterAdmin', 'complianceAdmin'
              ])
            || (hasChapterMembershipRole(assignment.chapterId, ['director', 'adviser'])
              && request.resource.data.eventType in [
                'director_submitted', 'response_submitted'
              ]
              && request.resource.data.actorRole == chapterMembership(assignment.chapterId).role))
        && request.resource.data.actorName is string'''
if old_history in rules:
    rules = rules.replace(old_history, new_history, 1)
rules_path.write_text(rules, encoding="utf-8")

print("Final Phase 9 reliability patch applied.")
