import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyDtn5Tt5syKJm9gQi-tQRGYLv0_636C13Y",
  authDomain: "tpp-chapters.firebaseapp.com",
  projectId: "tpp-chapters",
  messagingSenderId: "962501948087",
  appId: "1:962501948087:web:d145a48db8bac5f3d41332"
});

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Unable to set Firebase Auth persistence.", error);
  });
