"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Loader2, ShieldCheck } from "lucide-react";

interface CheckoutProps {
  studentName?: string;
  studentEmail?: string;
  amount?: number;
}

export default function RazorpayCheckout({ 
  studentName = "Rishi Kumar", 
  studentEmail = "rishi.k@college.edu",
  amount = 120
}: CheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = () => {
    setIsLoading(true);
    
    // Simulate Razorpay SDK load and payment initialization
    setTimeout(() => {
      setIsLoading(false);
      alert(`Razorpay checkout opened for ₹${amount}\nPrefill: ${studentName} (${studentEmail})`);
      
      // Actual implementation would look like:
      /*
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: amount * 100,
        currency: "INR",
        name: "GhostPrint",
        description: "Campus Printing Service",
        theme: { color: "#4F46E5" },
        prefill: {
          name: studentName,
          email: studentEmail,
        },
        handler: function (response: any) {
          console.log("Payment Successful", response);
        }
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      */
    }, 1500);
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center mt-12 mb-12 relative z-20">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handlePayment}
        disabled={isLoading}
        className="relative w-full h-14 overflow-hidden rounded-2xl bg-indigo-600/20 border border-indigo-500/30 backdrop-blur-xl shadow-[0_0_30px_rgba(79,70,229,0.2)] hover:shadow-[0_0_40px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-indigo-500/20 to-indigo-600/10 group-hover:via-indigo-500/30 transition-all duration-500" />
        
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-indigo-300 font-semibold"
            >
              <Loader2 size={20} className="animate-spin" />
              Initializing...
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-white font-semibold text-lg"
            >
              <Lock size={18} className="text-indigo-400" />
              Secure Payment
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
        <ShieldCheck size={14} className="text-gray-400" />
        Encrypted by Razorpay • Funds held in Escrow
      </div>
    </div>
  );
}
