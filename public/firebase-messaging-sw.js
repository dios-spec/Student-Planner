importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA3G-4IizzY20PbGKWUHFRh_014c_ewNbE",
  authDomain: "studentplanner-7553f.firebaseapp.com",
  projectId: "studentplanner-7553f",
  storageBucket: "studentplanner-7553f.firebasestorage.app",
  messagingSenderId: "613640105952",
  appId: "1:613640105952:web:b41d4ad3bb05db44bbc585",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title || "New message", {
    body: payload.notification?.body || "",
    icon: "/icons/icon-192.png",
  });
});
