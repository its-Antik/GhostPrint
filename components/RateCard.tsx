"use client";

import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useSession } from "next-auth/react";
import { calculateSplit } from "@/lib/pricing";

function AnimatedNumber({ value }: { value: string | number }) {
  const motionValue = useMotionValue(0);
  const displayValue = useTransform(motionValue, (latest) => latest.toFixed(2));

  useEffect(() => {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    const controls = animate(motionValue, numericValue, {
      duration: 0.5,
      ease: "easeOut",
    });
    return controls.stop;
  }, [value, motionValue]);

  return <motion.span>{displayValue}</motion.span>;
}

export default function RateCard() {
  const { data: session } = useSession();
  const [bwRate, setBwRate] = useState<number>(2);
  const [colorRate, setColorRate] = useState<number>(5);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch saved rates via API on mount
  useEffect(() => {
    async function loadRates() {
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/profile");
          const json = await res.json();
          if (json.profile) {
            if (json.profile.bw_rate) setBwRate(json.profile.bw_rate);
            if (json.profile.color_rate) setColorRate(json.profile.color_rate);
          }
        } catch (err) {
          console.error("Failed to load rates:", err);
        }
      }
    }
    loadRates();
  }, [session]);

  const handleApply = async () => {
    if (!session?.user?.email) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bw_rate: bwRate, color_rate: colorRate }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to save");
      alert("Rates successfully updated!");
    } catch (err: any) {
      alert("Failed to save rates: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const bwSplit = calculateSplit(bwRate, 'bw');
  const colorSplit = calculateSplit(colorRate, 'color');

  return (
    <div className="space-y-4 p-6 bg-[#292a2d] border border-[#3c4043] rounded-lg w-full max-w-xl shadow-sm">
      <h3 className="text-sm font-medium text-[#e8eaed] mb-4">Rate Settings</h3>
      
      {/* B&W Rate */}
      <div className="pb-4 border-b border-[#3c4043]">
        <label className="text-xs font-medium uppercase tracking-wider text-[#9aa0a6] mb-2 block">Black & White Rate (₹/page)</label>
        <input 
          type="number" 
          min="2"
          value={bwRate}
          onChange={(e) => setBwRate(Math.max(2, Number(e.target.value)))}
          className="w-full bg-[#202124] border border-[#5f6368] rounded px-4 py-3 text-white focus:border-[#8ab4f8] outline-none transition-colors mb-2"
        />
        <div className="flex justify-between items-center text-sm mt-2">
          <p className="text-[#8ab4f8] drop-shadow-[0_0_8px_rgba(138,180,248,0.5)] font-medium">
            Your Profit: ₹<AnimatedNumber value={bwSplit.profit} /> / page
          </p>
          {bwSplit.fee === 0 ? (
            <p className="text-[#81c995] font-medium text-xs tracking-wide">Community Rate: 0% Fee</p>
          ) : (
            <p className="text-[#9aa0a6] text-xs">Platform Fee: ₹<AnimatedNumber value={bwSplit.fee} /></p>
          )}
        </div>
      </div>

      {/* Color Rate */}
      <div className="pt-2 pb-4 border-b border-[#3c4043]">
        <label className="text-xs font-medium uppercase tracking-wider text-[#9aa0a6] mb-2 block">Color Rate (₹/page)</label>
        <input 
          type="number" 
          min="5"
          value={colorRate}
          onChange={(e) => setColorRate(Math.max(5, Number(e.target.value)))}
          className="w-full bg-[#202124] border border-[#5f6368] rounded px-4 py-3 text-white focus:border-[#8ab4f8] outline-none transition-colors mb-2"
        />
        <div className="flex justify-between items-center text-sm mt-2">
          <p className="text-[#8ab4f8] drop-shadow-[0_0_8px_rgba(138,180,248,0.5)] font-medium">
            Your Profit: ₹<AnimatedNumber value={colorSplit.profit} /> / page
          </p>
          {colorSplit.fee === 0 ? (
            <p className="text-[#81c995] font-medium text-xs tracking-wide">Community Rate: 0% Fee</p>
          ) : (
            <p className="text-[#9aa0a6] text-xs">Platform Fee: ₹<AnimatedNumber value={colorSplit.fee} /></p>
          )}
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button 
          onClick={handleApply}
          disabled={isSaving}
          className="bg-[#8ab4f8] text-[#202124] font-medium px-6 py-2 rounded hover:bg-[#aecbfa] transition-colors disabled:opacity-50"
        >
          {isSaving ? "Applying..." : "Apply Rates"}
        </button>
      </div>
    </div>
  );
}
