import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePushSubscription, deletePushSubscription, VAPID_PUBLIC_KEY_CONST } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushSubscription() {
  const [status, setStatus] = useState<"unsupported" | "denied" | "granted" | "default" | "loading">("loading");
  const [subscribed, setSubscribed] = useState(false);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(deletePushSubscription);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as any);
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    const perm = await Notification.requestPermission();
    setStatus(perm as any);
    if (perm !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY_CONST),
      }));
    const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) return;
    await save({
      data: {
        endpoint: raw.endpoint,
        p256dh: raw.keys.p256dh,
        auth: raw.keys.auth,
        user_agent: navigator.userAgent,
      },
    });
    setSubscribed(true);
  }, [save]);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await remove({ data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, [remove]);

  return { status, subscribed, subscribe, unsubscribe };
}