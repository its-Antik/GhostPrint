"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, User, Building, Phone, Star, AlertTriangle, Mail, ShieldAlert } from "lucide-react";
import { useSession } from "next-auth/react";

export default function RunnerSetup() {
  const { data: session } = useSession();
  const [department, setDepartment] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [strikeCount, setStrikeCount] = useState(0);
  const [accountDisabled, setAccountDisabled] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [payingFine, setPayingFine] = useState(false);

  // Load existing profile data via API
  useEffect(() => {
    async function loadProfile() {
      if (session?.user?.email) {
        try {
          const [profileRes, strikeRes, ratingRes] = await Promise.all([
            fetch("/api/profile"),
            fetch("/api/strikes"),
            fetch(`/api/ratings?user_email=${encodeURIComponent(session.user.email)}`),
          ]);
          const profileJson = await profileRes.json();
          const strikeJson = await strikeRes.json();
          const ratingJson = await ratingRes.json();

          if (profileJson.profile) {
            if (profileJson.profile.department) setDepartment(profileJson.profile.department);
            if (profileJson.profile.whatsapp_no) setWhatsapp(profileJson.profile.whatsapp_no);
          }
          setStrikeCount(strikeJson.strike_count || 0);
          setAccountDisabled(strikeJson.account_disabled || false);
          setAvgRating(ratingJson.avg_rating || 0);
          setTotalRatings(ratingJson.total_ratings || 0);
        } catch (err) {
          console.error("Failed to load profile:", err);
        }
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [session]);

  const handleSave = async () => {
    if (!department.trim() || !whatsapp.trim()) return;
    setIsSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: session?.user?.name || "",
          avatar_url: session?.user?.image || "",
          department: department.trim(),
          whatsapp_no: whatsapp.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        console.error("Profile save error:", json.error);
        alert("Failed to save profile: " + (json.error || "Unknown error"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err: any) {
      console.error("Profile save error:", err);
      alert("Failed to save profile. Please try again.");
    }

    setIsSaving(false);
  };

  const handlePayFine = async () => {
    setPayingFine(true);
    try {
      const res = await fetch("/api/strikes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay_fine" }),
      });
      const json = await res.json();
      if (json.success) {
        setStrikeCount(0);
        setAccountDisabled(false);
        alert("✅ Account reactivated! Your strikes have been reset.");
      } else {
        alert("Failed to process fine payment.");
      }
    } catch (err) {
      alert("Failed to pay fine. Please try again.");
    }
    setPayingFine(false);
  };

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Student';
  const userEmail = session?.user?.email || '';

  return (
    <div className="flex items-center justify-center py-8 w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-lg bg-[#292a2d] border border-[#3c4043] shadow-2xl relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded bg-[#202124] border border-[#5f6368] flex items-center justify-center">
              <User className="text-[#8ab4f8]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Profile</h2>
              <p className="text-sm text-[#9aa0a6]">Your info is saved to your account</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#8ab4f8]/30 border-t-[#8ab4f8] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Name & Email — Auto-populated, read-only */}
              <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider font-medium mb-1">Student Name</p>
                  <p className="text-white font-medium text-sm">{userName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider font-medium mb-1">College Email</p>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-[#8ab4f8]" />
                    <p className="text-[#8ab4f8] text-sm font-medium">{userEmail}</p>
                  </div>
                </div>
                {totalRatings > 0 && (
                  <div>
                    <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider font-medium mb-1">Your Rating</p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={14}
                            className={s <= Math.round(avgRating) ? 'text-[#fde293] fill-[#fde293]' : 'text-[#5f6368]'}
                          />
                        ))}
                      </div>
                      <span className="text-[#fde293] text-sm font-bold">{avgRating.toFixed(1)}</span>
                      <span className="text-[#9aa0a6] text-xs">({totalRatings} reviews)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Strike Counter */}
              <div className={`rounded-lg p-4 border ${
                accountDisabled 
                  ? 'bg-[#ea4335]/10 border-[#ea4335]/50' 
                  : strikeCount > 0 
                    ? 'bg-[#fde293]/10 border-[#fde293]/30'
                    : 'bg-[#81c995]/10 border-[#81c995]/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {accountDisabled ? (
                      <ShieldAlert size={16} className="text-[#ea4335]" />
                    ) : (
                      <AlertTriangle size={16} className={strikeCount > 0 ? 'text-[#fde293]' : 'text-[#81c995]'} />
                    )}
                    <p className="text-xs font-bold uppercase tracking-wider text-[#e8eaed]">Strike Counter</p>
                  </div>
                  <span className={`text-lg font-bold ${
                    accountDisabled ? 'text-[#ea4335]' : strikeCount > 0 ? 'text-[#fde293]' : 'text-[#81c995]'
                  }`}>
                    {strikeCount}/3
                  </span>
                </div>
                {/* Strike dots */}
                <div className="flex items-center gap-2 mb-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-8 h-2 rounded-full transition-colors ${
                        i < strikeCount ? 'bg-[#ea4335]' : 'bg-[#3c4043]'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[#9aa0a6] text-[11px] leading-relaxed">
                  {accountDisabled 
                    ? 'Your account has been disabled due to 3 strikes. Pay the ₹100 fine below to reactivate.'
                    : strikeCount > 0
                      ? `You have ${strikeCount} strike${strikeCount > 1 ? 's' : ''}. Cancelling orders after the free window adds strikes. 3 strikes = account disabled.`
                      : 'No strikes. Keep it up! Cancelling orders after the free window adds strikes.'
                  }
                </p>
                {accountDisabled && (
                  <button
                    onClick={handlePayFine}
                    disabled={payingFine}
                    className="w-full mt-3 bg-[#fde293] text-[#202124] font-bold py-3 rounded-lg hover:bg-[#ffe599] transition-colors text-sm disabled:opacity-50"
                  >
                    {payingFine ? 'Processing...' : '⚡ Pay ₹100 Strike Fine to Reactivate'}
                  </button>
                )}
              </div>

              {/* Department Input */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-[#9aa0a6] mb-2 block">Department *</label>
                <div className="relative">
                  <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368]" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => { setDepartment(e.target.value); setSaved(false); }}
                    placeholder="e.g. Computer Science"
                    className="w-full bg-[#202124] border border-[#5f6368] rounded px-4 py-3 pl-12 pr-4 text-white focus:border-[#8ab4f8] outline-none transition-colors placeholder:text-[#5f6368]"
                    disabled={accountDisabled}
                  />
                </div>
              </div>

              {/* WhatsApp Input */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-[#9aa0a6] mb-2 block">WhatsApp Number *</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368]" />
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => { setWhatsapp(e.target.value); setSaved(false); }}
                    placeholder="e.g. +91 9876543210"
                    className="w-full bg-[#202124] border border-[#5f6368] rounded px-4 py-3 pl-12 pr-4 text-white focus:border-[#8ab4f8] outline-none transition-colors placeholder:text-[#5f6368]"
                    disabled={accountDisabled}
                  />
                </div>
              </div>

              {/* Save Button */}
              <motion.button
                onClick={handleSave}
                disabled={isSaving || saved || !department.trim() || !whatsapp.trim() || accountDisabled}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 mt-6 rounded font-medium flex items-center justify-center gap-2 transition-colors ${
                  saved
                    ? "bg-[#81c995] text-[#202124]"
                    : accountDisabled
                      ? "bg-[#3c4043] text-[#5f6368] cursor-not-allowed"
                      : "bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] disabled:opacity-50 disabled:hover:bg-[#8ab4f8]"
                }`}
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-[#202124]/20 border-t-[#202124] rounded-full animate-spin" />
                ) : saved ? (
                  <>
                    <CheckCircle2 size={20} /> Saved Successfully
                  </>
                ) : (
                  "Save Profile"
                )}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
