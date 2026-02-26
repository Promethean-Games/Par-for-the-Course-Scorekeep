const SW_PATH = "/sw.js";

export async function isPushSupported(): Promise<boolean> {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPermissionState(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(SW_PATH);
  await navigator.serviceWorker.ready;
  return registration;
}

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-key");
  const data = await res.json();
  return data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(options?: {
  deviceId?: string;
  tournamentRoomCode?: string;
  universalPlayerId?: number;
  directorPin?: string;
}): Promise<boolean> {
  try {
    if (!(await isPushSupported())) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await registerServiceWorker();
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        deviceId: options?.deviceId || null,
        tournamentRoomCode: options?.tournamentRoomCode || null,
        universalPlayerId: options?.universalPlayerId || null,
        directorPin: options?.directorPin || null,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("Failed to subscribe to push:", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
    return true;
  } catch (err) {
    console.error("Failed to unsubscribe from push:", err);
    return false;
  }
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  try {
    if (!(await isPushSupported())) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
