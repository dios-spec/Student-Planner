/**
 * Firebase Cloud Messaging service worker.
 *
 * Registered by src/firebase/push.ts on its own scope
 * (/firebase-cloud-messaging-push-scope) so it can never replace the Workbox
 * root worker that serves the app shell.
 *
 * SDK VERSION: pinned to 12.18.0 to match the `firebase` version the app
 * bundles (package.json). Both compat URLs were verified to exist and
 * firebase-app-compat.js self-reports SDK_VERSION 12.18.0. Keep these two lines
 * and the package.json dependency in step -- a version that 404s here takes
 * push delivery to zero, silently, because the worker cannot start at all.
 */
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');
importScripts('/notification-presentation.js');

// Activate a new worker immediately. This scope contains no pages, so there is
// no risk of swapping the controller out from under a live document.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

var messagingReady = false;

try {
  firebase.initializeApp({
    apiKey: 'AIzaSyA3G-4IizzY20PbGKWUHFRh_014c_ewNbE',
    authDomain: 'studentplanner-7553f.firebaseapp.com',
    projectId: 'studentplanner-7553f',
    storageBucket: 'studentplanner-7553f.firebasestorage.app',
    messagingSenderId: '613640105952',
    appId: '1:613640105952:web:b41d4ad3bb05db44bbc585',
  });

  var messaging = firebase.messaging();

  // From this point the FCM SDK has installed its OWN push listener, so the
  // raw fallback below must never also be installed -- that would display
  // every notification twice. Registering the background handler is tracked
  // separately: if only that step fails we are degraded, not duplicated.
  messagingReady = true;

  messaging.onBackgroundMessage(function (payload) {
    handlePayload(payload && payload.data);
  });
} catch (err) {
  // Do not let a broken SDK mean zero notifications.
  console.error('[FCM SW] messaging init failed, using raw push fallback', err);
}

/**
 * Fallback only. The FCM SDK installs its own push listener, so registering
 * this unconditionally would display every notification twice.
 */
if (!messagingReady) {
  self.addEventListener('push', function (event) {
    var data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch (err) {
      data = {};
    }
    event.waitUntil(handlePayload(data.data || data));
  });
}

/** Close any notification currently carrying this tag. */
function closeByTag(tag) {
  return self.registration.getNotifications({ tag: tag }).then(function (list) {
    list.forEach(function (n) { n.close(); });
  });
}

function handlePayload(data) {
  var view = self.BuddyNotification.presentation(data || {}, self.location.origin);

  // A control payload (the server telling us a call stopped ringing). Take the
  // ringing notification off the lock screen and show nothing new.
  if (view.dismiss) return closeByTag(view.tag);

  return self.registration.showNotification(view.title, view.options);
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var d = event.notification.data || {};
  var action = event.action || '';
  var route = d.route || '/';

  var target;
  try {
    var candidate = new URL(route, self.location.origin);
    target = candidate.origin === self.location.origin ? candidate : new URL('/', self.location.origin);
  } catch (err) {
    target = new URL('/', self.location.origin);
  }

  if (d.type === 'incomingCall' && d.callId && (action === 'accept' || action === 'decline')) {
    target.searchParams.set('callAction', action);
    target.searchParams.set('callId', d.callId);
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windows) {
        // Only ever reuse a window belonging to this app.
        var own = windows.filter(function (client) {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch (err) {
            return false;
          }
        });

        // Prefer a window that is already focused, then any other. The previous
        // version navigated EVERY window it walked past before focusing one,
        // which could yank an unrelated open tab to the notification's route.
        var client = own.filter(function (c) { return c.focused; })[0] || own[0];

        if (client) {
          var focused = 'focus' in client ? client.focus() : Promise.resolve(client);
          return Promise.resolve(focused).then(function (active) {
            var handle = active || client;
            if ('navigate' in handle) {
              return handle.navigate(target.href).catch(function () { return handle; });
            }
            return handle;
          });
        }

        if (self.clients.openWindow) return self.clients.openWindow(target.href);
        return undefined;
      })
  );
});
