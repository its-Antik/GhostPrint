"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, ChevronDown } from "lucide-react";

interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  is_quick_card: boolean;
  created_at: string;
}

const RUNNER_QUICK_CARDS = [
  "📍 I'm at the gate",
  "⏳ Give me 2 mins",
  "🏃 On my way now",
  "🖨️ Printing your docs",
  "📞 Can you come outside?",
  "👕 Wearing a black hoodie",
];

const BUYER_QUICK_CARDS = [
  "📍 I'm at the main gate",
  "🏢 I'm on the 2nd floor",
  "⏳ Coming down in 2 mins",
  "🅿️ Meet me at the parking",
  "👋 I can see you",
  "🔔 Buzz me when you arrive",
];

export default function GhostChat({
  orderId,
  currentUserEmail,
  isRunner,
  orderStatus,
}: {
  orderId: string;
  currentUserEmail: string;
  isRunner: boolean;
  orderStatus: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isClosed = orderStatus === "delivered" || orderStatus === "cancelled";
  const quickCards = isRunner ? RUNNER_QUICK_CARDS : BUYER_QUICK_CARDS;

  // Fetch initial messages
  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat?order_id=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const newMsgs = data.messages || [];
          // Only update if there are actually new messages (avoid unnecessary re-renders)
          if (newMsgs.length !== prev.length || (newMsgs.length > 0 && newMsgs[newMsgs.length - 1]?.id !== prev[prev.length - 1]?.id)) {
            // Check for new messages from the other person
            if (newMsgs.length > prev.length && !isOpen) {
              const newOnes = newMsgs.slice(prev.length);
              const fromOther = newOnes.filter((m: ChatMessage) => m.sender_id !== currentUserEmail);
              if (fromOther.length > 0) {
                setUnread((u) => u + fromOther.length);
              }
            }
            return newMsgs;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Chat fetch error:", err);
    }
  };

  useEffect(() => {
    if (!orderId || isClosed) return;
    
    // Initial fetch
    fetchMessages();
    
    // Poll every 3 seconds (reliable fallback — Supabase Realtime won't work
    // without Supabase Auth, since we use NextAuth with email-based IDs)
    const pollInterval = setInterval(fetchMessages, 3000);
    
    return () => clearInterval(pollInterval);
  }, [orderId, isClosed]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear unread when opening
  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  // Send message
  const sendMessage = async (text: string, isQuickCard = false) => {
    if (!text.trim() || sending || isClosed) return;

    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          text: text.trim(),
          is_quick_card: isQuickCard,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setInput("");
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#8ab4f8] hover:bg-[#aecbfa] rounded-full flex items-center justify-center shadow-xl shadow-[#8ab4f8]/30 transition-colors"
          >
            <MessageCircle size={24} className="text-[#202124]" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ea4335] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 400, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] bg-[#292a2d]/95 backdrop-blur-xl border border-[#3c4043] rounded-2xl flex flex-col shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c4043] bg-[#202124]/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#81c995] animate-pulse" />
                <h3 className="text-white font-medium text-sm">
                  Ghost Chat
                </h3>
                <span className="text-[#9aa0a6] text-xs">
                  • {isRunner ? "Buyer" : "Runner"}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#9aa0a6] hover:text-white transition-colors p-1"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Ephemeral Notice */}
            <div className="px-4 py-2 bg-[#202124]/60 border-b border-[#3c4043]/50">
              <p className="text-[#9aa0a6] text-[10px] text-center tracking-wide">
                👻 Messages auto-delete when order completes
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <MessageCircle
                    size={32}
                    className="text-[#3c4043] mb-2"
                  />
                  <p className="text-[#5f6368] text-sm">No messages yet</p>
                  <p className="text-[#5f6368] text-xs mt-1">
                    Use quick cards below to start
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === currentUserEmail;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                          isMine
                            ? "bg-[#8ab4f8] text-[#202124] rounded-br-md"
                            : "bg-[#3c4043] text-[#e8eaed] rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm leading-relaxed break-words">
                          {msg.text}
                        </p>
                        <p
                          className={`text-[10px] mt-0.5 ${
                            isMine
                              ? "text-[#202124]/60"
                              : "text-[#9aa0a6]"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Cards */}
            {!isClosed && (
              <div className="px-3 py-2 border-t border-[#3c4043]/50 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {quickCards.map((card) => (
                    <button
                      key={card}
                      onClick={() => sendMessage(card, true)}
                      disabled={sending}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-[#3c4043] hover:bg-[#4e5256] text-[#e8eaed] transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {card}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-3 border-t border-[#3c4043] bg-[#202124]/60">
              {isClosed ? (
                <p className="text-[#5f6368] text-xs text-center py-1">
                  💨 Chat closed — order completed
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="flex-1 bg-[#3c4043] text-[#e8eaed] text-sm rounded-full px-4 py-2.5 outline-none placeholder:text-[#5f6368] focus:ring-1 focus:ring-[#8ab4f8]/50 transition-all"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || sending}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-[#8ab4f8] hover:bg-[#aecbfa] disabled:bg-[#3c4043] disabled:text-[#5f6368] text-[#202124] transition-colors shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
