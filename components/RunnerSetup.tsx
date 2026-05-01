"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, User, Building, Phone } from "lucide-react";
import { useSession } from "next-auth/react";

export default function RunnerSetup() {
  const { data: session } = useSession();
  const [department, setDepartment] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing profile data via API
  useEffect(() => {
    async function loadProfile() {
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/profile");
          const json = await res.json();
          if (json.profile) {
            if (json.profile.department) setDepartment(json.profile.department);
            if (json.profile.whatsapp_no) setWhatsapp(json.profile.whatsapp_no);
          }
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
              <h2 className="text-2xl font-bold text-white tracking-tight">Profile Setup</h2>
              <p className="text-sm text-[#9aa0a6]">Your info is saved to your account</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#8ab4f8]/30 border-t-[#8ab4f8] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
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
                  />
                </div>
              </div>

              {/* Save Button */}
              <motion.button
                onClick={handleSave}
                disabled={isSaving || saved || !department.trim() || !whatsapp.trim()}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 mt-6 rounded font-medium flex items-center justify-center gap-2 transition-colors ${
                  saved
                    ? "bg-[#81c995] text-[#202124]"
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
