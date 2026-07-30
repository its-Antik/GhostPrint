"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Settings, Settings2 } from "lucide-react";
import { motion } from "framer-motion";

interface DevContextType {
  isDevMode: boolean;
  isAdmin: boolean;
}

const DevContext = createContext<DevContextType>({ isDevMode: false, isAdmin: false });

export const useDevMode = () => useContext(DevContext);

export default function DevProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isDevMode, setIsDevMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isAdmin = session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  useEffect(() => {
    setMounted(true);
    // Optionally load dev mode state from localStorage
    const saved = localStorage.getItem("pagen_dev_mode");
    if (saved === "true") setIsDevMode(true);
  }, []);

  const toggleDevMode = () => {
    const nextState = !isDevMode;
    setIsDevMode(nextState);
    localStorage.setItem("pagen_dev_mode", String(nextState));
  };

  return (
    <DevContext.Provider value={{ isDevMode, isAdmin }}>
      {children}
      {mounted && isAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed bottom-24 right-6 z-40 flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/10 px-2 py-1 rounded-full shadow-lg"
        >
          <span className="text-[10px] font-mono text-gray-500 pl-1 select-none">
            {isDevMode ? "DEV" : "DEV"}
          </span>
          <button 
            onClick={toggleDevMode}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              isDevMode 
                ? "bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]" 
                : "bg-white/10 text-gray-500 hover:text-white"
            }`}
          >
            {isDevMode ? <Settings2 size={12} /> : <Settings size={12} />}
          </button>
        </motion.div>
      )}
    </DevContext.Provider>
  );
}
