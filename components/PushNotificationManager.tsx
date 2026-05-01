"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
      setPermission(Notification.permission);
    }
  }, []);

  const checkSubscription = async () => {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    setSubscription(sub);
  };

  const subscribe = async () => {
    setIsSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; 
      
      if (!publicKey) throw new Error("VAPID public key missing");

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      setSubscription(sub);
      setPermission("granted");
      
      // Save subscription to the backend profile
      await fetch('/api/push/subscribe', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }) 
      });
      
      console.log("Subscribed:", sub);
    } catch (err) {
      console.error("Failed to subscribe:", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const unsubscribe = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      setSubscription(null);
      // TODO: Remove from backend
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
            <h3 className="text-lg font-bold text-white">Ghost Pings</h3>
            <p className="text-xs text-[#9aa0a6]">Get real-time order alerts</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[#9aa0a6] leading-relaxed">
            {subscription 
              ? "You're all set! We'll ping you as soon as a nearby order matches your route." 
              : "Enable push notifications to receive 'Ghost Pings' when buyers request prints nearby."}
          </p>

          <AnimatePresence mode="wait">
            {!subscription ? (
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
                ) : (
                  <>Enable Notifications</>
                )}
              </motion.button>
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
