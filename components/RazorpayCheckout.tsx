"use client";

import { motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";

export default function RazorpayCheckout() {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center mt-12 mb-12 relative z-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative w-full h-14 overflow-hidden rounded-2xl bg-indigo-600/20 border border-indigo-500/30 backdrop-blur-xl shadow-[0_0_30px_rgba(79,70,229,0.2)] flex items-center justify-center pointer-events-none select-none"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-indigo-500/20 to-indigo-600/10" />
        
        <div className="flex items-center gap-2 text-white font-semibold text-lg relative z-10">
          <Lock size={18} className="text-indigo-400" />
          Secure Payment
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md pointer-events-none select-none"
      >
        <ShieldCheck size={14} className="text-gray-400" />
        Encrypted by Razorpay • Funds held in Escrow
      </motion.div>
    </div>
  );
}
