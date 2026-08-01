self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/Logo.jpg?v=2',
      badge: '/Logo.jpg?v=2',
      vibrate: [200, 100, 200, 100, 200], // Aggressive vibration for campus
      tag: data.tag || 'pagen-ping', // Prevents duplicate notifications
      renotify: true,
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || '1',
        url: data.url || '/dashboard',
        playSound: true
      },
      actions: [
        {
          action: 'view',
          title: '👀 View',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        },
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Pagen', options)
        .then(function() {
          // Tell all open clients to play the faaah sound
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        })
        .then(function(clientList) {
          clientList.forEach(function(client) {
            client.postMessage({
              type: 'PLAY_NOTIFICATION_SOUND',
              title: data.title,
              body: data.body
            });
          });
        })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const url = event.notification.data?.url || '/dashboard';
  
  if (event.action === 'dismiss') {
    return; // Just close
  }
  
  // Open the app or focus existing tab
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});

// Background sync — ensures notifications are delivered even on flaky campus WiFi
self.addEventListener('sync', function(event) {
  if (event.tag === 'pagen-sync') {
    // Future: retry failed notification deliveries
  }
});
