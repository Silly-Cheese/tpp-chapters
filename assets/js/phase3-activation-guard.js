import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";

const CREATE_FORM_ID = "activation-create-form";
const EXISTING_FORM_ID = "activation-existing-form";

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeInviteCode(value = "") {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/^TPP-/, "")
    .replace(/[^A-Z2-9]/g, "");
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.split("?")[0];
  return (path.startsWith("/") ? path : `/${path}`).replace(/\/+$/, "") || "/";
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function alertMarkup(type, title, message) {
  return `<div class="alert alert-${type}"><div><strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span></div></div>`;
}

function setAlert(type, title, message) {
  const target = document.querySelector("#activation-alert");
  if (target) target.innerHTML = alertMarkup(type, title, message);
}

function invitationExpired(invite) {
  const expiresAt = invite?.expiresAt?.toDate?.() || new Date(invite?.expiresAt || 0);
  return !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
}

async function loadInvitation() {
  const code = normalizeInviteCode(sessionStorage.getItem("tppActivationCode") || "");
  if (code.length !== 20) throw new Error("The activation code is no longer loaded. Enter it again.");
  const invitationId = await sha256Hex(code);
  const snapshot = await getDoc(doc(db, "chapterInvitations", invitationId));
  if (!snapshot.exists()) throw new Error("This activation code is invalid, expired, revoked, or already used.");
  const invitation = { id: snapshot.id, ...snapshot.data() };
  if (invitation.status !== "pending" || invitationExpired(invitation)) {
    throw new Error("This activation code is no longer available.");
  }
  return invitation;
}

async function claimInvitation(user, displayName, invitation) {
  if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
    throw new Error("The authenticated email does not match this invitation.");
  }

  const userRef = doc(db, "systemUsers", user.uid);
  const invitationRef = doc(db, "chapterInvitations", invitation.id);
  const membershipRef = doc(db, "chapterMemberships", `${invitation.chapterId}__${user.uid}`);
  const profileSnapshot = await getDoc(userRef);
  const batch = writeBatch(db);

  batch.update(invitationRef, {
    status: "claimed",
    claimedByUid: user.uid,
    claimedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (!profileSnapshot.exists()) {
    batch.set(userRef, {
      displayName,
      email: normalizeEmail(user.email),
      systemRole: invitation.role,
      accountStatus: "active",
      primaryChapterId: invitation.chapterId,
      primaryChapterRole: invitation.role,
      activationInvitationId: invitation.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  batch.set(membershipRef, {
    uid: user.uid,
    email: normalizeEmail(user.email),
    displayName,
    chapterId: invitation.chapterId,
    chapterName: invitation.chapterName,
    role: invitation.role,
    status: "active",
    invitationId: invitation.id,
    grantedBy: "invitation",
    grantedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  sessionStorage.removeItem("tppActivationInviteId");
  sessionStorage.removeItem("tppActivationCode");
}

async function sendVerification(user) {
  if (user.emailVerified) return;
  try {
    await sendEmailVerification(user, { url: `${location.origin}/#/verify-email` });
  } catch (error) {
    console.warn("The account was activated, but Firebase did not send the first verification email.", error);
  }
}

function validateCreateForm(form) {
  const displayName = form.displayName.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  if (displayName.length < 2) throw new Error("Enter your full name.");
  if (password.length < 10) throw new Error("Use a password with at least 10 characters.");
  if (password !== confirmPassword) throw new Error("The passwords do not match.");
  if (!form.acknowledgment.checked) throw new Error("Confirm that the invitation was assigned to you.");
  return { displayName, password };
}

async function activateNewAccount(form) {
  const submit = form.querySelector("#activation-create-submit");
  submit.disabled = true;
  submit.textContent = "Creating account…";
  let credential;
  try {
    const invitation = await loadInvitation();
    const { displayName, password } = validateCreateForm(form);
    if (auth.currentUser) await signOut(auth);
    credential = await createUserWithEmailAndPassword(auth, normalizeEmail(invitation.email), password);
    await updateProfile(credential.user, { displayName });
    await claimInvitation(credential.user, displayName, invitation);
    await sendVerification(credential.user);
    location.hash = credential.user.emailVerified ? "/activation-complete" : "/verify-email";
  } catch (error) {
    console.error(error);
    const message = error?.code === "auth/email-already-in-use"
      ? "An account already exists for this email. Choose “Use an existing account” instead."
      : error?.code === "auth/weak-password"
        ? "Firebase rejected the password. Use a stronger password."
        : error?.message || "The account could not be activated.";
    setAlert("danger", "Activation failed", message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Create and activate account";
  }
}

async function activateExistingAccount(form) {
  const submit = form.querySelector("#activation-existing-submit");
  submit.disabled = true;
  submit.textContent = "Connecting account…";
  try {
    if (!form.acknowledgment.checked) throw new Error("Confirm that this account and invitation belong to you.");
    const invitation = await loadInvitation();
    if (auth.currentUser) await signOut(auth);
    const credential = await signInWithEmailAndPassword(auth, normalizeEmail(invitation.email), form.password.value);
    const displayName = credential.user.displayName || invitation.displayName || invitation.email.split("@")[0];
    await claimInvitation(credential.user, displayName, invitation);
    await sendVerification(credential.user);
    location.hash = credential.user.emailVerified ? "/activation-complete" : "/verify-email";
  } catch (error) {
    console.error(error);
    const message = error?.code === "auth/invalid-credential"
      ? "The password is incorrect for the assigned email address."
      : error?.message || "The invitation could not be connected to this account.";
    setAlert("danger", "Unable to connect account", message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Sign in and accept invitation";
  }
}

await authPersistenceReady;

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (![CREATE_FORM_ID, EXISTING_FORM_ID].includes(form.id)) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (form.id === CREATE_FORM_ID) activateNewAccount(form);
  else activateExistingAccount(form);
}, true);

document.addEventListener("click", (event) => {
  const dashboardLink = event.target.closest('a[href="#/dashboard"]');
  if (!dashboardLink || routeFromHash() !== "/activation-complete") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  location.hash = "/dashboard";
  location.reload();
}, true);
