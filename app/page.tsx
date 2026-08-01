"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, Zap, Wallet, ArrowRight, ChevronRight, UploadCloud, MapPin, LogOut, X, Shield, MessageCircle, Users, FileText, Copy, Check, Terminal } from "lucide-react";
import LiveCampusFeed from "@/components/LiveCampusFeed";
import CampusExpansion from "@/components/CampusExpansion";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import RazorpayCheckout from "@/components/RazorpayCheckout";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

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
      {Array.from({ length: 8 }).map((_, i) => (
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

const buyerSteps = [
  {
    title: "Upload PDF",
    desc: "Drop your files. Our system instantly calculates pages and pricing.",
    icon: <UploadCloud className="text-indigo-400" size={28} />,
    color: "from-indigo-500/20 to-transparent",
  },
  {
    title: "Runner Prints",
    desc: "A verified student with a printer accepts your job and gets it ready.",
    icon: <Zap className="text-cyan-400" size={28} />,
    color: "from-cyan-500/20 to-transparent",
  },
  {
    title: "Get Delivered",
    desc: "Meet your runner anywhere on campus. Paper in hand, stress out the window.",
    icon: <MapPin className="text-emerald-400" size={28} />,
    color: "from-emerald-500/20 to-transparent",
  },
];

const runnerSteps = [
  {
    title: "Claim a Job",
    desc: "Open the dashboard and claim print requests from students when you're free.",
    icon: <Zap className="text-amber-400" size={28} />,
    color: "from-amber-500/20 to-transparent",
  },
  {
    title: "Print & Deliver",
    desc: "Get the files printed at any local shop, and chat with the buyer to coordinate.",
    icon: <Printer className="text-orange-400" size={28} />,
    color: "from-orange-500/20 to-transparent",
  },
  {
    title: "Earn Cash",
    desc: "Hand over the prints, collect your payment directly, and keep the profits.",
    icon: <Wallet className="text-yellow-400" size={28} />,
    color: "from-yellow-500/20 to-transparent",
  },
];

function StepsSection() {
  return (
    <section id="how-it-works" className="relative z-10 py-24 px-6 max-w-7xl mx-auto space-y-24">
      {/* Buyer Section */}
      <div>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Need Prints? <span className="text-indigo-400">How it works</span></h2>
          <p className="text-gray-400">Zero queues. Zero stress. Just your prints when you need them.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {buyerSteps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative group p-8 rounded-3xl border border-white/10 bg-[#1a1b1e]/80 hover:bg-white/10 transition-all overflow-hidden will-change-transform"
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
      </div>

      {/* Runner Section */}
      <div>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Near a Print Shop? <span className="text-amber-400">Start earning</span></h2>
          <p className="text-gray-400">Earn cash by picking up and delivering prints to students when you're free.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {runnerSteps.map((step, index) => (
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
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { data: session } = useSession();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [canvasVisible, setCanvasVisible] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Pause 3D rendering when canvas scrolls out of view
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCanvasVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden font-sans">
      <MaintenanceOverlay />

      {/* Glassmorphism Modal */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setActiveModal(null)}
          >
            <div className="absolute inset-0 bg-black/80" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1a1b1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all z-10"
              >
                <X size={16} />
              </button>

              {activeModal === "about" && (
                <div className="p-8 md:p-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Users size={20} className="text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold">About Pagen</h2>
                  </div>
                  <p className="text-gray-300 leading-relaxed mb-6">
                    Pagen was built to solve a single, universal problem: the 8:50 AM panic before the first period. We are an independent, student-operated network designed specifically for the Heritage campus.
                  </p>
                  <p className="text-gray-300 leading-relaxed">
                    We believe in decentralizing the campus infrastructure. There are no middlemen and no corporate overhead&mdash;just a peer-to-peer grid that lets students save time and lets Runners make money on their daily walk to class.
                  </p>
                </div>
              )}

              {activeModal === "workwithus" && (
                <div className="p-8 md:p-10">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Zap size={20} className="text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold">Join the Grid.</h2>
                  </div>

                  {/* Zone 1: Runner Pitch */}
                  <p className="text-gray-300 leading-relaxed mb-5">
                    Your daily walk to class can be monetized. Pagen is always expanding its grid of active Runners.
                  </p>
                  <ul className="space-y-3 mb-5">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 shrink-0"><ChevronRight size={14} className="text-emerald-400" /></div>
                      <div><strong className="text-white">Set Your Own Margins.</strong> <span className="text-gray-400">You control exactly how much profit you make per page.</span></div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 shrink-0"><ChevronRight size={14} className="text-emerald-400" /></div>
                      <div><strong className="text-white">Work When You Want.</strong> <span className="text-gray-400">Turn on your availability when you have a free period. Claim the jobs you want; ignore the ones you don&apos;t.</span></div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 shrink-0"><ChevronRight size={14} className="text-emerald-400" /></div>
                      <div><strong className="text-white">Zero Upfront Fees.</strong> <span className="text-gray-400">Join the network for free. We only take a micro-percentage of your successful deliveries.</span></div>
                    </li>
                  </ul>


                  {/* Divider */}
                  <hr className="my-8 border-gray-800" />

                  {/* Zone 2: Unsupervised Labs */}
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <Terminal size={16} className="text-indigo-400" />
                      <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Core Operations (Unsupervised Labs)</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                      Pagen is operated by a small, faceless team. We are currently looking for <strong className="text-white">one</strong> highly capable student to join the core administrative team to monitor the grid and scale the architecture.
                    </p>
                    <p className="text-gray-500 text-sm leading-relaxed mb-5">
                      You need to be analytical, capable of keeping secrets, and comfortable with modern web infrastructure. We don&apos;t do traditional interviews.
                    </p>
                    <div className="bg-black/40 border border-indigo-500/20 rounded-lg p-4">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2 font-medium">Drop your resume and GitHub link here</p>
                      <div className="flex items-center gap-2">
                        <a
                          href="mailto:unsupervised.labs@proton.me"
                          className="text-indigo-400 hover:text-indigo-300 font-mono text-sm transition-colors"
                          style={{ textShadow: '0 0 10px rgba(99,102,241,0.3)' }}
                        >
                          unsupervised.labs@proton.me
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText('unsupervised.labs@proton.me');
                            const btn = document.getElementById('copy-email-btn');
                            if (btn) { btn.dataset.copied = 'true'; setTimeout(() => { btn.dataset.copied = 'false'; }, 2000); }
                          }}
                          id="copy-email-btn"
                          data-copied="false"
                          className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-500 hover:text-indigo-400 transition-all group"
                          title="Copy email"
                        >
                          <Copy size={13} className="group-data-[copied=true]:hidden" />
                          <Check size={13} className="hidden group-data-[copied=true]:block text-emerald-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}


              {activeModal === "legal" && (
                <div className="p-8 md:p-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <FileText size={20} className="text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-bold">Legal</h2>
                  </div>
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Shield size={16} className="text-amber-400" /> Terms of Service
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                      Pagen acts exclusively as a matching platform connecting students who need printing services (Buyers) with students willing to provide them (Runners). We are not a printing company. All financial transactions for prints occur directly between the Buyer and the Runner. Pagen is not legally liable for the quality of the prints, missed deadlines, or offline disputes, though we actively monitor the network to suspend unreliable users. By using the platform, you agree to these peer-to-peer terms.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Shield size={16} className="text-amber-400" /> Privacy Policy
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                      We take your data seriously. Pagen uses Google authentication restricted to institutional emails to ensure a secure, closed network. Any documents uploaded to the platform are processed through secure, temporary cloud storage. We employ automated cleanup scripts that sever the links to your files once an order is marked as delivered or canceled. We do not view, analyze, or sell your documents to third parties.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Canvas Background */}
      <div ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" style={{ contain: 'strict', height: '100vh' }}>
        {canvasVisible && (
          <Canvas camera={{ position: [0, 0, 10], fov: 50 }} dpr={[1, 1.5]} performance={{ min: 0.5 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} color="#4F46E5" />
            <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#10B981" />
            <FloatingPages />
          </Canvas>
        )}
      </div>

      {/* Navigation Bar */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 max-w-7xl mx-auto border-b border-white/10 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 sm:w-20 sm:h-20 rounded flex items-center justify-center overflow-hidden shrink-0">
            <img src="/Logo.jpg?v=2" alt="Pagen" className="w-full h-full object-cover rounded-md" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight">Pagen</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
          <button onClick={() => setActiveModal("about")} className="hidden md:block text-gray-300 hover:text-white transition-colors">About Us</button>
          {session ? (
            <Link href="/contact" className="hidden md:block text-gray-300 hover:text-white transition-colors">Contact</Link>
          ) : (
            <Link href="/auth/signin?callbackUrl=/contact" className="hidden md:block text-gray-300 hover:text-white transition-colors">Contact</Link>
          )}
          <button 
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} 
            className="hidden md:block text-gray-300 hover:text-white transition-colors"
          >
            How it Works
          </button>
          {session ? (
            <div className="flex items-center gap-4">
              {(session.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL || session.user?.email === "antik13sarkar@gmail.com") && (
                <Link href="/admin" className="hidden md:flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all font-semibold text-xs sm:text-sm">
                  <Shield size={16} /> Admin Message
                </Link>
              )}
              <Link href="/dashboard" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all font-semibold text-xs sm:text-sm">
                Dashboard
              </Link>
              <div className="relative group">
                {/* Avatar Button */}
                <button className="w-9 h-9 rounded-full bg-[#5c6bc0] flex items-center justify-center text-white text-[17px] font-medium hover:opacity-90 transition-all">
                  {session.user?.email?.[0]?.toUpperCase() || "U"}
                </button>

                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#292a2d]/95 backdrop-blur-xl border border-[#3c4043] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#3c4043]/50 bg-[#202124]/50">
                    <p className="text-xs text-[#9aa0a6]">Signed in as</p>
                    <p className="text-sm font-medium text-[#e8eaed] truncate mt-0.5">{session.user?.email}</p>
                  </div>
                  <div className="p-1">
                    <button 
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 rounded-lg"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Link href="/auth/signin?callbackUrl=/" className="hidden sm:block text-gray-300 hover:text-white transition-colors">Sign In</Link>
              <Link href="/auth/signin?callbackUrl=/" className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-white text-black hover:bg-gray-200 transition-all font-semibold text-xs sm:text-sm flex items-center justify-center">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-4 text-center max-w-4xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-indigo-300 mb-8 will-change-transform"
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
          Your campus prints, <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            anytime, anywhere.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl"
        >
          Skip the Xerox queues. Upload your PDFs and get them hand-delivered by fellow students anywhere on campus. Near a print shop? Start earning cash on your own schedule.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          {session ? (
            <Link href="/dashboard" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]">
              Go to Dashboard <ArrowRight size={20} />
            </Link>
          ) : (
            <>
              <Link href="/auth/signin?callbackUrl=/" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]">
                Order a Print <ArrowRight size={20} />
              </Link>
    
              <Link href="/auth/signin?callbackUrl=/" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg transition-all">
                <Wallet size={20} className="text-emerald-400" />
                Become a Runner
              </Link>
            </>
          )}
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

      {/* Features Section */}
      <section id="features" className="relative z-10 py-20 px-6 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Why <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Pagen</span>?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">Everything you need. Nothing you don&apos;t.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: <Users size={22} className="text-indigo-400" />, title: "Peer-to-Peer Delivery", desc: "Skip the Xerox shop line. Get lab manuals and assignments delivered directly to your location on campus.", color: "indigo" },
            { icon: <Wallet size={22} className="text-emerald-400" />, title: "Transparent Pricing", desc: "Runners set their own rates. You see the exact price before you broadcast the job.", color: "emerald" },
            { icon: <Shield size={22} className="text-cyan-400" />, title: "Pagen Privacy", desc: "Your documents are your business. Files are securely routed and automatically unlinked the moment your delivery is confirmed.", color: "cyan" },
            { icon: <Zap size={22} className="text-amber-400" />, title: "Cashless Handoff", desc: "Pay your Runner directly via UPI when they hand you the papers. No wallet top-ups required for buyers.", color: "amber" },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className={`p-6 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-${f.color}-500/30 transition-all group`}
            >
              <div className={`w-10 h-10 rounded-lg bg-${f.color}-500/10 flex items-center justify-center mb-4`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Campus Expansion Leaderboard */}
      <CampusExpansion />

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-20 px-6 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">FAQ</h2>
          <p className="text-gray-400 text-center mb-12">Quick answers. No fluff.</p>
        </motion.div>
        <div className="space-y-4">
          {[
            { q: "How do I pay for my prints?", a: "You pay the Runner directly via their personal UPI QR code at the time of delivery. Pagen handles the matching; you handle the handshake." },
            { q: "What happens to my PDF after printing?", a: "We use an ephemeral storage system. Once you click \"I Received My Printout,\" the file link is permanently severed from our database." },
            { q: "What if the Runner doesn't show up?", a: "If an order is delayed, you can cancel it from your dashboard. Runners who repeatedly fail to deliver are removed from the network." },
          ].map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                <span className="text-indigo-400 font-bold">Q:</span> {faq.q}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed pl-6">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer Section */}
      <footer className="relative z-10 border-t border-white/10 bg-[#16171a] pt-16 pb-28 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded flex items-center justify-center overflow-hidden">
                  <img src="/Logo.jpg?v=2" alt="Pagen" className="w-full h-full object-cover rounded" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">Pagen</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your campus prints, anytime, anywhere.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold mb-4 text-white text-sm">Product</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-white text-sm">Company</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><button onClick={() => setActiveModal("about")} className="hover:text-white transition-colors">About Us</button></li>
                <li><button onClick={() => setActiveModal("workwithus")} className="hover:text-white transition-colors">Work with us</button></li>
                <li>{session ? (
                  <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
                ) : (
                  <Link href="/auth/signin?callbackUrl=/contact" className="hover:text-white transition-colors">Contact</Link>
                )}</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-white text-sm">Legal</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><button onClick={() => setActiveModal("legal")} className="hover:text-white transition-colors">Terms of Service</button></li>
                <li><button onClick={() => setActiveModal("legal")} className="hover:text-white transition-colors">Privacy Policy</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Pagen. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-gray-400">
              <a href="#" className="hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
