"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { showGhostPing } from "@/components/GhostPing";

interface Notification {
  id: string;
  user_email: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
}

/**
 * useNotifications — manages the bell icon unread count + realtime listener.
 * 
 * Flow:
 * 1. On mount, fetches unread count from /api/notifications
 * 2. Subscribes to Supabase Realtime INSERT events on `notifications` table
 * 3. When a new notification arrives:
 *    - Increments unread count
 *    - Fires a GhostPing toast
 *    - Plays a subtle notification sound (browser native)
 * 4. Exposes markAllRead() to clear the badge
 */
export function useNotifications(userEmail: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const channelRef = useRef<any>(null);

  // Fetch initial unread count + recent notifications
  const fetchNotifications = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [userEmail]);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    if (!userEmail) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  }, [userEmail]);

  // Toggle the notification panel
  const togglePanel = useCallback(() => {
    setIsOpen((prev) => {
      const newState = !prev;
      if (newState && unreadCount > 0) {
        // Mark as read when opening the panel
        markAllRead();
      }
      return newState;
    });
  }, [unreadCount, markAllRead]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!userEmail) return;

    // Initial fetch
    fetchNotifications();

    // Realtime listener — subscribe to ALL INSERTs on notifications table
    // NOTE: We don't use server-side filter because Supabase Realtime
    // breaks silently on filter values with @ and . (emails).
    // We check user_email client-side instead.
    const channel = supabase
      .channel(`ghost_pings_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload: any) => {
          const newNotif = payload.new as Notification;

          // Client-side filter: only process notifications for this user
          if (newNotif.user_email !== userEmail) return;
          
          // Update state
          setUnreadCount((prev) => prev + 1);
          setNotifications((prev) => [newNotif, ...prev].slice(0, 10)); // Keep last 10

          // Fire the GhostPing toast
          showGhostPing(
            newNotif.title,
            newNotif.message,
            newNotif.type as any
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userEmail, fetchNotifications]);

  return {
    unreadCount,
    notifications,
    isOpen,
    togglePanel,
    closePanel,
    markAllRead,
    refetch: fetchNotifications,
  };
}
