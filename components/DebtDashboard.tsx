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

export default function DebtDashboard({ balance = -45, onGoToProfile }: { balance?: number, onGoToProfile?: () => void }) {

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
            <span className="text-sm font-medium text-[#9aa0a6] uppercase tracking-widest">Pagen Wallet Status</span>
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
                  onClick={onGoToProfile}
                  className="px-6 py-3 rounded-2xl bg-[#3c4043] text-white font-bold text-sm hover:bg-[#5f6368] transition-all border border-[#fde293]/30"
                >
                  Go to Profile to clear dues
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

    </div>
  );
}
