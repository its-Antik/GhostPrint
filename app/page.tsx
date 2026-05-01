"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing";
import { motion } from "framer-motion";
import { Printer, Zap, Wallet, ArrowRight, ChevronRight, UploadCloud, MapPin } from "lucide-react";
import LiveCampusFeed from "@/components/LiveCampusFeed";
import RazorpayCheckout from "@/components/RazorpayCheckout";
import Link from "next/link";

// --- 3D BACKGROUND COMPONENT ---
// This creates floating 3D "pages" that slowly rotate in the background
function FloatingPages() {
  const groupRef = useRef<any>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 15 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 10 - 5,
          ]}
          rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]}
        >
          <planeGeometry args={[1.5, 2.1]} /> {/* A4 Paper Aspect Ratio */}
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.1}
            opacity={0.2}
            transparent
            roughness={0.1}
            side={2}
          />
        </mesh>
      ))}
    </group>
  );
}

const steps = [
  {
    title: "Upload PDF",
    desc: "Drop your lab manual or notes. Our system auto-calculates pages and pricing.",
    icon: <UploadCloud className="text-indigo-400" size={28} />,
    color: "from-indigo-500/20 to-transparent",
  },
  {
    title: "Runner Prints",
    desc: "A verified student runner near a print hub picks up your order and prints it instantly.",
    icon: <Zap className="text-cyan-400" size={28} />,
    color: "from-cyan-500/20 to-transparent",
  },
  {
    title: "9 AM Delivery",
    desc: "Meet your runner at the college gate or canteen. Paper in hand, stress out the window.",
    icon: <MapPin className="text-emerald-400" size={28} />,
    color: "from-emerald-500/20 to-transparent",
  },
];

function StepsSection() {
  return (
    <section className="relative z-10 py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">How it Works</h2>
        <p className="text-gray-400">Zero queues. Zero stress. Just your prints when you need them.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            className="relative group p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all overflow-hidden"
          >
            {/* Gradient Glow on Hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center mb-6 shadow-xl">
                {step.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                {step.desc}
              </p>
            </div>

            {/* Step Number Badge */}
            <div className="absolute top-6 right-8 text-5xl font-black text-white/5 select-none">
              0{index + 1}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden font-sans">

      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} color="#4F46E5" />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#10B981" />
          <FloatingPages />
          <EffectComposer>
            <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={3} height={480} />
            <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={0.5} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Navigation Bar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-20 h-20 rounded flex items-center justify-center overflow-hidden">
            <img src="/Logo.jpg" alt="GhostPrint" className="w-full h-full object-cover rounded-md" />
          </div>
          <span className="text-xl font-bold tracking-tight">GhostPrint</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
          <button className="hidden md:block text-gray-300 hover:text-white transition-colors">How it Works</button>
          <Link href="/auth/signin" target="_blank" rel="noopener noreferrer" className="hidden md:block text-indigo-400 hover:text-indigo-300 transition-colors">Admin Login</Link>
          <Link href="/auth/signin" target="_blank" rel="noopener noreferrer" className="hidden sm:block text-gray-300 hover:text-white transition-colors">Sign In</Link>
          <button className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-white text-black hover:bg-gray-200 transition-all font-semibold text-xs sm:text-sm">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-4 text-center max-w-4xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-indigo-300 mb-8 backdrop-blur-sm"
        >
          <Zap size={14} />
          <span>The Campus Print Network is Live</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight"
        >
          Your 9 AM lab manual, <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            delivered.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl"
        >
          Skip the Xerox queues. Upload your PDFs tonight, and our student runners will hand-deliver them to the college gate before your first class.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]">
            Order a Print <ArrowRight size={20} />
          </button>

          <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg transition-all backdrop-blur-sm">
            <Wallet size={20} className="text-emerald-400" />
            Become a Runner
          </button>
        </motion.div>

        {/* Mini stats/trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-sm text-gray-500 font-medium"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Runners: 24
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            Secure Escrow Payments
          </div>
        </motion.div>

      </main>

      {/* How It Works Section */}
      <StepsSection />

      {/* Secure Checkout Demo */}
      <RazorpayCheckout />

      {/* Live Campus Feed Ticker */}
      <LiveCampusFeed />
    </div>
  );
}
