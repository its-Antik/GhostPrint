"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Shield, Printer } from "lucide-react";
import { useState, useEffect } from "react";

// Floating Particles Component
const FloatingParticles = () => {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    // Generate random particles on client side to avoid hydration mismatch
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-indigo-500/30 blur-[1px]"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: ["0%", "-100%"],
            x: ["0%", `${(Math.random() - 0.5) * 50}%`],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: "linear",
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
};

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    // Setting callbackUrl to "/dashboard"
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center p-4 font-sans overflow-hidden">
      {/* Deep Indigo Glow Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none" />

      {/* Animated Tech Particles */}
      <FloatingParticles />

      {/* Glassmorphism Center Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md p-8 sm:p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(79,70,229,0.15)] flex flex-col items-center text-center"
      >
        <div className="w-20 h-20 rounded-2xl border border-indigo-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(79,70,229,0.3)] overflow-hidden">
          <img src="/Logo.jpg" alt="GhostPrint" className="w-2000 h-2000 object-cover" />
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">GhostPrint</h1>
        <p className="text-gray-400 mb-10 text-sm">Welcome back. Secure login for students.</p>

        {/* Large Styled Sign In Button */}
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="flex items-center justify-center gap-4 w-full px-8 py-4 bg-white text-black rounded-2xl font-bold hover:scale-[1.02] transition-all active:scale-95 shadow-[0_10px_40px_rgba(255,255,255,0.1)] disabled:opacity-70 disabled:hover:scale-100 disabled:active:scale-100"
        >
          {isLoading ? (
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              <span>Authenticating...</span>
            </div>
          ) : (
            <>
              <img src="/google-g.svg" className="w-6 h-6" alt="Google" />
              Continue with College Email
            </>
          )}
        </button>

        {/* Text Disclaimer */}
        <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/5">
          <Shield size={14} className="text-indigo-400" />
          <span className="text-xs text-gray-300 font-medium tracking-wide uppercase">Official College ID Required</span>
        </div>
      </motion.div>
    </div>
  );
}
