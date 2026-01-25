// public/js/sw.js - SERVICE WORKER FOR PWA
const CACHE_NAME = 'smart-dashboard-v3.0';
const urlsToCache = [
    '/',
    '/dashboard',
    '/settings',
    '/account',
    '/css/style.css',
    '/js/dashboard.js',
    '/js/settings.js',
    '/js/account.js',
    '/js/auth-check.js',
    '/js/icon-picker.js',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://unpkg.com/gridstack@10.1.2/dist/gridstack.min.css',
    'https://unpkg.com/gridstack@10.1.2/dist/gridstack-all.js'
];

// Install event
self.addEventListener('install', event => {
    console.log('📦 SW: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📂 SW: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ SW: Installation complete');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ SW: Installation failed:', error);
            })
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('🔄 SW: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ SW: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ SW: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip API requests
    if (event.request.url.includes('/api/')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if available
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    // Add to cache
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                // Return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline');
                }
            })
    );
});

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('🔄 SW: Background sync triggered');
        event.waitUntil(
            // Handle queued operations
            syncQueuedOperations()
        );
    }
});

// Push notifications
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            data: data.data,
            actions: [
                {
                    action: 'view',
                    title: 'عرض',
                    icon: '/icons/view.png'
                },
                {
                    action: 'dismiss',
                    title: 'إغلاق',
                    icon: '/icons/dismiss.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/dashboard')
        );
    }
});

// Helper functions
async function syncQueuedOperations() {
    try {
        // Get queued commands from IndexedDB or localStorage
        const queuedCommands = await getQueuedCommands();
        
        for (const command of queuedCommands) {
            try {
                await fetch('/api/adafruit/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': command.token
                    },
                    body: JSON.stringify({
                        feed: command.feedName,
                        value: command.command
                    })
                });
                
                // Remove from queue on success
                await removeFromQueue(command.id);
                
            } catch (error) {
                console.error('SW: Failed to sync command:', error);
            }
        }
    } catch (error) {
        console.error('SW: Background sync failed:', error);
    }
}

async function getQueuedCommands() {
    // Implementation to get queued commands
    return [];
}

async function removeFromQueue(commandId) {
    // Implementation to remove command from queue
}
