"use client";

import { useEffect, useState, useTransition } from "react";
import { isAppleMobile, registerServiceWorker } from "@/components/pwa";
import { CheckIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./actions";

/** "ios": an iPhone or iPad browser tab, which can't take notifications until the app is on the Home Screen. */
type Status = "loading" | "unsupported" | "ios" | "blocked" | "off" | "on";

/** The VAPID public key in the raw bytes PushManager.subscribe() wants. */
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentStatus(): Promise<Status> {
  if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) {
    return isAppleMobile() ? "ios" : "unsupported";
  }
  const registration = await registerServiceWorker();
  if (await registration.pushManager.getSubscription()) return "on";
  return Notification.permission === "denied" ? "blocked" : "off";
}

/** Turns push notifications on or off for this device, and sends a test. */
export function NotificationSettings({ vapidKey, language }: { vapidKey: string | null; language: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [note, setNote] = useState<{ text: string; isError: boolean }>();
  const [working, startWorking] = useTransition();
  const t = getMessages(language).account.notifications;

  useEffect(() => {
    if (!vapidKey) return;
    let cancelled = false;
    currentStatus().then(
      (next) => !cancelled && setStatus(next),
      () => !cancelled && setStatus("unsupported"),
    );
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  const fail = (error: unknown) => {
    console.error("Changing notifications failed", error);
    setNote({ text: t.failed, isError: true });
  };

  function turnOn() {
    setNote(undefined);
    startWorking(async () => {
      try {
        // Asked straight from the tap: Safari only shows the prompt for a user gesture.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "blocked" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(vapidKey!),
        });
        const { endpoint, keys } = subscription.toJSON();
        const result = await savePushSubscription({
          endpoint: endpoint ?? "",
          keys: { p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" },
        });
        if (result.error) {
          await subscription.unsubscribe();
          setNote({ text: result.error, isError: true });
          return;
        }
        setStatus("on");
      } catch (error) {
        fail(error);
      }
    });
  }

  function turnOff() {
    setNote(undefined);
    startWorking(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          const result = await removePushSubscription(subscription.endpoint);
          if (result.error) setNote({ text: result.error, isError: true });
        }
        setStatus("off");
      } catch (error) {
        fail(error);
      }
    });
  }

  function test() {
    setNote(undefined);
    startWorking(async () => {
      const result = await sendTestPush();
      setNote(result.error ? { text: result.error, isError: true } : { text: t.testSent, isError: false });
    });
  }

  const message = !vapidKey
    ? t.notConfigured
    : { loading: "", unsupported: t.unsupported, ios: t.iosInstall, blocked: t.blocked, off: t.off, on: t.on }[status];

  return (
    <div className="grid gap-3">
      {message && <p className="font-medium text-muted">{message}</p>}
      {vapidKey && (status === "off" || status === "on") && (
        <div className="flex flex-wrap gap-2">
          {status === "off" ? (
            <button className="btn" disabled={working} onClick={turnOn}>
              {working ? t.working : t.turnOn}
            </button>
          ) : (
            <>
              <button className="btn-quiet" disabled={working} onClick={test}>
                {working ? t.working : t.test}
              </button>
              <button className="btn-quiet" disabled={working} onClick={turnOff}>
                {t.turnOff}
              </button>
            </>
          )}
        </div>
      )}
      {note && (
        <p
          role={note.isError ? "alert" : "status"}
          className={
            note.isError
              ? "text-sm font-semibold text-danger"
              : "inline-flex items-center gap-1.5 justify-self-start rounded-control border-2 border-outline bg-accent-soft px-2.5 py-0.5 text-sm font-bold"
          }
        >
          {!note.isError && <CheckIcon />}
          {note.text}
        </p>
      )}
    </div>
  );
}
