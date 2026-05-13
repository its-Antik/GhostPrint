"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface SystemStatus {
  active: boolean;
  message: string;
  estimated_uptime: string;
}

/**
 * MaintenanceOverlay — The "Nuclear Option"
 * 
 * Full-screen terminal-style overlay that blocks ALL interaction when
 * the admin sets is_system_active = false in global_settings.
 * 
 * Polls /api/system every 30 seconds. Auto-dismisses when system comes back online.
 */
export default function MaintenanceOverlay() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [dots, setDots] = useState("");

  // Poll system status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/system");
        const data = await res.json();
        setSystemStatus(data);
      } catch {
        // If API fails, assume system is active (fail-open)
        setSystemStatus({ active: true, message: "", estimated_uptime: "" });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // every 30s
    return () => clearInterval(interval);
  }, []);

  // Terminal cursor animation
  useEffect(() => {
    if (systemStatus?.active !== false) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [systemStatus?.active]);

  // Don't render anything if system is active or not loaded yet
  if (!systemStatus || systemStatus.active !== false) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-6"
    >
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
        }}
      />

      {/* CRT Glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(16,185,129,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-2xl w-full">
        {/* Terminal Window */}
        <div className="rounded-xl border border-emerald-500/20 bg-black/90 overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.1)]">
          {/* Title Bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/5 border-b border-emerald-500/10">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="ml-3 text-emerald-500/50 text-xs font-mono">ghostprint@grid — system_status</span>
          </div>

          {/* Terminal Content */}
          <div className="p-8 font-mono text-sm space-y-4">
            {/* System Header */}
            <div className="text-emerald-500/40 text-xs">
              <p>GhostPrint Grid Controller v2.0</p>
              <p>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
            </div>

            {/* Status Line */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-3"
            >
              <span className="text-red-400 font-bold">⬤</span>
              <span className="text-red-400 font-bold tracking-wider text-lg">SYSTEM OFFLINE</span>
            </motion.div>

            {/* Message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-2 text-gray-400"
            >
              <p>
                <span className="text-emerald-500/60">status:</span>{" "}
                {systemStatus.message}
              </p>
              <p>
                <span className="text-emerald-500/60">estimated_uptime:</span>{" "}
                <span className="text-amber-400">{systemStatus.estimated_uptime}</span>
              </p>
            </motion.div>

            {/* Loading Animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="pt-4 border-t border-emerald-500/10"
            >
              <p className="text-emerald-500/60">
                <span className="text-emerald-400">$</span> awaiting system restart{dots}
              </p>
            </motion.div>

            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-6 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-500/50 text-xs leading-relaxed"
            >
              <p>The GhostPrint Grid is temporarily offline for maintenance.</p>
              <p className="mt-1">This page will automatically refresh when the system comes back online.</p>
              <p className="mt-1 text-emerald-500/30">No orders or data will be lost during this period.</p>
            </motion.div>
          </div>
        </div>

        {/* Ghost Logo watermark */}
        <div className="text-center mt-6">
          <span className="text-emerald-500/10 text-6xl select-none">👻</span>
        </div>
      </div>
    </motion.div>
  );
}
