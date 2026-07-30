"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";

interface PagenPingToast {
  id: string;
  title: string;
  message: string;
  type?: "order" | "system" | "promo" | "info";
}

const TOAST_DURATION = 5000; // 5 seconds

// Global toast queue — components call showPagenPing() from anywhere
let toastListener: ((toast: PagenPingToast) => void) | null = null;

export function showPagenPing(title: string, message: string, type: PagenPingToast["type"] = "order") {
  if (toastListener) {
    toastListener({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      type,
    });
  }
}

export default function PagenPingProvider() {
  const [toasts, setToasts] = useState<PagenPingToast[]>([]);

  useEffect(() => {
    toastListener = (toast) => {
      setToasts((prev) => [...prev, toast]);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col items-center pointer-events-none px-4 pt-3 gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <PagenPingBar key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function PagenPingBar({ toast, onDismiss }: { toast: PagenPingToast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const borderColor = toast.type === "order" 
    ? "border-indigo-500/60" 
    : toast.type === "system" 
      ? "border-[#fde293]/60" 
      : "border-[#8ab4f8]/60";

  const iconBg = toast.type === "order" 
    ? "bg-indigo-500/20 text-indigo-400" 
    : toast.type === "system" 
      ? "bg-[#fde293]/20 text-[#fde293]" 
      : "bg-[#8ab4f8]/20 text-[#8ab4f8]";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={`w-full max-w-lg pointer-events-auto rounded-xl border ${borderColor} bg-black/80 backdrop-blur-md shadow-2xl shadow-black/40 overflow-hidden`}
    >
      {/* Content */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Bell size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{toast.title}</p>
          <p className="text-[#9aa0a6] text-xs truncate">{toast.message}</p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 text-[#5f6368] hover:text-white transition-colors p-1"
        >
          <X size={14} />
        </button>
      </div>

      {/* The 5-second disappearing timer line */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: TOAST_DURATION / 1000, ease: "linear" }}
        style={{ transformOrigin: "left" }}
        className="h-[2px] bg-gradient-to-r from-indigo-500 via-[#8ab4f8] to-indigo-400"
      />
    </motion.div>
  );
}
