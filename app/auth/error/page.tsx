"use client";

import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuthError() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md p-8 rounded-3xl border border-red-500/20 bg-white/5 backdrop-blur-2xl text-center shadow-[0_0_50px_rgba(239,68,68,0.1)]"
      >
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner">
          <ShieldAlert className="text-red-500" size={40} />
        </div>

        <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">Access Restricted</h1>
        
        <p className="text-gray-400 leading-relaxed mb-8">
          To maintain the security of the <span className="text-white font-medium">GhostPrint</span> campus network, we only permit access via authorized <span className="text-indigo-400 underline decoration-indigo-400/30 underline-offset-4">college email addresses.</span> 
        </p>

        <div className="space-y-4">
          <Link 
            href="/auth/signin"
            className="flex items-center justify-center gap-2 w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98]"
          >
            Try again with College ID
          </Link>
          
          <Link 
            href="/"
            className="flex items-center justify-center gap-2 w-full py-4 bg-transparent text-gray-500 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} /> Back to Landing
          </Link>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5">
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em]">
            Security Protocol: HITK-AUTH-BLOCK
          </p>
        </div>
      </motion.div>
    </div>
  );
}
