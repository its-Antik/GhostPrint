"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { CheckCircle2, ArrowLeft, Bug, Lightbulb, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ContactPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const categories = [
    { id: "Bug", label: "Report a Bug", icon: Bug },
    { id: "Idea", label: "Suggest an Idea", icon: Lightbulb },
    { id: "Payment Issue", label: "Payment/Help", icon: HelpCircle },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !message.trim()) return;

    // If they aren't signed in, redirect them to sign in first
    if (!session) {
      router.push("/auth/signin?callbackUrl=/contact");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category, message }),
      });

      if (res.ok) {
        setIsSubmitted(true);
      } else {
        console.error("Failed to submit feedback");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center p-4 font-sans overflow-hidden">
      {/* Background click to go home */}
      <div className="absolute inset-0 z-0 cursor-pointer" onClick={() => router.push("/")} />

      {/* Back Button */}
      <button 
        onClick={() => router.push("/")}
        className="absolute top-8 left-6 sm:left-10 z-20 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
      >
        <div className="p-2 rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
          <ArrowLeft size={18} />
        </div>
        <span className="font-medium text-sm">Back</span>
      </button>

      {/* Deep Indigo Glow Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none" />

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-xl">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="p-8 sm:p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(79,70,229,0.15)]"
            >
              <div className="text-center mb-10">
                <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">We would love to hear from you.</h1>
                <p className="text-gray-400 text-sm">Found a bug? Have an idea? Need help with a payment? Drop it below.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Category Selector */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-300 ml-1">What is this regarding?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all duration-300 ${
                            isSelected 
                              ? "bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-[0_0_15px_rgba(79,70,229,0.3)]" 
                              : "bg-black/40 border-white/5 text-gray-400 hover:bg-white/5 hover:text-gray-300"
                          }`}
                        >
                          <Icon size={16} className={isSelected ? "text-indigo-400" : ""} />
                          <span className="text-sm font-medium">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message Input */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-300 ml-1">Your Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    rows={5}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !category || !message.trim()}
                  className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    "Send to Headquarters"
                  )}
                </button>

                <p className="text-center text-gray-500 text-xs mt-4">
                  or email us directly at{" "}
                  <a href="mailto:unsupervised.labs@proton.me" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                    unsupervised.labs@proton.me
                  </a>
                </p>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
              className="p-12 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle2 size={40} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Message received.</h2>
              <p className="text-gray-400 mb-8">Our team is on it.</p>
              
              <button
                onClick={() => router.push("/")}
                className="px-6 py-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors font-medium text-sm"
              >
                Return to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
