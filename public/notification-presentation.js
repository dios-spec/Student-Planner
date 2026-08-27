/**
 * Single source of truth for how a push payload becomes a displayed notification.
 *
 * Loaded by firebase-messaging-sw.js via importScripts(), and exercised directly
 * by src/utils/notificationPresentation.test.ts. It is a classic script (not a
 * module) because importScripts() cannot load ES modules.
 *
 * Everything here is pure: payload in, description of a notification out. The
 * service worker does the displaying.
 */
(function (root) {
  'use strict';

  var DEFAULT_ICON = '/icons.svg';
  var BADGE = '/icons.svg';

  /**
   * Every top-level route the app actually registers (see src/App.tsx).
   * A notification may only navigate to one of these. A same-origin path that
   * matches no route would render a blank screen, which is a worse outcome
   * than simply opening the app, so anything unknown falls back to '/'.
   */
  var KNOWN_ROUTES = [
    '/', '/chat', '/merits', '/messages', '/notifications', '/planner',
    '/profile', '/reels', '/saved', '/settings/notifications', '/study',
    '/timetable', '/upcoming',
  ];

  /** Types that represent a live, ringing call. */
  function isRingingCall(type) {
    return type === 'incomingCall';
  }

  /**
   * A control payload, not something to display. The server sends this when a
   * call stops ringing so the service worker can take the ringing notification
   * off the lock screen instead of leaving it there forever.
   */
  function isCallDismissal(type) {
    return type === 'callEnded';
  }

  /**
   * Stable grouping key.
   *
   * This used to be `notificationId || (isCall ? 'call-...' : undefined)`.
   * notificationId is always present, so the call branch was dead code and
   * every ring produced a NEW notification that nothing could later replace or
   * close. Call notifications now share one tag per callId, which means:
   *   - a re-ring replaces rather than stacks
   *   - the missed-call notification REPLACES the ringing one
   *   - a callEnded control message can close it by tag
   * Chat messages group per conversation so a burst in one thread collapses
   * into a single line instead of twenty.
   */
  function tagFor(d) {
    var type = d.type || '';
    if (isRingingCall(type) || isCallDismissal(type) || type === 'missedCall') {
      return d.callId ? 'call-' + d.callId : 'call';
    }
    if ((type === 'dm' || type === 'groupMessage') && d.conversationId) {
      return 'conv-' + d.conversationId;
    }
    if ((type === 'comment' || type === 'reply') && d.postId) {
      return 'post-' + d.postId;
    }
    return d.notificationId || 'buddy-planner';
  }

  /**
   * Only same-origin app routes are ever navigated to.
   *
   * Mirrors safeRoute() in api/send-push.js: a path must start with a slash
   * followed by an alphanumeric character. Without that check, junk like
   * 'not a url ://' resolves to a same-origin path that matches no route and
   * drops the user on a blank screen.
   */
  function safeRoute(route, origin) {
    try {
      var candidate = new URL(route || '/', origin);
      if (candidate.origin !== origin) return '/';
      if (KNOWN_ROUTES.indexOf(candidate.pathname) === -1) return '/';
      return candidate.pathname + candidate.search + candidate.hash;
    } catch (err) {
      return '/';
    }
  }

  /**
   * Lock-screen text. Titles are already the sender name or a short system
   * label; bodies are capped so a long message cannot spill someone's private
   * conversation across a lock screen in full.
   */
  function trim(value, max) {
    var text = typeof value === 'string' ? value : '';
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trimEnd() + '…';
  }

  function presentation(data, origin) {
    var d = data || {};
    var type = d.type || '';

    if (isCallDismissal(type)) {
      return { dismiss: true, tag: tagFor(d) };
    }

    var ringing = isRingingCall(type);

    return {
      dismiss: false,
      title: trim(d.title, 60) || 'Buddy Planner',
      options: {
        body: trim(d.body, 140),
        icon: d.icon || DEFAULT_ICON,
        badge: BADGE,
        tag: tagFor(d),
        // Re-alert for a ring and for chat bursts, which share a tag with an
        // existing notification and would otherwise update silently.
        renotify: ringing || type === 'dm' || type === 'groupMessage',
        requireInteraction: ringing,
        silent: false,
        vibrate: ringing ? [700, 250, 700, 250, 900] : [180, 80, 180],
        data: Object.assign({}, d, { route: safeRoute(d.route, origin) }),
        actions: ringing
          ? [
              { action: 'accept', title: 'Accept' },
              { action: 'decline', title: 'Decline' },
            ]
          : [],
      },
    };
  }

  root.BuddyNotification = {
    presentation: presentation,
    tagFor: tagFor,
    safeRoute: safeRoute,
    isRingingCall: isRingingCall,
    isCallDismissal: isCallDismissal,
  };
})(typeof self !== 'undefined' ? self : globalThis);
