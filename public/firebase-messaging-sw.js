importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA3G-4IizzY20PbGKWUHFRh_014c_ewNbE',
  authDomain: 'studentplanner-7553f.firebaseapp.com',
  projectId: 'studentplanner-7553f',
  storageBucket: 'studentplanner-7553f.firebasestorage.app',
  messagingSenderId: '613640105952',
  appId: '1:613640105952:web:b41d4ad3bb05db44bbc585',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const isCall = d.type === 'incomingCall';

  self.registration.showNotification(d.title || 'Student Planner', {
    body: d.body || '',
    icon: d.icon || '/icons.svg',
    tag: d.notificationId || (isCall ? `call-${d.callId || 'incoming'}` : undefined),
    renotify: isCall,
    requireInteraction: isCall,
    silent: false,
    vibrate: isCall ? [700, 250, 700, 250, 900] : [180, 80, 180],
    data: d,
    actions: isCall
      ? [
          { action: 'accept', title: 'Accept' },
          { action: 'decline', title: 'Decline' },
        ]
      : [],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const d = event.notification.data || {};
  const action = event.action || '';
  const route = d.route || '/';

  const target = new URL(route, self.location.origin);

  if (d.type === 'incomingCall' && d.callId && (action === 'accept' || action === 'decline')) {
    target.searchParams.set('callAction', action);
    target.searchParams.set('callId', d.callId);
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if ('navigate' in client) {
          try { await client.navigate(target.href); } catch {}
        }
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target.href);
    })
  );
});
