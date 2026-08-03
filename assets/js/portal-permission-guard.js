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

const appRoot = document.querySelector("#app");

if (appRoot) {
  const bridgePortalRoot = () => {
    const portal = appRoot.querySelector("[data-chapter-portal-v2]");
    if (portal && !portal.hasAttribute("data-phase4-root")) {
      portal.setAttribute("data-phase4-root", "");
    }
  };

  new MutationObserver(bridgePortalRoot).observe(appRoot, { childList: true, subtree: true });
  bridgePortalRoot();
}
