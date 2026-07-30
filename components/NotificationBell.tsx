"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck, ShoppingBag, Truck, Zap, Info } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
}

interface NotificationBellProps {
  unreadCount: number;
  notifications: Notification[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMarkAllRead: () => void;
}

export default function NotificationBell({
  unreadCount,
  notifications,
  isOpen,
  onToggle,
  onClose,
  onMarkAllRead,
}: NotificationBellProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "order": return <ShoppingBag size={14} />;
      case "system": return <Zap size={14} />;
      case "promo": return <Truck size={14} />;
      default: return <Info size={14} />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "order": return "bg-indigo-500/20 text-indigo-400";
      case "system": return "bg-[#fde293]/20 text-[#fde293]";
      case "promo": return "bg-[#81c995]/20 text-[#81c995]";
      default: return "bg-[#8ab4f8]/20 text-[#8ab4f8]";
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={onToggle}
        className="relative p-2 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        
        {/* Unread Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-indigo-500 text-white text-[10px] font-bold px-1 shadow-lg shadow-indigo-500/30"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] bg-[#292a2d] border border-[#3c4043] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-[200]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c4043]">
              <h3 className="text-sm font-semibold text-white">Pagen Pings</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-[10px] text-[#8ab4f8] hover:text-[#aecbfa] font-medium uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-[#5f6368] hover:text-white transition-colors p-1"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-[420px] scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#5f6368]">
                  <Bell size={32} className="mb-3 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                  <p className="text-xs mt-1">You'll see Pagen Pings here</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[#3c4043]/50 hover:bg-white/[0.02] transition-colors ${
                      !notif.is_read ? "bg-indigo-500/[0.04]" : ""
                    }`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${getIconBg(notif.type)}`}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!notif.is_read ? "text-white font-medium" : "text-[#e8eaed]"}`}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-[#9aa0a6] mt-0.5 leading-relaxed">{notif.message}</p>
                      <p className="text-[10px] text-[#5f6368] mt-1">{getTimeAgo(notif.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
