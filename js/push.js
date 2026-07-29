/* ============================================================
   ELITE TRACKER — push.js
   -----------------------------------------------------------
   Web Push subscription registration only. Actually sending a
   notification happens server-side, in the send-nudge Edge
   Function, which is the only place that holds the VAPID private
   key — this module's job is just to get a device's subscription
   saved to push_subscriptions so that function has somewhere to
   send to. No-ops in mock mode, without notification permission,
   or on browsers without Push support.
   ============================================================ */
(function (global) {
  'use strict';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function subscribe() {
    const c = global.Supa && global.Supa.getClient();
    const session = global.Auth && global.Auth.getSession();
    const vapidKey = global.Supa && global.Supa.VAPID_PUBLIC_KEY;
    if (!c || !session || !vapidKey) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      const json = sub.toJSON();
      await c.from('push_subscriptions').upsert({
        profile_id: session.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }, { onConflict: 'profile_id,endpoint' });
    } catch (e) { console.warn('push subscribe failed', e); }
  }

  global.Push = { subscribe };
})(window);
