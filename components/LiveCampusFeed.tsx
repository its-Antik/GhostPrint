"use client";

import { motion } from "framer-motion";
import { User, CheckCircle2 } from "lucide-react";

const feedItems = [
  { type: "user", text: "@Rishi printed 40pgs" },
  { type: "user", text: "@Ankit earned ₹120" },
  { type: "success", text: "12 orders delivered today" },
  { type: "user", text: "@Priya uploaded Lab Manual" },
  { type: "user", text: "@Rahul printed 15pgs" },
  { type: "success", text: "New runner verified in Block B" },
  { type: "user", text: "@Neha earned ₹45" },
];

export default function LiveCampusFeed() {
  // We duplicate the items to create a seamless infinite loop
  const marqueeItems = [...feedItems, ...feedItems, ...feedItems, ...feedItems];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 py-4 overflow-hidden bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
      <div className="relative flex whitespace-nowrap">
        <motion.div
          className="flex gap-4 px-4"
          animate={{ x: [0, -1000] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 30,
              ease: "linear",
            },
          }}
        >
          {marqueeItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/5 backdrop-blur-md shadow-lg"
            >
              {item.type === "user" ? (
                <User size={14} className="text-gray-400" />
              ) : (
                <CheckCircle2 size={14} className="text-emerald-400" />
              )}
              <span className="text-sm font-medium text-gray-300">
                {item.text}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
