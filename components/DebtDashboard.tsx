"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  History, 
  IndianRupee, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  CheckCircle2, 
  QrCode,
  Info,
  Clock
} from "lucide-react";

interface Transaction {
  id: string;
  type: 'deduction' | 'payment';
  amount: number;
  date: string;
  status: 'completed' | 'pending';
  note: string;
}

export default function DebtDashboard({ balance = -45 }: { balance?: number }) {
  const [showRepay, setShowRepay] = useState(false);
  
  // Mock transaction history
  const transactions: Transaction[] = [
    { id: '1', type: 'deduction', amount: 8, date: '2026-04-29T14:30:00Z', status: 'completed', note: 'Platform Fee (EE-302 Lab Manual)' },
    { id: '2', type: 'deduction', amount: 12, date: '2026-04-29T11:15:00Z', status: 'completed', note: 'Platform Fee (CS-101 Notes)' },
    { id: '3', type: 'payment', amount: 50, date: '2026-04-28T18:20:00Z', status: 'completed', note: 'Dues Cleared via UPI' },
    { id: '4', type: 'deduction', amount: 25, date: '2026-04-28T09:45:00Z', status: 'completed', note: 'Platform Fee (Mega Bundle Print)' },
  ];

  const isDues = balance < 0;
  const absBalance = Math.abs(balance);

  return (
    <div className="space-y-6">
      {/* Balance Overview Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-3xl p-8 border backdrop-blur-2xl transition-all duration-500 ${
          isDues 
            ? "bg-[#292a2d] border-[#fde293]/30 shadow-[0_0_40px_rgba(253,226,147,0.05)]" 
            : "bg-[#292a2d] border-[#81c995]/30 shadow-[0_0_40px_rgba(129,201,149,0.05)]"
        }`}
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <IndianRupee size={120} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className={`p-2 rounded-xl border ${isDues ? "bg-[#fde293]/10 border-[#fde293]/20 text-[#fde293]" : "bg-[#81c995]/10 border-[#81c995]/20 text-[#81c995]"}`}>
              <History size={18} />
            </div>
            <span className="text-sm font-medium text-[#9aa0a6] uppercase tracking-widest">Ghost Wallet Status</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className={`text-6xl font-black tracking-tighter ${isDues ? "text-[#fde293]" : "text-white"}`}>
                  ₹{absBalance}
                </span>
                <span className="text-[#9aa0a6] font-medium">{isDues ? "Dues Outstanding" : "Surplus Credit"}</span>
              </div>
              <p className="text-sm text-[#9aa0a6] mt-4 max-w-sm">
                {isDues 
                  ? "You have pending platform fees. You can continue taking jobs until you reach the ₹50 limit."
                  : "Your account is in good standing. Keep running to earn more!"}
              </p>
            </div>

            <div className="flex gap-3">
              {isDues && (
                <button 
                  onClick={() => setShowRepay(true)}
                  className="px-6 py-3 rounded-2xl bg-[#fde293] text-[#202124] font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(253,226,147,0.3)]"
                >
                  Clear Dues Now
                </button>
              )}
              <button className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all">
                Download Report
              </button>
            </div>
          </div>

          {/* Progress Bar for Debt Limit */}
          {isDues && (
            <div className="mt-8 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#9aa0a6]">
                <span>Debt Limit Usage</span>
                <span>₹{absBalance} / ₹50</span>
              </div>
              <div className="h-2 w-full bg-[#202124] rounded-full overflow-hidden border border-[#3c4043]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (absBalance / 50) * 100)}%` }}
                  className={`h-full ${absBalance > 40 ? "bg-red-400" : "bg-[#fde293]"}`}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Transaction History Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock size={20} className="text-[#8ab4f8]" />
          Recent Activity
        </h3>

        <div className="grid gap-3">
          {transactions.map((tx) => (
            <div 
              key={tx.id}
              className="group p-4 bg-[#292a2d] border border-[#3c4043] rounded-2xl hover:border-[#5f6368] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl border ${
                  tx.type === 'deduction' 
                    ? "bg-red-400/10 border-red-400/20 text-red-400" 
                    : "bg-[#81c995]/10 border-[#81c995]/20 text-[#81c995]"
                }`}>
                  {tx.type === 'deduction' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-[#8ab4f8] transition-colors">{tx.note}</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">{new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black ${tx.type === 'deduction' ? "text-white" : "text-[#81c995]"}`}>
                  {tx.type === 'deduction' ? "-" : "+"}₹{tx.amount}
                </p>
                <div className="flex items-center gap-1 justify-end mt-1">
                   <CheckCircle2 size={10} className="text-[#81c995]" />
                   <span className="text-[10px] text-[#9aa0a6] uppercase font-bold tracking-tighter">Settled</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Repay Modal */}
      <AnimatePresence>
        {showRepay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#292a2d] border border-[#3c4043] rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl"
            >
              <button 
                onClick={() => setShowRepay(false)}
                className="absolute top-4 right-4 p-2 text-[#9aa0a6] hover:text-white transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>

              <div className="w-16 h-16 bg-[#fde293]/10 border border-[#fde293]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <QrCode size={32} className="text-[#fde293]" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Clear Dues</h2>
              <p className="text-sm text-[#9aa0a6] mb-8">Scan the GhostPrint Admin QR to clear your outstanding dues of ₹{absBalance}.</p>

              {/* Admin QR Code (Mock) */}
              <div className="bg-white p-4 rounded-2xl mb-8 inline-block shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                <div className="w-48 h-48 bg-[#202124] flex items-center justify-center text-[#9aa0a6] font-mono text-xs rounded-lg">
                   [ADMIN_UPI_QR_CODE]
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowRepay(false)}
                  className="w-full py-4 rounded-2xl bg-[#8ab4f8] text-[#202124] font-bold shadow-[0_0_20px_rgba(138,180,248,0.2)]"
                >
                  I've Paid the Dues
                </button>
                <p className="text-[10px] text-[#9aa0a6] uppercase font-bold tracking-widest flex items-center justify-center gap-2">
                  <AlertCircle size={12} />
                  Verification takes 5-10 minutes
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
