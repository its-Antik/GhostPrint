"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Globe, X, Send, Share2, Check, Trophy, ChevronUp, Zap, MapPin, Crown, AlertTriangle } from "lucide-react";

interface LeaderboardEntry {
  email_domain?: string;
  college_name: string;
  request_count: number;
  target_count: number;
}

const MEDAL_COLORS = [
  { bg: "from-yellow-500/20 to-amber-600/10", border: "border-yellow-500/30", text: "text-yellow-400", icon: "🥇" },
  { bg: "from-gray-300/15 to-gray-400/10", border: "border-gray-400/30", text: "text-gray-300", icon: "🥈" },
  { bg: "from-orange-600/15 to-orange-700/10", border: "border-orange-600/30", text: "text-orange-400", icon: "🥉" },
];

const PERSONAL_DOMAINS = new Set([
  "gmail.com","yahoo.com","outlook.com","hotmail.com","live.com",
  "icloud.com","protonmail.com","aol.com","zoho.com","yandex.com",
  "mail.com","gmx.com","rediffmail.com",
]);

export default function CampusExpansion() {
  const [showModal, setShowModal] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [collegeName, setCollegeName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [campusSize, setCampusSize] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error" | "duplicate">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resultCount, setResultCount] = useState(0);
  const [isPersonalEmail, setIsPersonalEmail] = useState(false);
  const [resultCollegeName, setResultCollegeName] = useState("");

  // Domain autocomplete
  const [suggestedName, setSuggestedName] = useState("");
  const [isCollegeLocked, setIsCollegeLocked] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clipboard tracking
  const [copiedCollege, setCopiedCollege] = useState<string | null>(null);

  // Ref from URL
  const refParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("ref")
    : null;

  // Animation refs
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  useEffect(() => { fetchLeaderboard(); }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/expansion");
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // Domain lookup — fires when email changes
  const lookupDomain = async (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || domain.length < 3 || !domain.includes(".")) {
      setSuggestedName("");
      setIsCollegeLocked(false);
      return;
    }
    if (PERSONAL_DOMAINS.has(domain)) {
      setSuggestedName("");
      setIsCollegeLocked(false);
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch(`/api/expansion?lookup=${encodeURIComponent(domain)}`);
      const data = await res.json();
      if (data.found && data.canonical_name) {
        setSuggestedName(data.canonical_name);
        setCollegeName(data.canonical_name);
        setIsCollegeLocked(true);
      } else {
        setSuggestedName("");
        setIsCollegeLocked(false);
      }
    } catch {
      setSuggestedName("");
      setIsCollegeLocked(false);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setStudentEmail(value);
    const domain = value.split("@")[1]?.toLowerCase() || "";
    const personal = PERSONAL_DOMAINS.has(domain);
    setIsPersonalEmail(personal);

    if (personal) {
      // Don't bother looking up — it's a personal email
      setSuggestedName("");
      setIsCollegeLocked(false);
      return;
    }

    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => lookupDomain(value), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName.trim() || !studentEmail.trim()) return;

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const res = await fetch("/api/expansion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          college_name: collegeName.trim(),
          student_email: studentEmail.trim(),
          campus_size: campusSize || null,
          ref: refParam || null,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setSubmitStatus("duplicate");
        setErrorMessage(data.error || "You've already submitted a request!");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setResultCount(data.college_count || 0);
        setResultCollegeName(data.college_name || collegeName);
        setSubmitStatus("success");
        fetchLeaderboard();
      } else {
        const data = await res.json();
        setSubmitStatus("error");
        setErrorMessage(data.error || "Something went wrong.");
      }
    } catch {
      setSubmitStatus("error");
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = (college: string) => {
    const slug = college.toLowerCase().replace(/\s+/g, "-");
    const url = `${window.location.origin}?ref=${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedCollege(college);
    setTimeout(() => setCopiedCollege(null), 2500);
  };

  const getPercentage = (count: number, target: number) =>
    Math.min((count / target) * 100, 100);

  const displayKey = (entry: LeaderboardEntry) => entry.email_domain || entry.college_name;

  return (
    <>
      {/* === CAMPUS EXPANSION SECTION === */}
      <section ref={sectionRef} id="expansion" className="relative z-10 py-24 px-6 max-w-5xl mx-auto">
        {/* Section Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300 mb-6">
            <Globe size={14} /><span>Multi-Campus Expansion</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Not at your campus{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">yet?</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            We're expanding to new colleges. Request GhostPrint for your campus — once 25 students sign up, we unlock the grid.
          </p>
        </motion.div>

        {/* CTA Button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.2 }} className="text-center mb-16">
          <button
            onClick={() => { setShowModal(true); setSubmitStatus("idle"); setErrorMessage(""); setSuggestedName(""); setIsCollegeLocked(false); }}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-lg transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)] active:scale-[0.97]"
          >
            <MapPin size={20} /> Bring GhostPrint to My Campus
          </button>
        </motion.div>

        {/* === LEADERBOARD === */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.3 }}>
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Trophy size={16} className="text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Campus Expansion Race</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Tracker
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#1a1b1e]/80 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-[#1e2023] border-b border-white/[0.06] text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-5">Campus</div>
              <div className="col-span-3 text-center">Progress</div>
              <div className="col-span-3 text-right">Action</div>
            </div>

            {loading ? (
              <div className="px-6 py-16 text-center">
                <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading leaderboard...</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Globe size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium mb-1">No campuses yet</p>
                <p className="text-gray-600 text-sm">Be the first to request GhostPrint for your college!</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {leaderboard.map((entry, index) => {
                  const pct = getPercentage(entry.request_count, entry.target_count);
                  const isTop3 = index < 3;
                  const medal = MEDAL_COLORS[index];
                  const isComplete = pct >= 100;
                  const key = displayKey(entry);

                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                      className={`grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-white/[0.02] transition-colors ${isComplete ? "bg-emerald-500/[0.03]" : ""}`}
                    >
                      <div className="col-span-1 text-center">
                        {isTop3 ? <span className="text-lg">{medal.icon}</span> : <span className="text-sm font-medium text-gray-500">{index + 1}th</span>}
                      </div>
                      <div className="col-span-5 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isTop3 ? `bg-gradient-to-br ${medal.bg} ${medal.border} border ${medal.text}` : "bg-white/5 border border-white/10 text-gray-400"}`}>
                          {entry.college_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${isTop3 ? "text-white" : "text-gray-300"}`}>{entry.college_name}</p>
                          <p className="text-[11px] text-gray-600">{entry.request_count}/{entry.target_count} students</p>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <div className="w-full h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={isInView ? { width: `${pct}%` } : { width: 0 }}
                              transition={{ duration: 1.2, delay: 0.6 + index * 0.15, ease: "easeOut" }}
                              className={`h-full rounded-full ${isComplete ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.3)]"}`}
                            />
                          </div>
                          <div className="flex justify-between mt-1.5">
                            <span className={`text-[10px] font-bold ${isComplete ? "text-emerald-400" : "text-indigo-400"}`}>{Math.round(pct)}%</span>
                            {isComplete && <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5"><Zap size={8} /> READY</span>}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3 flex justify-end">
                        <button
                          onClick={() => handleShare(entry.college_name)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copiedCollege === entry.college_name ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-gray-400 border border-white/10 hover:bg-indigo-500/10 hover:text-indigo-300 hover:border-indigo-500/30"}`}
                        >
                          {copiedCollege === entry.college_name ? <><Check size={12} /> Copied!</> : <><Share2 size={12} /> Share</>}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {leaderboard.length > 0 && (
              <div className="px-6 py-3 bg-[#1e2023] border-t border-white/[0.06] flex items-center justify-between">
                <p className="text-[11px] text-gray-600">Goal: 50 students per campus to unlock</p>
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-400 font-medium">
                  <ChevronUp size={12} /> Share to fast-track your campus
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Reward Teaser */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.6 }} className="mt-8 p-5 rounded-xl bg-gradient-to-r from-indigo-500/[0.06] to-cyan-500/[0.06] border border-indigo-500/10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Crown size={18} className="text-amber-400" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Founding Runner Reward</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Students who help launch GhostPrint at new campuses earn{" "}
              <span className="text-amber-400 font-semibold">"Founding Runner" status</span> — 0% platform fees for life and early access to the Admin Dashboard.
            </p>
          </div>
        </motion.div>
      </section>

      {/* === EXPANSION REQUEST MODAL === */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="absolute inset-0 bg-black/80" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#1a1b1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all z-10">
                <X size={16} />
              </button>

              <AnimatePresence mode="wait">
                {submitStatus === "success" ? (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-8 sm:p-10 text-center">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      <Check size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">You're on the waitlist!</h3>
                    <p className="text-gray-400 text-sm mb-2">
                      {resultCollegeName} now has <span className="text-indigo-400 font-bold">{resultCount}</span> / 25 requests.
                    </p>
                    <p className="text-gray-500 text-xs mb-6">Share this link with your classmates to fast-track activation.</p>
                    <button
                      onClick={() => handleShare(resultCollegeName)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-all active:scale-[0.97]"
                    >
                      <Share2 size={16} />
                      {copiedCollege === resultCollegeName ? "Link Copied!" : "Copy Share Link"}
                    </button>
                    <p className="text-gray-600 text-[10px] mt-4">Send it to your department WhatsApp groups 📲</p>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="p-8 sm:p-10">
                    <div className="relative z-10 mb-8">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                          <Globe size={16} className="text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Request Expansion</h3>
                      </div>
                      <p className="text-gray-400 text-sm">GhostPrint isn't at your campus yet? Let's change that.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
                      {/* Student Email — FIRST (so we can auto-fill college) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 ml-1">Student Email</label>
                        <input
                          type="email"
                          value={studentEmail}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="you@college.ac.in"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                          required
                        />
                        {lookupLoading && (
                          <p className="text-indigo-400 text-[10px] mt-1.5 ml-1 flex items-center gap-1">
                            <span className="w-3 h-3 border border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin inline-block" />
                            Looking up your campus...
                          </p>
                        )}
                        {isPersonalEmail && (
                          <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>Personal emails are not accepted. Please use your <strong>college or workplace email</strong> (e.g. you@college.ac.in) so we can verify your campus.</span>
                          </div>
                        )}
                      </div>

                      {/* College Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 ml-1">College Name</label>
                        {isCollegeLocked ? (
                          <div className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium">{collegeName}</span>
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full font-medium">Auto-detected</span>
                            </div>
                            <p className="text-indigo-400/60 text-[10px] mt-1">Based on your email domain — your vote counts toward this campus.</p>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={collegeName}
                            onChange={(e) => setCollegeName(e.target.value)}
                            placeholder="e.g. IEM Kolkata"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                            required
                          />
                        )}
                      </div>

                      {/* Campus Size */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 ml-1">Estimated Campus Size</label>
                        <select
                          value={campusSize}
                          onChange={(e) => setCampusSize(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-[#1a1b1e]">Select...</option>
                          <option value="<500" className="bg-[#1a1b1e]">Under 500 students</option>
                          <option value="1000" className="bg-[#1a1b1e]">~1,000 students</option>
                          <option value="5000+" className="bg-[#1a1b1e]">5,000+ students</option>
                        </select>
                      </div>

                      {/* Error Messages */}
                      {submitStatus === "duplicate" && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span>{errorMessage}</span>
                        </div>
                      )}
                      {submitStatus === "error" && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span>{errorMessage || "Something went wrong. Please try again."}</span>
                        </div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={isSubmitting || !collegeName.trim() || !studentEmail.trim() || isPersonalEmail}
                        className="w-full py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                          <><Send size={16} /> Request Expansion</>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
