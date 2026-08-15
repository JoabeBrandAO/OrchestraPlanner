/**
 * Service worker do OrchestraPlanner — só notificações (#36). Não faz cache nem
 * intercepta rede: o app é dinâmico e autenticado, e um cache aqui só criaria telas
 * velhas difíceis de explicar.
 */

// Assume o controle sem esperar a próxima visita, para o primeiro "Ativar notificações"
// já funcionar sem recarregar a página.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  // Sem dados legíveis, ainda assim avisa: melhor um aviso genérico do que silêncio.
  let payload = { title: "OrchestraPlanner", body: "Você tem um compromisso chegando.", url: "/dashboard/agenda" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Payload não-JSON: fica o texto padrão.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // A tag junta avisos do mesmo compromisso em vez de empilhar repetidos.
      tag: payload.tag || undefined,
      data: { url: payload.url },
      timestamp: payload.timestamp || Date.now(),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard/agenda";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Se a agenda já está aberta numa aba, foca nela em vez de abrir outra.
      for (const client of windows) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
