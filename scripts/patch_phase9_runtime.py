from pathlib import Path

path = Path("assets/js/phase9.js")
text = path.read_text(encoding="utf-8")

text = text.replace(
    "function augmentExistingPortal() {\n  const chapterNav = document.querySelector(\".cp2-nav\");",
    "function augmentExistingPortal() {\n  if (document.querySelector(\"[data-phase9-root]\")) return;\n  const chapterNav = document.querySelector(\".cp2-nav\");"
)

old_validation = '''function validateRequiredAnswers(role, answers) {
  const schema = schemaForAssignment(state.currentAssignment);
  for (const section of schema.sections) {
    for (const field of section.fields.filter((item) => (item.role || initialStep(state.currentAssignment.workflow)) === role && item.required !== false && item.type !== "file")) {
      const value = answers[field.id];
      if (field.type === "acknowledgment" && value !== true) throw new Error(`Confirm: ${field.label}`);
      if (Array.isArray(value) && !value.length) throw new Error(`Complete: ${field.label}`);
      if (!Array.isArray(value) && value !== true && !String(value ?? "").trim()) throw new Error(`Complete: ${field.label}`);
    }
  }
}'''

new_validation = '''function validateRequiredAnswers(role, answers, form) {
  const schema = schemaForAssignment(state.currentAssignment);
  for (const section of schema.sections) {
    for (const field of section.fields.filter((item) => (item.role || initialStep(state.currentAssignment.workflow)) === role && item.required !== false)) {
      if (field.type === "file") {
        const alreadyUploaded = state.currentAttachments.some((item) => item.fieldId === field.id);
        const selected = form.querySelector(`input[type="file"][data-field-id="${CSS.escape(field.id)}"]`)?.files?.length || 0;
        if (!alreadyUploaded && !selected) throw new Error(`Attach the required file: ${field.label}`);
        continue;
      }
      const value = answers[field.id];
      if (field.type === "acknowledgment" && value !== true) throw new Error(`Confirm: ${field.label}`);
      if (Array.isArray(value) && !value.length) throw new Error(`Complete: ${field.label}`);
      if (!Array.isArray(value) && value !== true && !String(value ?? "").trim()) throw new Error(`Complete: ${field.label}`);
    }
  }
}'''

if old_validation not in text:
    raise SystemExit("Could not locate required-answer validation")
text = text.replace(old_validation, new_validation, 1)
text = text.replace("    validateRequiredAnswers(role, answers);", "    validateRequiredAnswers(role, answers, form);", 1)

old_review = '''  if (["changes_requested", "denied"].includes(status) && note.length < 10) throw new Error("Provide an administrative note of at least ten characters.");
  if (status === "approved" && !state.currentResponse) throw new Error("A response must exist before this assignment can be approved.");
  const assignment = state.currentAssignment;'''
new_review = '''  if (["changes_requested", "denied"].includes(status) && note.length < 10) throw new Error("Provide an administrative note of at least ten characters.");
  if (["approved", "changes_requested", "denied"].includes(status)
      && !["submitted", "under_review"].includes(state.currentResponse?.status)) {
    throw new Error("The chapter must formally submit this response before an administrative decision can be recorded.");
  }
  const assignment = state.currentAssignment;'''
if old_review not in text:
    raise SystemExit("Could not locate administrative review guard")
text = text.replace(old_review, new_review, 1)

path.write_text(text, encoding="utf-8")
print("Phase 9 runtime hardening applied.")
