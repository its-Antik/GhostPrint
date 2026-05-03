"use client";

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

function FeedItem({ item }: { item: { type: string; text: string } }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e1f23] border border-white/5 shadow-lg shrink-0">
      {item.type === "user" ? (
        <User size={14} className="text-gray-400" />
      ) : (
        <CheckCircle2 size={14} className="text-emerald-400" />
      )}
      <span className="text-sm font-medium text-gray-300 whitespace-nowrap">
        {item.text}
      </span>
    </div>
  );
}

export default function LiveCampusFeed() {
  // Duplicate enough for seamless loop
  const items = [...feedItems, ...feedItems];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 py-4 overflow-hidden bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
      <div className="marquee-container">
        <div className="marquee-track">
          {items.map((item, i) => (
            <FeedItem key={`a-${i}`} item={item} />
          ))}
          {items.map((item, i) => (
            <FeedItem key={`b-${i}`} item={item} />
          ))}
        </div>
      </div>
      <style jsx>{`
        .marquee-container {
          overflow: hidden;
          width: 100%;
        }
        .marquee-track {
          display: flex;
          gap: 1rem;
          padding: 0 1rem;
          width: max-content;
          animation: marquee 40s linear infinite;
          will-change: transform;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
