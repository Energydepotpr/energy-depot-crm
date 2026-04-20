'use client';
import { useEffect } from 'react';

const VAPID_PUBLIC_KEY = 'BGSqphDkH0L70s3CqpOsMnBu2I4Dpzq9uE1W4QfoSjuGMFKMaEtujIUZdZYGCRHaPJf5HiVL6j4khhbf-vGr1KI';
const BACKEND = typeof window !== 'undefined' ? '/backend' : 'http://localhost:3001';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Force reload when a new SW takes control (clears old cached JS)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(async (registration) => {
        // Check for updates immediately
        registration.update();
        // If a new SW is waiting, activate it now
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        // iOS standalone PWA: PushManager available only when added to Home Screen
        if (!('PushManager' in window)) {
          // Mark that push is not available (iOS Safari without Home Screen install)
          sessionStorage.setItem('push_unavailable', '1');
          return;
        }
        if (Notification.permission === 'denied') return;
        if (Notification.permission === 'granted') {
          await subscribeToPush(registration);
          return;
        }
        // Request permission after short delay
        setTimeout(async () => {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            await subscribeToPush(registration);
          }
        }, 4000);
      })
      .catch(err => console.warn('[PWA] SW error:', err));
  }, []);

  return null;
}

async function subscribeToPush(registration) {
  try {
    const token = localStorage.getItem('crm_token');
    if (!token) return;

    const existing = await registration.pushManager.getSubscription();
    if (existing) return;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await fetch(`${BACKEND}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription }),
    });

    console.log('[PWA] Push subscription saved');
  } catch (err) {
    console.warn('[PWA] Push subscribe error:', err.message);
  }
}
