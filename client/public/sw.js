self.addEventListener("push", (event) => {
  let data = { title: "Par for the Course", body: "New update available" };
  try {
    data = event.data.json();
  } catch (e) {
    // fallback
  }

  const options = {
    body: data.body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: data.url || "/",
    vibrate: [200, 100, 200],
    tag: data.tag || "default",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
