"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, GraduationCap, Phone } from "lucide-react";
// import { supabase } from "@/lib/supabase"; // Uncomment when supabase client is ready

const DEPARTMENTS = ["CSE", "ECE", "EE", "ME", "CE", "IT"];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // TODO: Supabase logic
    // await supabase.from('profiles').upsert({ department, phone })
    
    setTimeout(() => {
      setIsSubmitting(false);
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for fade out
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 shadow-[0_0_50px_rgba(79,70,229,0.15)] backdrop-blur-2xl text-center"
          >
            {step === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                  <GraduationCap size={32} className="text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Select Your Department</h2>
                <p className="text-gray-400 text-sm mb-6">Help us customize your Pagen experience.</p>
                
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {DEPARTMENTS.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => setDepartment(dept)}
                      className={`py-3 rounded-xl font-bold transition-all border ${
                        department === dept 
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.4)]" 
                          : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
                
                <button 
                  disabled={!department}
                  onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white text-black font-bold disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Continue <ChevronRight size={18} />
                </button>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <Phone size={32} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">WhatsApp Number</h2>
                <p className="text-gray-400 text-sm mb-6">For instant updates when your prints are ready.</p>
                
                <input 
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-center text-xl tracking-widest text-white focus:border-emerald-500 outline-none transition-all mb-6"
                />

                <button 
                  disabled={!phone || isSubmitting}
                  onClick={handleSubmit}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {isSubmitting ? "Verifying..." : "Complete Setup"}
                  {!isSubmitting && <CheckCircle2 size={18} />}
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
