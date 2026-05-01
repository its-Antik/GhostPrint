"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"];

/**
 * Smart Realtime connection manager.
 * 
 * Solves the "8:50 AM Connection Drain" problem:
 * - Disconnects WebSocket after 10 minutes of user inactivity
 * - Disconnects when browser tab goes to background (Page Visibility API)
 * - Reconnects instantly when the user returns
 * - Prevents idle phones in pockets from holding connections
 * 
 * Supabase Free Tier: 500 concurrent Realtime connections.
 * Without this: 350 idle students + 200 active = 550 → blocked.
 * With this: idle students auto-disconnect → ~200 active connections.
 */
export function useSmartRealtime(
  channelName: string,
  config: {
    table: string;
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    filter?: string;
    onPayload: (payload: any) => void;
    enabled?: boolean;
  }
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef(false);

  const connect = useCallback(() => {
    if (isConnectedRef.current || !config.enabled) return;

    const channelConfig: any = {
      event: config.event || "*",
      schema: "public",
      table: config.table,
    };
    if (config.filter) {
      channelConfig.filter = config.filter;
    }

    channelRef.current = supabase
      .channel(channelName)
      .on("postgres_changes", channelConfig, config.onPayload)
      .subscribe();

    isConnectedRef.current = true;
  }, [channelName, config.enabled]);

  const disconnect = useCallback(() => {
    if (!isConnectedRef.current || !channelRef.current) return;

    channelRef.current.unsubscribe();
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    isConnectedRef.current = false;
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    // Reconnect if we were disconnected due to idle
    if (!isConnectedRef.current && config.enabled) {
      connect();
    }

    idleTimerRef.current = setTimeout(() => {
      // User has been idle for 10 minutes — drop the connection
      disconnect();
    }, IDLE_TIMEOUT_MS);
  }, [connect, disconnect, config.enabled]);

  useEffect(() => {
    if (!config.enabled) {
      disconnect();
      return;
    }

    // Initial connect
    connect();
    resetIdleTimer();

    // Track user activity
    const handleActivity = () => resetIdleTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Page Visibility API — disconnect when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        // Tab went to background (phone in pocket, switched tabs)
        // Give a 30-second grace period before disconnecting
        idleTimerRef.current = setTimeout(() => {
          disconnect();
        }, 30_000);
      } else {
        // Tab is visible again — reconnect immediately
        connect();
        resetIdleTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      // Full cleanup on unmount
      disconnect();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [config.enabled, connect, disconnect, resetIdleTimer]);

  return { isConnected: isConnectedRef, reconnect: connect, disconnect };
}
