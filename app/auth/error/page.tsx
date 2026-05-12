"use client";

import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft, MapPin, Globe } from "lucide-react";
import Link from "next/link";

export default function AuthError() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[30%] h-[30%] bg-cyan-900/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md p-8 rounded-3xl border border-indigo-500/20 bg-white/5 backdrop-blur-2xl text-center shadow-[0_0_50px_rgba(79,70,229,0.1)]"
      >
        <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Globe className="text-indigo-400" size={40} />
        </div>

        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          GhostPrint isn't at your campus yet.
        </h1>
        
        <p className="text-gray-400 leading-relaxed mb-4 text-sm">
          We currently only operate on authorized campuses. But you can help change that —{" "}
          <span className="text-indigo-400 font-medium">request an expansion</span> and we'll bring GhostPrint to your college once enough students sign up.
        </p>

        {/* Reward Hook */}
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-amber-500/[0.06] to-indigo-500/[0.06] border border-amber-500/10 text-left">
          <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">🏆 Founding Runner Perk</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            Early requesters earn <span className="text-white font-semibold">0% fees for life</span> and admin dashboard access when their campus goes live.
          </p>
        </div>

        <div className="space-y-3">
          <Link 
            href="/#expansion"
            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl font-bold hover:from-indigo-500 hover:to-indigo-400 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            <MapPin size={18} />
            Request Campus Expansion
          </Link>

          <Link 
            href="/auth/signin"
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-medium hover:bg-white/10 transition-all text-sm"
          >
            Try Again with College Email
          </Link>
          
          <Link 
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 bg-transparent text-gray-500 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} /> Back to Landing
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em]">
            Campus Expansion Protocol Active
          </p>
        </div>
      </motion.div>
    </div>
  );
}
