const permissionMessage = (value) => /missing or insufficient permissions|permission[- ]denied|permission denied/i.test(String(value || ""));

function stopBackgroundPermissionError(event, value) {
  if (!permissionMessage(value)) return;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  window.dispatchEvent(new CustomEvent("tpp:background-permission-error", {
    detail: { message: String(value || "Missing or insufficient permissions.") }
  }));
}

window.addEventListener("unhandledrejection", (event) => {
  stopBackgroundPermissionError(event, event.reason?.message || event.reason);
}, true);

window.addEventListener("error", (event) => {
  stopBackgroundPermissionError(event, event.error?.message || event.message);
}, true);
