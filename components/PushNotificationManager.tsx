"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Register the service worker and return the registration.
// This MUST happen before any .ready or .subscribe calls.
async function registerSW(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  // Wait until the SW is active (might take a moment on first install)
  if (registration.installing) {
    await new Promise<void>((resolve) => {
      registration.installing!.addEventListener("statechange", (e) => {
        if ((e.target as ServiceWorker).state === "activated") resolve();
      });
    });
  }
  return navigator.serviceWorker.ready;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);

      // Register SW first, then check existing subscription
      registerSW()
        .then(async (reg) => {
          const sub = await reg.pushManager.getSubscription();
          setSubscription(sub);
        })
        .catch((err) => {
          console.error("SW registration failed:", err);
        });
    }
  }, []);

  const subscribe = async () => {
    setIsSubscribing(true);
    setError(null);

    // Timeout failsafe — never spin longer than 10 seconds
    const timeout = setTimeout(() => {
      setIsSubscribing(false);
      setError("Timed out. Check browser permissions.");
    }, 10000);

    try {
      const registration = await registerSW();
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) throw new Error("VAPID public key not configured");

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      setSubscription(sub);
      setPermission("granted");
      
      // Play confirmation sound + vibrate
      try {
        const audio = new Audio('/faaah.mp3');
        audio.volume = 1.0;
        await audio.play();
      } catch (e) {
        console.warn("Could not play sound", e);
      }
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 300]);

      // Save subscription to the backend profile
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });

      // Mark notifications_enabled = true in profile
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications_enabled: true }),
      });

      console.log("Push subscribed:", sub.endpoint);
    } catch (err: any) {
      console.error("Failed to subscribe:", err);
      setError(err.message || "Subscription failed");
    } finally {
      clearTimeout(timeout);
      setIsSubscribing(false);
    }
  };

  const unsubscribe = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      setSubscription(null);

      // Clear subscription from backend & disable notifications
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: null }),
      });
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications_enabled: false }),
      });
    }
  };

  if (!isSupported) return null;

  return (
    <div className="p-6 bg-[#292a2d] border border-[#3c4043] rounded-3xl overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Zap size={60} className="text-[#8ab4f8]" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-xl ${subscription ? "bg-emerald-500/10 text-emerald-400" : "bg-[#8ab4f8]/10 text-[#8ab4f8]"}`}>
            {subscription ? <Bell size={20} /> : <BellOff size={20} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Pagen Pings</h3>
            <p className="text-xs text-[#9aa0a6]">Get real-time order alerts</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[#9aa0a6] leading-relaxed">
            {subscription 
              ? "You're all set! We'll ping you as soon as a nearby order matches your route." 
              : "Enable push notifications to receive 'Pagen Pings' when buyers request prints nearby."}
          </p>

          <AnimatePresence mode="wait">
            {!subscription ? (
              <div className="space-y-2">
                <motion.button
                  key="subscribe"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={subscribe}
                  disabled={isSubscribing}
                  className="w-full py-3 rounded-xl bg-[#8ab4f8] text-[#202124] font-bold text-sm hover:bg-[#aecbfa] transition-all flex items-center justify-center gap-2"
                >
                  {isSubscribing ? (
                    <div className="w-4 h-4 border-2 border-[#202124]/20 border-t-[#202124] rounded-full animate-spin" />
                  ) : error ? (
                    <>Retry</>
                  ) : (
                    <>Enable Notifications</>
                  )}
                </motion.button>
                {error && (
                  <p className="text-xs text-[#ea4335] text-center">{error}</p>
                )}
              </div>
            ) : (
              <motion.div
                key="subscribed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck size={16} /> Notifications Active
                </div>
                <button 
                  onClick={unsubscribe}
                  className="text-[#9aa0a6] hover:text-white text-xs underline underline-offset-4 transition-colors"
                >
                  Disable
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
