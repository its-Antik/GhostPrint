"use client";

import { motion } from "framer-motion";
import { Wallet, FileText, IndianRupee, ScanLine, Clock, MapPin, CheckCircle2 } from "lucide-react";

export default function RunnerDashboard() {
  const orders = [
    { id: 1, file: "Physics_Lab_Manual.pdf", pages: 45, earnings: 35, location: "Main Library", time: "2 mins ago" },
    { id: 2, file: "CS101_Notes_Final.pdf", pages: 12, earnings: 15, location: "Hostel Block A", time: "5 mins ago" },
    { id: 3, file: "Math_Assignment_3.pdf", pages: 20, earnings: 25, location: "Canteen", time: "10 mins ago" },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-24">
      {/* Header & Balance Card */}
      <div className="p-6 pt-12 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Runner Dashboard</h1>
            <p className="text-gray-400 text-sm flex items-center gap-2 mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Looking for orders...
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-sm font-bold">JD</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Wallet size={18} />
              <span className="font-medium text-sm">Available Balance</span>
            </div>
            <div className="text-4xl font-black text-white flex items-center gap-1">
              <IndianRupee size={32} className="text-emerald-400" />
              1,240
            </div>
            <button className="mt-4 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-medium transition-colors w-full">
              Withdraw to Bank
            </button>
          </div>
        </motion.div>
      </div>

      {/* Active Orders Feed */}
      <div className="px-6 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Live Orders <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">3 Nearby</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-1 pr-2">{order.file}</h3>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                      <span>{order.pages} Pages</span>
                      <span className="flex items-center gap-1"><Clock size={10}/> {order.time}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-emerald-400 flex items-center justify-end">
                    ₹{order.earnings}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                <MapPin size={12} /> Drop-off: {order.location}
              </div>

              <button className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                Claim Order
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-xl border-t border-white/10 px-6 flex justify-around items-center z-50 md:max-w-3xl lg:max-w-5xl md:mx-auto md:border-x md:border-t-0 md:rounded-t-3xl">
        <button className="flex flex-col items-center gap-1 text-emerald-400">
          <Clock size={20} />
          <span className="text-[10px] font-medium">Orders</span>
        </button>
        
        <div className="relative -top-6">
          <button className="w-16 h-16 rounded-full bg-indigo-600 border-4 border-black flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:bg-indigo-500 transition-colors">
            <ScanLine size={24} className="text-white" />
          </button>
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-gray-400 w-full text-center">
            Scanner
          </div>
        </div>

        <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors">
          <CheckCircle2 size={20} />
          <span className="text-[10px] font-medium">Completed</span>
        </button>
      </div>
    </div>
  );
}
