"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Send, AlertTriangle, ShieldCheck, Zap, Users, Gift } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminBroadcast() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [targetEmail, setTargetEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("system");
  const [sendPush, setSendPush] = useState(false);
  const [giveBonus, setGiveBonus] = useState(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/admin");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  // Very basic client-side check. API enforces security.
  if (session?.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL && session?.user?.email !== "antik13sarkar@gmail.com") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-gray-400">You do not have administrative privileges to view this page.</p>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail || !title || !message) {
      setFeedback({ type: "error", text: "Please fill in all required fields." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_email: targetEmail.trim(),
          title: title.trim(),
          message: message.trim(),
          type,
          send_push: sendPush,
          give_bonus: Number(giveBonus)
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send notification");
      }

      setFeedback({ type: "success", text: data.message });
      setTitle("");
      setMessage("");
      setGiveBonus(0);
      // keep targetEmail and type as they might want to send another to same user
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <ShieldCheck size={24} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Broadcast</h1>
            <p className="text-gray-400 text-sm mt-1">Send manual notifications and credits to the grid.</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-[#1a1b1e] border border-white/10 rounded-2xl p-6 md:p-8">
          <form onSubmit={handleSend} className="space-y-6">
            
            {/* Target & Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Target User</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users size={16} className="text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder="student@heritageit.edu.in OR 'all'"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Use <code className="text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">all</code> to broadcast to the entire grid.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Notification Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  <option value="system">System (Red/Alert)</option>
                  <option value="info">Info (Blue/Neutral)</option>
                  <option value="promo">Promo (Green/Bonus)</option>
                  <option value="order">Order (Yellow/Standard)</option>
                </select>
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Issue Resolved! ✅"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            {/* Bonuses & Push */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Give Pagen Credits (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Gift size={16} className="text-emerald-500" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={giveBonus}
                    onChange={(e) => setGiveBonus(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Only works for single user targets, not 'all'.</p>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-3 cursor-pointer group mt-6">
                  <div className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${sendPush ? 'bg-indigo-500 border-indigo-500' : 'bg-black/40 border-white/20 group-hover:border-white/40'}`}>
                    {sendPush && <Zap size={14} className="text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={sendPush}
                    onChange={(e) => setSendPush(e.target.checked)}
                    className="hidden"
                  />
                  <div>
                    <span className="text-sm font-medium text-white block">Force Native Web Push</span>
                    <span className="text-xs text-gray-500">Also triggers OS-level popup if they are subscribed.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl text-sm ${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
              >
                {feedback.text}
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.2)]"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} /> Send Broadcast
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
