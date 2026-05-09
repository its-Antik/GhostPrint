"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { User, ShoppingBag, Truck, BarChart3, Settings, CheckCircle2, ShieldCheck, Info, Search, MapPin, Zap, Star, Eye, X, Check } from "lucide-react";
import Onboarding from "@/components/Onboarding";
import RunnerSetup from "@/components/RunnerSetup";
import RateCard from "@/components/RateCard";
import UploadManager from "@/components/UploadManager";
import DebtDashboard from "@/components/DebtDashboard";
import PushNotificationManager from "@/components/PushNotificationManager";
import GhostChat from "@/components/GhostChat";
import GhostPingProvider from "@/components/GhostPing";
import NotificationBell from "@/components/NotificationBell";
import { supabase } from "@/lib/supabase";
import { useSmartRealtime } from "@/hooks/useSmartRealtime";
import { useNotifications } from "@/hooks/useNotifications";
import { showGhostPing } from "@/components/GhostPing";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<"buyer" | "runner" | "profile">("buyer");
  const [buyerTab, setBuyerTab] = useState<"dashboard" | "orders">("dashboard");
  const [runnerTab, setRunnerTab] = useState<"dashboard" | "jobs" | "orders" | "pricing" | "wallet">("dashboard");

  // Activity dot indicators — tracks which tabs have unseen activity
  const [tabDots, setTabDots] = useState<{
    runner: boolean;   // dot on the "Runner" top-level tab
    jobs: boolean;     // dot on the "Jobs" runner sub-tab
    orders: boolean;   // dot on the "Orders" runner sub-tab
    buyer: boolean;    // dot on the "Buyer" top-level tab
    buyerOrders: boolean; // dot on the buyer "Orders" sub-tab
  }>({ runner: false, jobs: false, orders: false, buyer: false, buyerOrders: false });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showHandshakeModal, setShowHandshakeModal] = useState(false);
  const [orderState, setOrderState] = useState<'idle' | 'upload' | 'finding' | 'found' | 'accepted' | 'printing' | 'ready' | 'delivered' | 'cancelled'>('idle');
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activePickups, setActivePickups] = useState<any[]>([]);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [runnerDues, setRunnerDues] = useState(0);
  const [runnerBonus, setRunnerBonus] = useState(25);
  const [runnerRates, setRunnerRates] = useState<{ bw_rate: number; color_rate: number }>({ bw_rate: 2, color_rate: 5 });
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [pastOrders, setPastOrders] = useState<any[]>([]);
  const router = useRouter();

  // Notification system
  const {
    unreadCount,
    notifications: notifList,
    isOpen: notifOpen,
    togglePanel: toggleNotifPanel,
    closePanel: closeNotifPanel,
    markAllRead,
  } = useNotifications(session?.user?.email || undefined);

  // Listen for new notifications and set activity dots on inactive tabs
  const prevNotifCount = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevNotifCount.current) {
      const latestNotif = notifList[0];
      const action = latestNotif?.metadata?.action || '';

      // New gig available → light up Runner tab + Jobs sub-tab
      if (latestNotif?.title?.includes('Ghost Gig')) {
        if (mode !== 'runner') {
          setTabDots(prev => ({ ...prev, runner: true, jobs: true }));
        } else if (runnerTab !== 'jobs') {
          setTabDots(prev => ({ ...prev, jobs: true }));
        }
      }

      // Order status changes → light up Buyer tab
      if (['order_accepted', 'printing_started', 'prints_ready', 'delivered'].includes(action)) {
        if (mode !== 'buyer') {
          setTabDots(prev => ({ ...prev, buyer: true }));
        }
      }

      // Cancellation actions → light up Runner tab + Orders sub-tab
      if (['buyer_cancelled_free', 'buyer_cancelled_late', 'self_dropped', 'self_dropped_late'].includes(action)) {
        if (mode !== 'runner') {
          setTabDots(prev => ({ ...prev, runner: true, orders: true }));
        } else if (runnerTab !== 'orders') {
          setTabDots(prev => ({ ...prev, orders: true }));
        }
      }
    }
    prevNotifCount.current = unreadCount;
  }, [unreadCount, notifList, mode, runnerTab]);

  // DIRECT orders realtime listener — fires dots even if notification system isn't set up
  useEffect(() => {
    if (!session?.user?.email) return;

    const channel = supabase
      .channel('order_dot_watcher')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload: any) => {
          const newOrder = payload.new;
          // New order posted by someone else → light up Runner + Jobs
          if (newOrder.buyer_id !== session.user!.email && newOrder.status === 'searching') {
            if (mode !== 'runner') {
              setTabDots(prev => ({ ...prev, runner: true, jobs: true }));
            } else if (runnerTab !== 'jobs') {
              setTabDots(prev => ({ ...prev, jobs: true }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload: any) => {
          const updated = payload.new;
          // Order I placed got status update → light up Buyer tab
          if (updated.buyer_id === session.user!.email) {
            if (mode !== 'buyer') {
              setTabDots(prev => ({ ...prev, buyer: true }));
            }
          }
          // Order I'm running got cancelled by buyer → light up Runner + Orders
          if (updated.runner_id === session.user!.email && updated.status === 'cancelled') {
            if (mode !== 'runner') {
              setTabDots(prev => ({ ...prev, runner: true, orders: true }));
            } else if (runnerTab !== 'orders') {
              setTabDots(prev => ({ ...prev, orders: true }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [session?.user?.email, mode, runnerTab]);

  // Wrap setMode to clear dots when switching tabs
  const handleModeSwitch = useCallback((newMode: "buyer" | "runner" | "profile") => {
    setMode(newMode);
    if (newMode === 'runner') setTabDots(prev => ({ ...prev, runner: false }));
    if (newMode === 'buyer') setTabDots(prev => ({ ...prev, buyer: false }));
  }, []);

  // Wrap setRunnerTab to clear sub-tab dots
  const handleRunnerTabSwitch = useCallback((tab: "dashboard" | "jobs" | "orders" | "pricing" | "wallet") => {
    setRunnerTab(tab);
    if (tab === 'jobs') setTabDots(prev => ({ ...prev, jobs: false }));
    if (tab === 'orders') setTabDots(prev => ({ ...prev, orders: false }));
  }, []);

  useEffect(() => {
    if (mode === "buyer") window.history.replaceState(null, '', '/buyer');
    else if (mode === "profile") window.history.replaceState(null, '', '/profile');
    else if (mode === "runner") {
       if (runnerTab === "dashboard") window.history.replaceState(null, '', '/dashboard-runner');
       else if (runnerTab === "jobs") window.history.replaceState(null, '', '/jobs-runner');
       else if (runnerTab === "orders") window.history.replaceState(null, '', '/orders-runner');
       else if (runnerTab === "pricing") window.history.replaceState(null, '', '/price-setup');
       else if (runnerTab === "wallet") window.history.replaceState(null, '', '/wallet-runner');
    }
  }, [mode, runnerTab]);

  // Fetch runner orders via server API (bypasses RLS)
  const fetchRunnerOrders = async () => {
    if (!session?.user?.email) return;
    try {
      const [searchingRes, activeRes, profileRes, completedRes] = await Promise.all([
        fetch('/api/orders?status=searching'),
        fetch(`/api/orders?status=accepted,printing,ready&runner_id=${encodeURIComponent(session.user.email)}`),
        fetch('/api/profile'),
        fetch(`/api/orders?status=delivered&runner_id=${encodeURIComponent(session.user.email)}`),
      ]);

      const searchingJson = await searchingRes.json();
      if (searchingJson.orders) setAvailableOrders(searchingJson.orders);

      const activeJson = await activeRes.json();
      if (activeJson.orders) setActivePickups(activeJson.orders);

      const profileJson = await profileRes.json();
      if (profileJson.profile) {
        setRunnerDues(Number(profileJson.profile.dues) || 0);
        setRunnerBonus(Number(profileJson.profile.bonus) || 25);
        setRunnerRates({
          bw_rate: profileJson.profile.bw_rate || 2,
          color_rate: profileJson.profile.color_rate || 5,
        });
      }

      const completedJson = await completedRes.json();
      if (completedJson.orders) {
        setJobsCompleted(completedJson.orders.length);
        // Calculate net earnings per order: runnerCharge - baseCost - platformFee
        const BASE_BW = 2;
        const BASE_COLOR = 5;
        let totalNet = 0;
        for (const order of completedJson.orders) {
          const runnerCharge = Number(order.total_price) || 0;
          let baseCost = 0;
          if (order.file_metadata) {
            for (const file of order.file_metadata) {
              const baseRate = file.colorMode === 'color' ? BASE_COLOR : BASE_BW;
              const copies = file.copies || 1;
              baseCost += file.pages * baseRate * copies;
            }
          }
          const isBaseRate = runnerCharge <= baseCost;
          const platformFee = isBaseRate ? 0 : Math.round(runnerCharge * 0.10);
          totalNet += runnerCharge - baseCost - platformFee;
        }
        setTotalEarnings(totalNet);
      }

      // Fetch ALL past orders (both as buyer and runner) for Orders tab
      const [buyerOrdersRes, runnerOrdersRes] = await Promise.all([
        fetch(`/api/orders?buyer_id=${encodeURIComponent(session.user.email)}`),
        fetch(`/api/orders?runner_id=${encodeURIComponent(session.user.email)}`),
      ]);
      const buyerOrdersJson = await buyerOrdersRes.json();
      const runnerOrdersJson = await runnerOrdersRes.json();
      
      // Merge and deduplicate by id
      const allOrders = [...(buyerOrdersJson.orders || []), ...(runnerOrdersJson.orders || [])];
      const uniqueOrders = Array.from(new Map(allOrders.map((o: any) => [o.id, o])).values());
      // Sort by created_at descending
      uniqueOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPastOrders(uniqueOrders);
    } catch (err) {
      console.error('Failed to fetch runner data:', err);
    }
  };

  // Stable callback for fetching runner orders (used by smart realtime hook)
  const stableFetchRunnerOrders = useCallback(() => {
    if (session?.user?.email) fetchRunnerOrders();
  }, [session?.user?.email]);

  // Smart Realtime: auto-disconnects after 10 min idle or when tab goes to background.
  // Prevents the 500-connection Supabase ceiling from being hit by idle phones.
  useSmartRealtime('runner_orders_live', {
    table: 'orders',
    event: '*',
    onPayload: stableFetchRunnerOrders,
    enabled: mode === 'runner' && !!session?.user?.email,
  });

  useEffect(() => {
    if (mode === "runner" && session?.user?.email) {
      fetchRunnerOrders();
    }
  }, [mode, session]);

  // Auto-resume: check if buyer has an active order and restore the tracking view
  useEffect(() => {
    if (mode !== 'buyer' || !session?.user?.email) return;
    if (orderState !== 'idle') return; // Don't override if already tracking

    const checkActiveOrder = async () => {
      try {
        const res = await fetch(`/api/orders?status=searching,accepted,printing,ready&buyer_id=${encodeURIComponent(session.user!.email!)}`);
        const json = await res.json();
        const activeOrder = (json.orders || []).find((o: any) => 
          ['searching', 'accepted', 'printing', 'ready'].includes(o.status)
        );
        if (activeOrder) {
          setCurrentOrder(activeOrder);
          if (activeOrder.status === 'searching') {
            // Resume the search animation on the dashboard tab
            setOrderState('finding');
            setBuyerTab('dashboard');
          } else {
            // Order is accepted/printing/ready — show dot on Orders tab
            setOrderState('idle');
            setBuyerTab('dashboard');
            setTabDots(prev => ({ ...prev, buyerOrders: true }));
          }
          if (activeOrder.total_price) setEstimatedPrice(activeOrder.total_price);
        }
      } catch (err) {
        console.error('Failed to check active orders:', err);
      }
    };
    checkActiveOrder();
  }, [mode, session?.user?.email]);



  // A. The "Claim" Function
  const claimJob = async (orderId: string) => {
    if (status !== "authenticated" || !session?.user) {
      alert("Please sign in!");
      return;
    }

    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          runner_id: session.user.email,
          status: "accepted",
        }),
      });

      const result = await res.json();

      if (res.status === 409) {
        // Race condition: another runner claimed it first
        alert("⚡ Too slow! This job was just claimed by another runner.");
        // Remove from available list so they don't try again
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
        return;
      }

      if (!res.ok) {
        console.error("Error claiming job:", result.error);
        alert(`Failed to claim job: ${result.error}`);
        return;
      }

      // Successfully claimed — re-fetch to update UI
      await fetchRunnerOrders();
    } catch (err) {
      console.error("Claim error:", err);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error("Status update failed:", result.error);
        alert(`Failed to update status: ${result.error}`);
        return;
      }
      // Manually re-fetch to update UI immediately
      await fetchRunnerOrders();
    } catch (err) {
      console.error("Status update error", err);
    }
  };

  const handleBackToDashboard = () => {
    if (orderState === 'finding') {
      alert("Please wait for the request to get accepted or cancel your order to go back.");
      return;
    }
    if (orderState === 'found' || orderState === 'accepted' || orderState === 'printing' || orderState === 'ready') {
      alert("You have an active order. Please wait for delivery or cancel the order.");
      return;
    }
    setOrderState('idle');
  };

  const cancelOrder = async () => {
    if (currentOrder?.id) {
      await updateOrderStatus(currentOrder.id, 'cancelled');
    }
    setOrderState('cancelled');
  };

  // SAFETY MODE: Auto-cancel order if buyer leaves during search
  // Prevents ghost orders where buyer closes tab but order stays active
  const orderStateRef = useRef(orderState);
  const currentOrderRef = useRef(currentOrder);
  orderStateRef.current = orderState;
  currentOrderRef.current = currentOrder;

  useEffect(() => {
    if (orderState !== 'finding') return;

    // Show warning toast when search starts
    showGhostPing(
      "🔒 Safety Mode Active",
      "Stay on this tab! Switching tabs or closing the browser will auto-cancel your search.",
      "info"
    );

    // 1. Warn before closing/refreshing
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (orderStateRef.current === 'finding') {
        e.preventDefault();
        e.returnValue = "Your order search is active. Leaving will cancel it.";
        return e.returnValue;
      }
    };

    // 2. Auto-cancel when user switches to another browser tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && orderStateRef.current === 'finding') {
        // Auto-cancel the order
        if (currentOrderRef.current?.id) {
          fetch('/api/orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: currentOrderRef.current.id,
              status: 'cancelled',
            }),
          }).catch(console.error);
        }
        setOrderState('cancelled');
        // Show warning when they come back
        setTimeout(() => {
          showGhostPing(
            "⚠️ Search Auto-Cancelled",
            "Your order was cancelled because you switched tabs. Please stay on this page while searching for a runner.",
            "system"
          );
        }, 500);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [orderState]);

  const handleOrderSubmit = async (files: any[], totalPages: number, totalCost: number, deliveryLocation: string) => {
    try {
      if (status !== "authenticated" || !session?.user) {
        router.push("/auth/signin");
        return;
      }

      setEstimatedPrice(totalCost);
      setOrderState('finding');

      // 1. Upload files to Telegram via bot for unlimited storage
      const fileMetadata = [];
      for (const f of files) {
        const formData = new FormData();
        formData.append("file", f.file);

        try {
          const response = await fetch("/api/telegram-upload", {
            method: "POST",
            body: formData
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Telegram upload failed");
          }

          const data = await response.json();
          fileMetadata.push({
            name: f.name,
            pages: f.pages,
            copies: f.copies || 1,
            url: data.url,           // viewable file URL
            file_id: data.file_id,   // Telegram file_id for re-fetching
            colorMode: f.colorMode
          });
        } catch (uploadErr) {
          console.error("Upload error for", f.name, uploadErr);
          fileMetadata.push({
            name: f.name,
            pages: f.pages,
            copies: f.copies || 1,
            url: null,
            file_id: null,
            colorMode: f.colorMode
          });
        }
      }

      // 2. Create order via server API route (bypasses RLS)
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_pages: totalPages,
          total_cost: totalCost,
          file_metadata: fileMetadata,
          delivery_location: deliveryLocation
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.order) {
        console.error("Order creation failed:", result);
        alert(`Failed to create order: ${result.error || "Unknown error"}`);
        setOrderState('upload');
        return;
      }

      const orderId = result.order.id;
      setCurrentOrder(result.order);
      console.log("Order created successfully:", orderId);

      // 3. Subscribe to Realtime Updates for this order
      const subscription = supabase
        .channel(`order_updates_${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            console.log('Order update received!', payload);
            const newStatus = payload.new.status;
            setCurrentOrder(payload.new);
            if (payload.new.total_price) {
              setEstimatedPrice(payload.new.total_price);
            }

            if (newStatus === 'accepted') {
              // Runner accepted! Move order to Orders tab with a dot prompt
              setOrderState('idle');
              setBuyerTab('dashboard');
              setTabDots(prev => ({ ...prev, buyerOrders: true }));
              showGhostPing(
                "🎉 Runner Found!",
                "A runner has accepted your order. Check the Orders tab to track progress.",
                "info"
              );
              subscription.unsubscribe();
              clearInterval(pollInterval);
            } else if (newStatus === 'delivered' || newStatus === 'cancelled') {
              setOrderState(newStatus as any);
              subscription.unsubscribe();
              clearInterval(pollInterval);
            } else {
              setOrderState(newStatus as any);
            }
          }
        )
        .subscribe();

      // Polling fallback (RLS may block realtime events for non-Supabase-auth users)
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/orders?status=searching,accepted,printing,ready,delivered,cancelled&buyer_id=${encodeURIComponent(session.user!.email!)}`);
          const pollJson = await pollRes.json();
          const thisOrder = pollJson.orders?.find((o: any) => o.id === orderId);
          if (thisOrder) {
            const newStatus = thisOrder.status;
            setCurrentOrder(thisOrder);
            if (thisOrder.total_price) setEstimatedPrice(thisOrder.total_price);

            if (newStatus === 'accepted') {
              setOrderState('idle');
              setBuyerTab('dashboard');
              setTabDots(prev => ({ ...prev, buyerOrders: true }));
              showGhostPing(
                "🎉 Runner Found!",
                "A runner has accepted your order. Check the Orders tab to track progress.",
                "info"
              );
              clearInterval(pollInterval);
              subscription.unsubscribe();
            } else if (newStatus === 'delivered' || newStatus === 'cancelled') {
              setOrderState(newStatus as any);
              clearInterval(pollInterval);
              subscription.unsubscribe();
            }
          }
        } catch (err) { /* silent */ }
      }, 5000);

      // Visibility-aware: disconnect when tab goes to background,
      // reconnect + immediate poll when it returns
      let visibilityTimeout: ReturnType<typeof setTimeout> | null = null;
      const handleBuyerVisibility = () => {
        if (document.hidden) {
          // Tab backgrounded — disconnect after 30s grace period
          visibilityTimeout = setTimeout(() => {
            subscription.unsubscribe();
            clearInterval(pollInterval);
          }, 30_000);
        } else {
          // Tab foregrounded — cancel disconnect, reconnect, and do immediate poll
          if (visibilityTimeout) clearTimeout(visibilityTimeout);
          subscription.subscribe();
        }
      };
      document.addEventListener('visibilitychange', handleBuyerVisibility);

      // Safety timeout: 10 minutes max for this subscription
      const maxTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        subscription.unsubscribe();
        document.removeEventListener('visibilitychange', handleBuyerVisibility);
      }, 600000); // 10 minutes

    } catch (err) {
      console.error(err);
      setOrderState('upload');
    }
  };

  return (
    <div className="min-h-screen bg-[#202124] text-[#e8eaed] font-sans">
      <GhostPingProvider />
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
      <PaymentHandshakeModal 
        isOpen={showHandshakeModal} 
        onClose={() => setShowHandshakeModal(false)} 
        order={currentOrder} 
        onVerify={async () => {
          if (!currentOrder) return;
          await updateOrderStatus(currentOrder.id, 'delivered');
          // Add 10% platform commission to runner dues
          const runnerCharge = Number(currentOrder.total_price) || 0;
          let baseCost = 0;
          if (currentOrder.file_metadata) {
            for (const file of currentOrder.file_metadata) {
              const baseRate = file.colorMode === 'color' ? 5 : 2;
              const copies = file.copies || 1;
              baseCost += file.pages * baseRate * copies;
            }
          }
          const isBaseRate = runnerCharge <= baseCost;
          if (!isBaseRate) {
            const platformFee = Math.round(runnerCharge * 0.10);
            const newDues = runnerDues + platformFee;
            setRunnerDues(newDues);
            await fetch('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dues: newDues })
            });
          }
          fetchRunnerOrders();
        }} 
      />
      
      {/* HEADER / NAVIGATION */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-[#3c4043] bg-[#202124] sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[#9aa0a6] hover:text-white transition-colors bg-[#292a2d] hover:bg-[#3c4043] px-3 py-1.5 rounded-lg border border-[#3c4043] text-sm font-medium cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Home
          </Link>
          {(session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL || session?.user?.email === "antik13sarkar@gmail.com") && (
            <Link href="/admin" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/30 text-sm font-medium cursor-pointer">
              <ShieldCheck size={16} />
              Admin
            </Link>
          )}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded flex items-center justify-center overflow-hidden">
              <img src="/Logo.jpg" alt="GhostPrint" className="w-full h-full object-cover rounded-md" />
            </div>
            <span className="font-bold tracking-tight">GhostPrint</span>
          </div>
        </div>

        {/* THE MODE SWITCHER + BELL */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleModeSwitch("buyer")}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${mode === 'buyer' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-[#9aa0a6] hover:bg-white/5'}`}
          >
            <ShoppingBag size={16} /> Buyer
            {tabDots.buyer && mode !== 'buyer' && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f28b82] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f28b82]"></span>
              </span>
            )}
          </button>
          <button 
            onClick={() => {
              if (orderState === 'finding') {
                alert("⚠️ You have an active search running. Cancel the search first to switch tabs.");
                return;
              }
              handleModeSwitch("runner");
            }}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${mode === 'runner' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-[#9aa0a6] hover:bg-white/5'} ${orderState === 'finding' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Truck size={16} /> Runner
            {tabDots.runner && mode !== 'runner' && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f28b82] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f28b82]"></span>
              </span>
            )}
          </button>
          <button 
            onClick={() => {
              if (orderState === 'finding') {
                alert("⚠️ You have an active search running. Cancel the search first to switch tabs.");
                return;
              }
              handleModeSwitch("profile");
            }}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${mode === 'profile' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-[#9aa0a6] hover:bg-white/5'} ${orderState === 'finding' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <User size={16} /> Profile
          </button>

          {/* Notification Bell */}
          <div className="ml-2 border-l border-[#3c4043] pl-3">
            <NotificationBell
              unreadCount={unreadCount}
              notifications={notifList}
              isOpen={notifOpen}
              onToggle={toggleNotifPanel}
              onClose={closeNotifPanel}
              onMarkAllRead={markAllRead}
            />
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto p-8">
        <AnimatePresence mode="wait">
          {mode === "buyer" ? (
            <motion.div 
              key="buyer" 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* BUYER VIEW: ORDER FORM & HISTORY */}
              <div className="flex justify-between items-end border-b border-[#3c4043] pb-4">
                <div>
                  <h1 className="text-2xl font-medium text-white">Hello, {session?.user?.name || session?.user?.email?.split('@')[0] || 'Student'}</h1>
                  <p className="text-[#9aa0a6] text-sm mt-1">Need something printed today?</p>
                </div>
                {orderState === 'idle' && buyerTab === 'dashboard' && (
                  <button 
                    onClick={() => setOrderState('upload')}
                    className="bg-[#8ab4f8] text-[#202124] px-4 py-2 rounded-md font-medium hover:bg-[#aecbfa] transition-colors"
                  >
                    + New Print Request
                  </button>
                )}
              </div>

              {/* BUYER SUB-TABS — always visible */}
              <div className="flex items-center gap-6 border-b border-[#3c4043] pb-3 mb-6">
                <button 
                  onClick={() => {
                    if (orderState === 'finding') return; // locked during search
                    setBuyerTab("dashboard");
                    setTrackingOrder(null);
                  }} 
                  className={`text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${buyerTab === 'dashboard' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'} ${orderState === 'finding' && buyerTab !== 'dashboard' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => {
                    if (orderState === 'finding') {
                      alert("⚠️ Cancel your search first to switch tabs.");
                      return;
                    }
                    setBuyerTab("orders");
                    setTabDots(prev => ({ ...prev, buyerOrders: false }));
                  }} 
                  className={`relative text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${buyerTab === 'orders' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'} ${orderState === 'finding' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Orders
                  {tabDots.buyerOrders && buyerTab !== 'orders' && (
                    <span className="absolute -top-1 -right-2 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f28b82] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f28b82]"></span>
                    </span>
                  )}
                </button>
              </div>
              
              {buyerTab === 'orders' && orderState === 'idle' && trackingOrder ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <button 
                    onClick={() => setTrackingOrder(null)} 
                    className="text-[#9aa0a6] hover:text-white flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Back to Orders
                  </button>

                  {['accepted', 'searching'].includes(trackingOrder.status) ? (
                    <>
                      <BuyerAcceptedView 
                        order={trackingOrder} 
                        onCancel={async () => {
                          await updateOrderStatus(trackingOrder.id, 'cancelled');
                          setTrackingOrder(null);
                        }}
                      />
                      {trackingOrder.id && session?.user?.email && (
                        <GhostChat
                          orderId={trackingOrder.id}
                          currentUserEmail={session.user.email}
                          isRunner={false}
                          orderStatus={trackingOrder.status}
                        />
                      )}
                    </>
                  ) : ['printing', 'ready', 'delivered'].includes(trackingOrder.status) ? (
                    <>
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        className="bg-[#292a2d] border border-[#8ab4f8]/50 rounded-xl p-10 flex flex-col items-center justify-center text-center shadow-[0_0_40px_rgba(138,180,248,0.1)]"
                      >
                        <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                          {trackingOrder.status === 'printing' && (
                            <>
                              <div className="absolute inset-0 border-4 border-[#fde293]/20 rounded-full"></div>
                              <div className="absolute inset-0 border-4 border-[#fde293] rounded-full border-t-transparent animate-spin"></div>
                              <Zap size={32} className="text-[#fde293] animate-pulse" />
                            </>
                          )}
                          {trackingOrder.status === 'ready' && (
                            <>
                              <div className="absolute inset-0 border-4 border-[#81c995] rounded-full"></div>
                              <CheckCircle2 size={32} className="text-[#81c995]" />
                            </>
                          )}
                          {trackingOrder.status === 'delivered' && (
                            <>
                              <div className="absolute inset-0 border-4 border-[#81c995] rounded-full"></div>
                              <Star size={32} className="text-[#81c995]" />
                            </>
                          )}
                        </div>
                        <h3 className="text-2xl font-medium text-white mb-2">
                          {trackingOrder.status === 'printing' ? 'Printing your documents...' : trackingOrder.status === 'ready' ? 'Ready for Pickup!' : 'Job Delivered!'}
                        </h3>
                        <p className="text-[#9aa0a6] mb-6">
                          {trackingOrder.status === 'printing' ? 'Your runner is currently printing the files.' : trackingOrder.status === 'ready' ? 'Meet the runner and share your OTP to collect.' : 'Thank you for using GhostPrint!'}
                        </p>
                        <div className="w-full max-w-2xl bg-[#202124] border border-[#3c4043] rounded-lg p-6 text-left mt-4 mb-6">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-1">Runner</p>
                              <p className="text-lg font-medium text-white">{trackingOrder.runner_id?.split('@')[0] || 'Runner'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-1">Pickup OTP</p>
                              <p className="text-2xl font-mono tracking-widest text-[#8ab4f8]">{trackingOrder.pickup_code}</p>
                            </div>
                          </div>
                          <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-2">Delivery Location</p>
                          <p className="text-white mb-6 bg-[#3c4043] inline-block px-3 py-1 rounded text-sm">{trackingOrder.delivery_location || 'Campus'}</p>
                          <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-3">Document Stack</p>
                          <div className="space-y-3">
                            {trackingOrder.file_metadata?.map((file: any, i: number) => (
                              <div key={i} className="flex justify-between items-center bg-[#292a2d] p-3 rounded border border-[#3c4043]">
                                <div>
                                  <p className="text-sm font-medium text-[#e8eaed]">{file.name}</p>
                                  <p className="text-xs text-[#9aa0a6]">{file.pages} pages • {file.colorMode === 'bw' ? 'B&W' : 'Color'} • {file.copies || 1} Copies</p>
                                </div>
                                {file.url && (
                                  <button onClick={() => window.open(file.url, '_blank')} className="text-[#8ab4f8] hover:text-[#aecbfa] text-sm font-medium flex items-center gap-1">
                                    <Eye size={14} /> View
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                      {trackingOrder.id && session?.user?.email && trackingOrder.status !== 'delivered' && (
                        <GhostChat
                          orderId={trackingOrder.id}
                          currentUserEmail={session.user.email}
                          isRunner={false}
                          orderStatus={trackingOrder.status}
                        />
                      )}
                    </>
                  ) : trackingOrder.status === 'cancelled' ? (
                    <motion.div className="bg-[#292a2d] border border-[#ea4335]/50 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-[#ea4335]/20 rounded-full flex items-center justify-center mb-4 border border-[#ea4335]">
                        <X size={32} className="text-[#ea4335]" />
                      </div>
                      <h3 className="text-xl font-medium text-white mb-2">Order Cancelled</h3>
                      <p className="text-[#9aa0a6] mb-6">This order has been cancelled.</p>
                      <button onClick={() => setTrackingOrder(null)} className="bg-[#8ab4f8] text-[#202124] px-6 py-3 rounded-md font-medium hover:bg-[#aecbfa] transition-colors">
                        Back to Orders
                      </button>
                    </motion.div>
                  ) : null}
                </motion.div>
              ) : buyerTab === 'orders' && orderState === 'idle' ? (
                <BuyerOrderHistory email={session?.user?.email || ''} onResumeOrder={(order: any) => {
                  if (order.status === 'searching') {
                    setCurrentOrder(order);
                    setOrderState('finding');
                    setBuyerTab('dashboard');
                  } else {
                    // Set tracking order and start polling for updates
                    setTrackingOrder(order);
                    const trackPoll = setInterval(async () => {
                      try {
                        const res = await fetch(`/api/orders?status=accepted,printing,ready,delivered,cancelled&buyer_id=${encodeURIComponent(session?.user?.email || '')}`);
                        const json = await res.json();
                        const updated = json.orders?.find((o: any) => o.id === order.id);
                        if (updated) {
                          setTrackingOrder(updated);
                          if (updated.status === 'delivered' || updated.status === 'cancelled') {
                            clearInterval(trackPoll);
                          }
                        }
                      } catch {}
                    }, 4000);
                  }
                  if (order.total_price) setEstimatedPrice(order.total_price);
                }} />
              ) : orderState === 'upload' ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                   <div className="flex items-center gap-4 mb-6">
                     <button onClick={() => setOrderState('idle')} className="text-[#9aa0a6] hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                       Cancel Request
                     </button>
                     <h2 className="text-xl font-medium text-white">GhostPrint File Manager</h2>
                   </div>
                   
                   <UploadManager onContinue={(files, totalPages, totalCost, deliveryLocation) => {
                     handleOrderSubmit(files, totalPages, totalCost, deliveryLocation);
                   }} />
                </motion.div>
              ) : orderState === 'finding' ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="bg-[#292a2d] border border-[#3c4043] rounded-xl p-10 flex flex-col items-center justify-center text-center"
                >
                  <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                    <div className="absolute inset-0 border-4 border-[#8ab4f8]/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-[#8ab4f8] rounded-full border-t-transparent animate-spin"></div>
                    <Search size={28} className="text-[#8ab4f8]" />
                  </div>
                  
                  <h3 className="text-2xl font-medium text-white mb-2">Searching for a Runner</h3>
                  <p className="text-[#9aa0a6] max-w-sm mx-auto mb-4">Looking for available runners near your campus. This usually takes less than a minute.</p>
                  <p className="text-[#9aa0a6]/70 text-xs italic max-w-sm mx-auto mb-6">It is recommended to keep this page open until a runner accepts your order.</p>

                  <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-4 w-full max-w-sm text-left mb-8">
                    <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-1">Documents</p>
                    <p className="text-white font-medium">{currentOrder?.page_count || 0} Pages • {currentOrder?.file_metadata?.length || 0} Files</p>
                    <p className="text-[#9aa0a6] text-xs mt-2">Deliver to: {currentOrder?.delivery_location || 'Campus'}</p>
                  </div>

                  <button 
                    onClick={cancelOrder}
                    className="flex items-center gap-2 text-[#ea4335] hover:text-[#f28b82] transition-colors font-medium border border-[#ea4335]/30 hover:border-[#f28b82] rounded-full px-6 py-2 bg-[#ea4335]/10"
                  >
                    <X size={16} />
                    Cancel Search
                  </button>
                </motion.div>
              ) : orderState === 'cancelled' ? (
                <motion.div className="bg-[#292a2d] border border-[#ea4335]/50 rounded-xl p-10 flex flex-col items-center justify-center text-center shadow-[0_0_40px_rgba(234,67,53,0.1)]">
                  <div className="w-20 h-20 bg-[#ea4335]/20 rounded-full flex items-center justify-center mb-6 border border-[#ea4335]">
                    <X size={40} className="text-[#ea4335]" />
                  </div>
                  <h3 className="text-2xl font-medium text-white mb-2">Order Cancelled</h3>
                  <p className="text-[#9aa0a6] mb-8 max-w-sm">Your print request was cancelled. You can start a new search or go back to the dashboard.</p>
                  <button onClick={() => setOrderState('upload')} className="bg-[#8ab4f8] text-[#202124] px-6 py-3 rounded-md font-medium hover:bg-[#aecbfa] transition-colors">
                    Search Again
                  </button>
                </motion.div>
              ) : orderState === 'idle' && tabDots.buyerOrders ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#292a2d] border border-[#8ab4f8]/30 rounded-xl p-10 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-16 h-16 bg-[#8ab4f8]/10 rounded-full flex items-center justify-center mb-4 border border-[#8ab4f8]/30">
                    <CheckCircle2 size={32} className="text-[#8ab4f8]" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2">Your Order is Active!</h3>
                  <p className="text-[#9aa0a6] max-w-sm mx-auto mb-6">To track your order progress or manage cancellations, click the <strong className="text-[#8ab4f8]">Orders</strong> tab above.</p>
                  <button 
                    onClick={() => { setBuyerTab('orders'); setTabDots(prev => ({ ...prev, buyerOrders: false })); }}
                    className="bg-[#8ab4f8] text-[#202124] px-6 py-3 rounded-md font-medium hover:bg-[#aecbfa] transition-colors flex items-center gap-2"
                  >
                    <Eye size={16} /> Go to Orders
                  </button>
                </motion.div>
              ) : (
                <div className="h-64 bg-[#292a2d] border border-dashed border-[#3c4043] rounded-lg flex items-center justify-center text-[#9aa0a6]">
                  No active orders.
                </div>
              )}
            </motion.div>
          ) : mode === "runner" ? (
            <motion.div 
              key="runner" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* RUNNER SUB-TABS */}
              <div className="flex items-center gap-6 border-b border-[#3c4043] pb-3">
                <button 
                  onClick={() => handleRunnerTabSwitch("dashboard")} 
                  className={`text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${runnerTab === 'dashboard' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => handleRunnerTabSwitch("jobs")} 
                  className={`relative text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${runnerTab === 'jobs' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'}`}
                >
                  Jobs
                  {tabDots.jobs && runnerTab !== 'jobs' && (
                    <span className="absolute -top-1 -right-2 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f28b82] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f28b82]"></span>
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => handleRunnerTabSwitch("orders")} 
                  className={`relative text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${runnerTab === 'orders' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'}`}
                >
                  Orders
                  {tabDots.orders && runnerTab !== 'orders' && (
                    <span className="absolute -top-1 -right-2 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f28b82] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f28b82]"></span>
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => handleRunnerTabSwitch("pricing")} 
                  className={`text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${runnerTab === 'pricing' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'}`}
                >
                  Price Setup
                </button>
                <button 
                  onClick={() => handleRunnerTabSwitch("wallet")} 
                  className={`text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${runnerTab === 'wallet' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'}`}
                >
                  Wallet
                </button>
              </div>

              {/* TAB CONTENT */}
              <div className="pt-4">
                {runnerTab === "dashboard" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <StatCard label="Total Earnings" value={`₹${totalEarnings.toFixed(2)}`} color="text-emerald-400" />
                      <StatCard label="Trust Rating" value={jobsCompleted > 0 ? "5.0/5.0" : "New"} color="text-indigo-400" />
                      <StatCard label="Jobs Completed" value={jobsCompleted.toString()} color="text-cyan-400" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                      <PushNotificationManager />
                      <div className="p-6 bg-[#292a2d] border border-[#3c4043] rounded-3xl flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-white mb-2">Ghost Status</h3>
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          <p className="text-emerald-400 font-medium">Active & Visible</p>
                        </div>
                        <p className="text-xs text-[#9aa0a6] mt-2">You are currently appearing in the Ghost Slot algorithm for nearby buyers.</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {runnerTab === "wallet" && (() => {
                  const netDues = Math.max(0, runnerDues - runnerBonus);
                  const hasDues = netDues > 0;
                  return (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-medium text-white">Runner Wallet</h2>
                      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-xl px-5 py-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                          <Star size={18} className="text-[#202124]" />
                        </div>
                        <div>
                          <p className="text-[10px] text-amber-400/70 uppercase tracking-wider font-medium">Bonus Credits</p>
                          <p className="text-xl font-bold text-amber-400">{'\u20B9'}{runnerBonus}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-6 rounded-xl border transition-all flex flex-col justify-between ${
                        hasDues ? 'bg-[#292a2d] border-[#fde293]/50' : 'bg-[#292a2d] border-[#81c995]/50'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-[#9aa0a6] uppercase tracking-wider">Net Dues</p>
                              <div className="relative group/tooltip cursor-help">
                                <Info size={14} className="text-[#5f6368] hover:text-[#9aa0a6] transition-colors" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded bg-[#202124] border border-[#5f6368] text-xs text-[#e8eaed] opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all shadow-md z-50 text-center">
                                  Net Dues = Total Dues - Bonus Credits. When bonus covers your dues, you are all clear!
                                </div>
                              </div>
                            </div>
                            {hasDues
                              ? <span className="bg-[#fde293]/20 text-[#fde293] text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">Dues Pending</span>
                              : <span className="bg-[#81c995]/20 text-[#81c995] text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">All Clear</span>
                            }
                          </div>
                          <p className={`text-4xl font-bold tracking-tight ${hasDues ? 'text-[#fde293]' : 'text-[#81c995]'}`}>
                            {'\u20B9'}{netDues}
                          </p>
                          {!hasDues && (
                            <p className="text-xs text-[#5f6368] mt-2">Your bonus credits cover all platform fees</p>
                          )}
                        </div>
                        <div className="mt-5 bg-[#202124] border border-[#3c4043] rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-[#9aa0a6]">Total Dues (10% fee)</span>
                            <span className="text-[#e8eaed] font-medium">{'\u20B9'}{runnerDues}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#9aa0a6]">Bonus Credits</span>
                            <span className="text-amber-400 font-medium">- {'\u20B9'}{Math.min(runnerBonus, runnerDues)}</span>
                          </div>
                          <div className="border-t border-[#3c4043] pt-2 flex justify-between text-sm">
                            <span className="text-white font-semibold">Amount to Pay</span>
                            <span className={`font-bold ${hasDues ? 'text-[#fde293]' : 'text-[#81c995]'}`}>{'\u20B9'}{netDues}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-[#292a2d] border border-[#3c4043] rounded-xl flex flex-col justify-between hover:border-[#5f6368] transition-colors">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-2">Platform Dues</h3>
                          <p className="text-sm text-[#9aa0a6] leading-relaxed mb-3">
                            GhostPrint charges a <strong className="text-white">10% commission</strong> on orders where your rate exceeds the base price. No fee if you charge base rate ({'\u20B9'}2 B&W / {'\u20B9'}5 Color).
                          </p>
                          <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-3 mb-3 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-[#9aa0a6]">Gross Dues</span>
                              <span className="text-[#e8eaed] font-bold">{'\u20B9'}{runnerDues}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-[#9aa0a6]">Bonus Applied</span>
                              <span className="text-amber-400 font-bold">{'\u20B9'}{Math.min(runnerBonus, runnerDues)}</span>
                            </div>
                            <div className="border-t border-[#3c4043] pt-2 flex justify-between text-sm">
                              <span className="text-[#9aa0a6]">Net Due</span>
                              <span className={`font-bold ${hasDues ? 'text-[#fde293]' : 'text-[#81c995]'}`}>{'\u20B9'}{netDues}</span>
                            </div>
                          </div>
                        </div>
                        {hasDues ? (
                          <button className="w-full mt-3 bg-[#fde293] text-[#202124] font-bold py-3 rounded-xl hover:bg-[#ffe599] transition-colors">
                            Clear Dues {'\u2014'} Pay {'\u20B9'}{netDues}
                          </button>
                        ) : (
                          <div className="mt-3 bg-[#81c995]/10 border border-[#81c995]/30 rounded-lg p-3 text-center">
                            <p className="text-[#81c995] text-sm font-medium">{'\u2705'} No dues {'\u2014'} you are all clear!</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  );
                })()}

                {runnerTab === "jobs" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    {/* Dues Banner */}
                    {Math.max(0, runnerDues - runnerBonus) > 50 && (
                      <div className="bg-[#fde293]/10 border border-[#fde293]/50 rounded-lg p-4 flex items-center gap-3">
                        <ShieldCheck size={20} className="text-[#fde293] shrink-0" />
                        <div className="flex-1">
                          <p className="text-[#fde293] text-sm font-bold">High Platform Dues</p>
                          <p className="text-[#9aa0a6] text-xs">You have {`\u20B9`}{Math.max(0, runnerDues - runnerBonus)} in outstanding dues. Visit the Wallet tab to clear them.</p>
                        </div>
                        <button onClick={() => handleRunnerTabSwitch("wallet")} className="text-xs bg-[#fde293] text-[#202124] px-3 py-1.5 rounded font-medium hover:bg-[#ffe599] transition-colors shrink-0">
                          Go to Wallet
                        </button>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h2 className="text-lg font-medium flex items-center gap-2 text-white">
                        <span className="w-2 h-2 rounded-full bg-[#8ab4f8]" />
                        Active Pickups
                      </h2>
                      {activePickups.length === 0 ? (
                        <div className="p-5 bg-[#292a2d] border border-dashed border-[#3c4043] rounded-lg text-[#9aa0a6] text-sm text-center">
                          No active pickups right now.
                        </div>
                      ) : (
                        activePickups.map((order, idx) => (
                          <div key={order.id}>
                            <RunnerActiveJob 
                              order={order} 
                              onUpdateStatus={updateOrderStatus}
                              onHandshake={(o) => { setCurrentOrder(o); setShowHandshakeModal(true); }}
                              onCancel={(id) => updateOrderStatus(id, 'cancelled')}
                            />
                            {/* Only show chat for the first active pickup to avoid overlapping floating windows */}
                            {idx === 0 && session?.user?.email && (
                              <GhostChat
                                orderId={order.id}
                                currentUserEmail={session.user.email}
                                isRunner={true}
                                orderStatus={order.status}
                              />
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-4 mt-8">
                      <h2 className="text-lg font-medium flex items-center gap-2 text-white">
                        <span className="w-2 h-2 rounded-full bg-[#81c995]" />
                        Available Gigs Nearby
                      </h2>
                      {availableOrders.length === 0 ? (
                        <div className="p-5 bg-[#292a2d] border border-dashed border-[#3c4043] rounded-lg text-[#9aa0a6] text-sm text-center">
                          No gigs matching your location right now.
                        </div>
                      ) : (
                        availableOrders.map((order) => {
                          // Dynamic profit calculation
                          const BASE_BW = 2;
                          const BASE_COLOR = 5;
                          let runnerCharge = 0;
                          let baseCost = 0;
                          let isBaseRate = true;

                          if (order.file_metadata) {
                            for (const file of order.file_metadata) {
                              const runnerRate = file.colorMode === 'color' ? runnerRates.color_rate : runnerRates.bw_rate;
                              const baseRate = file.colorMode === 'color' ? BASE_COLOR : BASE_BW;
                              const copies = file.copies || 1;
                              runnerCharge += file.pages * runnerRate * copies;
                              baseCost += file.pages * baseRate * copies;
                              if (runnerRate > baseRate) isBaseRate = false;
                            }
                          }
                          // No platform fee at base rate; 10% of baseCost otherwise
                          const platformFee = isBaseRate ? 0 : Math.round(baseCost * 0.10);
                          const netProfit = runnerCharge - baseCost - platformFee;

                          return (
                          <div key={order.id} className="p-5 bg-[#292a2d] border border-[#3c4043] rounded-lg flex flex-col hover:border-[#5f6368] transition-colors group">
                             <div className="flex justify-between items-start">
                               <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="border border-[#3c4043] bg-[#202124] text-[#81c995] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">GIG</span>
                                    <span className="border border-[#3c4043] bg-[#202124] text-[#9aa0a6] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">{order.page_count} Pages</span>
                                  </div>
                                  <h3 className="font-medium text-[#e8eaed] text-base">{order.file_metadata?.[0]?.name || "Print Request"} {order.file_metadata?.length > 1 && `(+${order.file_metadata.length - 1} more)`}</h3>
                                  <p className="text-sm text-[#9aa0a6] mt-1">{order.delivery_location || "Anywhere on Campus"}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-1">You Earn</p>
                                  <p className={`text-xl font-bold ${netProfit > 0 ? 'text-[#81c995]' : 'text-[#fde293]'}`}>₹{netProfit}</p>
                                  <p className="text-[10px] text-[#9aa0a6]">₹{runnerCharge} - ₹{baseCost} cost{platformFee > 0 ? ` - ₹${platformFee} fee` : ' • 0 fee'}</p>
                               </div>
                             </div>

                             {/* Document Preview */}
                             <div className="w-full mt-3 space-y-1 border-t border-[#3c4043] pt-3">
                               {order.file_metadata?.map((file: any, i: number) => (
                                 <div key={i} className="flex justify-between items-center text-xs">
                                   <span className="text-[#e8eaed]">{file.name}</span>
                                   <span className="text-[#9aa0a6]">{file.pages}pg • {file.colorMode === 'bw' ? 'B&W' : 'Color'} • ×{file.copies || 1}</span>
                                 </div>
                               ))}
                             </div>
                             
                             <div className="w-full mt-4 flex items-center gap-3">
                               <button 
                                 onClick={() => setAvailableOrders(prev => prev.filter(o => o.id !== order.id))}
                                 className="flex-1 flex items-center justify-center gap-2 border border-[#ea4335]/50 hover:bg-[#ea4335]/10 text-[#ea4335] transition-colors rounded py-2 text-sm font-medium"
                               >
                                 <X size={16} /> Ignore
                               </button>
                               {Math.max(0, runnerDues - runnerBonus) > 100 ? (
                                  <button 
                                    disabled
                                    className="flex-[2] flex items-center justify-center gap-2 bg-[#3c4043] text-[#5f6368] rounded py-2 text-sm font-bold cursor-not-allowed"
                                    title="Clear dues to accept jobs"
                                  >
                                    🔒 Account Restricted
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => claimJob(order.id)} 
                                    className="flex-[2] flex items-center justify-center gap-2 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] transition-colors rounded py-2 text-sm font-bold shadow-lg"
                                  >
                                    <Check size={16} /> Accept — Earn ₹{netProfit}
                                  </button>
                                )}
                             </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}

                {runnerTab === "orders" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <h2 className="text-lg font-medium flex items-center gap-2 text-white">
                      <span className="w-2 h-2 rounded-full bg-[#fde293]" />
                      Order History
                    </h2>
                    {pastOrders.length === 0 ? (
                      <div className="p-8 bg-[#292a2d] border border-dashed border-[#3c4043] rounded-lg text-[#9aa0a6] text-sm text-center">
                        No past orders yet. Accept jobs or place orders to see them here.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pastOrders.map((order) => {
                          const isRunner = order.runner_id === session?.user?.email;
                          const isBuyer = order.buyer_id === session?.user?.email;
                          const role = isRunner && isBuyer ? 'Self' : isRunner ? 'Runner' : 'Buyer';
                          const statusColors: Record<string, string> = {
                            delivered: 'text-[#81c995] border-[#81c995]/30',
                            cancelled: 'text-[#ea4335] border-[#ea4335]/30',
                            accepted: 'text-[#8ab4f8] border-[#8ab4f8]/30',
                            printing: 'text-[#fde293] border-[#fde293]/30',
                            ready: 'text-[#fde293] border-[#fde293]/30',
                            searching: 'text-[#9aa0a6] border-[#9aa0a6]/30',
                          };
                          const date = new Date(order.created_at);
                          const dateStr = `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
                          
                          return (
                            <div key={order.id} className="p-4 bg-[#292a2d] border border-[#3c4043] rounded-lg hover:border-[#5f6368] transition-colors">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-[#202124] ${statusColors[order.status] || 'text-[#9aa0a6] border-[#3c4043]'}`}>
                                    {order.status}
                                  </span>
                                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-[#202124] ${role === 'Runner' ? 'text-[#8ab4f8] border-[#8ab4f8]/30' : role === 'Buyer' ? 'text-[#fde293] border-[#fde293]/30' : 'text-[#9aa0a6] border-[#3c4043]'}`}>
                                    {role}
                                  </span>
                                </div>
                                <p className="text-xs text-[#9aa0a6]">{dateStr}</p>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-medium text-[#e8eaed]">
                                    {order.file_metadata?.[0]?.name || 'Document'} 
                                    {order.file_metadata?.length > 1 && ` (+${order.file_metadata.length - 1} more)`}
                                  </p>
                                  <p className="text-xs text-[#9aa0a6] mt-1">📍 {order.delivery_location || 'Campus'} • {order.page_count || '—'} pages</p>
                                </div>
                                <p className="text-lg font-bold text-[#e8eaed]">₹{order.total_price || 0}</p>
                              </div>

                              {/* File links */}
                              {order.file_metadata?.some((f: any) => f.url) && (
                                <div className="mt-3 pt-3 border-t border-[#3c4043] flex flex-wrap gap-2">
                                  {order.file_metadata.filter((f: any) => f.url).map((file: any, i: number) => (
                                    <button 
                                      key={i}
                                      onClick={() => window.open(file.url, '_blank')} 
                                      className="text-xs text-[#8ab4f8] hover:text-[#aecbfa] flex items-center gap-1 bg-[#202124] px-2 py-1 rounded border border-[#3c4043]"
                                    >
                                      <Eye size={12} /> {file.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {runnerTab === "pricing" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <RateCard />
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : mode === "profile" ? (
            <motion.div 
              key="profile" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <RunnerSetup />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  const materialColor = color.includes("emerald") ? "text-[#81c995]" : color.includes("indigo") ? "text-[#8ab4f8]" : color.includes("cyan") ? "text-[#4fc3f7]" : color;
  
  return (
    <div className="p-5 bg-[#292a2d] border border-[#3c4043] rounded-lg hover:border-[#5f6368] transition-colors">
      <p className="text-xs text-[#9aa0a6] uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-medium ${materialColor}`}>{value}</p>
    </div>
  );
}

// Buyer Order History — shows all orders placed by buyer
function BuyerOrderHistory({ email, onResumeOrder }: { email: string; onResumeOrder?: (order: any) => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/orders?buyer_id=${encodeURIComponent(email)}`);
        const json = await res.json();
        const sorted = (json.orders || []).sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setOrders(sorted);
      } catch (err) {
        console.error('Failed to fetch buyer orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [email]);

  if (loading) {
    return (
      <div className="h-64 bg-[#292a2d] border border-dashed border-[#3c4043] rounded-lg flex items-center justify-center text-[#9aa0a6]">
        Loading orders...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="h-64 bg-[#292a2d] border border-dashed border-[#3c4043] rounded-lg flex items-center justify-center text-[#9aa0a6]">
        No past orders. Place a print request to get started!
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    delivered: 'text-[#81c995] border-[#81c995]/30',
    cancelled: 'text-[#ea4335] border-[#ea4335]/30',
    accepted: 'text-[#8ab4f8] border-[#8ab4f8]/30',
    printing: 'text-[#fde293] border-[#fde293]/30',
    ready: 'text-[#fde293] border-[#fde293]/30',
    searching: 'text-[#9aa0a6] border-[#9aa0a6]/30',
  };

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const date = new Date(order.created_at);
        const dateStr = `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        
        return (
          <div key={order.id} className="p-4 bg-[#292a2d] border border-[#3c4043] rounded-lg hover:border-[#5f6368] transition-colors">
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-[#202124] ${statusColors[order.status] || 'text-[#9aa0a6] border-[#3c4043]'}`}>
                {order.status}
              </span>
              <p className="text-xs text-[#9aa0a6]">{dateStr}</p>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-[#e8eaed]">
                  {order.file_metadata?.[0]?.name || 'Document'} 
                  {order.file_metadata?.length > 1 && ` (+${order.file_metadata.length - 1} more)`}
                </p>
                <p className="text-xs text-[#9aa0a6] mt-1">
                  📍 {order.delivery_location || 'Campus'} • {order.page_count || '—'} pages
                  {order.runner_name ? ` • Runner: ${order.runner_name}` : ''}
                </p>
              </div>
              <p className="text-lg font-bold text-[#e8eaed]">₹{order.total_price || 0}</p>
            </div>

            {order.file_metadata?.some((f: any) => f.url) && (
              <div className="mt-3 pt-3 border-t border-[#3c4043] flex flex-wrap gap-2">
                {order.file_metadata.filter((f: any) => f.url).map((file: any, i: number) => (
                  <button 
                    key={i}
                    onClick={() => window.open(file.url, '_blank')} 
                    className="text-xs text-[#8ab4f8] hover:text-[#aecbfa] flex items-center gap-1 bg-[#202124] px-2 py-1 rounded border border-[#3c4043]"
                  >
                    <Eye size={12} /> {file.name}
                  </button>
                ))}
              </div>
            )}
            {/* Track button for active orders */}
            {['searching', 'accepted', 'printing', 'ready'].includes(order.status) && onResumeOrder && (
              <div className="mt-3 pt-3 border-t border-[#3c4043]">
                <button
                  onClick={() => onResumeOrder(order)}
                  className="w-full text-center text-sm font-medium text-[#8ab4f8] hover:text-[#aecbfa] bg-[#8ab4f8]/10 hover:bg-[#8ab4f8]/20 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Eye size={14} /> Track This Order
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PaymentHandshakeModal({ 
  isOpen, 
  onClose, 
  order,
  onVerify 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  order: any;
  onVerify: () => void;
}) {
  const [otpInput, setOtpInput] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otpInput];
    newOtp[index] = value;
    setOtpInput(newOtp);
    setOtpError('');
    
    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const verifyAndComplete = () => {
    const enteredOtp = otpInput.join('');
    const correctOtp = String(order?.pickup_code || '');
    
    if (enteredOtp.length !== 4) {
      setOtpError('Enter all 4 digits');
      return;
    }
    
    if (enteredOtp !== correctOtp) {
      setOtpError('Wrong OTP. Ask buyer for the correct code.');
      setOtpInput(['', '', '', '']);
      inputRefs[0].current?.focus();
      return;
    }

    setIsCompleted(true);
    onVerify();
    setTimeout(() => {
      onClose();
      setIsCompleted(false);
      setOtpInput(['', '', '', '']);
      setOtpError('');
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 10 }} 
          animate={{ scale: 1, y: 0 }}
          className="bg-[#292a2d] text-[#e8eaed] w-full max-w-md rounded-lg p-6 flex flex-col relative overflow-hidden border border-[#3c4043] shadow-2xl"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-[#9aa0a6] hover:text-white transition-colors">
            <X size={20} />
          </button>

          {!isCompleted ? (
            <>
              <p className="text-xs font-medium uppercase tracking-widest text-[#9aa0a6] mb-1">Collect Cash or UPI</p>
              <h2 className="text-5xl font-medium mb-6">₹{order?.total_price || 0}</h2>

              {/* OTP Verification Section */}
              <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-5 mb-5">
                <p className="text-xs uppercase tracking-wider text-[#9aa0a6] mb-1">Verify Buyer OTP</p>
                <p className="text-xs text-[#5f6368] mb-4">Ask the buyer for their 4-digit pickup code</p>
                
                <div className="flex justify-center gap-3 mb-3">
                  {otpInput.map((digit, i) => (
                    <input
                      key={i}
                      ref={inputRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className={`w-14 h-14 text-center text-2xl font-mono tracking-widest rounded-lg border-2 bg-[#292a2d] outline-none transition-colors ${
                        otpError 
                          ? 'border-[#ea4335] text-[#ea4335]' 
                          : digit 
                            ? 'border-[#8ab4f8] text-[#8ab4f8]' 
                            : 'border-[#5f6368] text-white focus:border-[#8ab4f8]'
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[#ea4335] text-xs text-center font-medium"
                  >
                    ❌ {otpError}
                  </motion.p>
                )}
              </div>

              <button 
                onClick={verifyAndComplete}
                disabled={otpInput.join('').length < 4}
                className={`w-full font-bold text-base py-3.5 rounded-lg transition-colors shadow-lg ${
                  otpInput.join('').length === 4
                    ? 'bg-[#81c995] text-[#202124] hover:bg-[#92dab6] cursor-pointer'
                    : 'bg-[#3c4043] text-[#5f6368] cursor-not-allowed'
                }`}
              >
                ✅ Verify OTP & Confirm Cash Received
              </button>
            </>
          ) : (
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3 text-[#81c995] font-medium py-6">
              <CheckCircle2 size={48} className="animate-pulse" />
              <p className="text-xl mt-2 tracking-tight">Job Complete! 🎉</p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function GhostCreditWidget({ balance = -20 }: { balance?: number }) {
  const maxLimit = -50;
  const usedAmount = Math.max(0, -balance);
  const percentage = Math.min(100, Math.round((usedAmount / Math.abs(maxLimit)) * 100));
  const isDues = balance <= 0;

  return (
    <div className={`p-5 rounded-lg border transition-all flex flex-col justify-between ${
      isDues 
        ? "bg-[#292a2d] border-[#fde293]/50" 
        : "bg-[#292a2d] border-[#3c4043] hover:border-[#5f6368]"
    }`}>
      <div className="relative w-full">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-[#9aa0a6] uppercase tracking-wider">Ghost Credit</p>
            <div className="relative group/tooltip cursor-help">
              <Info size={14} className="text-[#5f6368] hover:text-[#9aa0a6] transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded bg-[#202124] border border-[#5f6368] text-xs text-[#e8eaed] opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all shadow-md z-50 text-center">
                Ghost Credits allow you to take jobs. You only pay back after you earn cash.
              </div>
            </div>
          </div>
          {isDues && <span className="border border-[#fde293]/50 text-[#fde293] text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">Dues</span>}
        </div>
        
        <p className={`text-2xl font-medium tracking-tight ${isDues ? "text-[#fde293]" : "text-[#81c995]"}`}>
          ₹{Math.abs(balance)}
        </p>

        {isDues && (
          <div className="mt-4 w-full">
            <div className="h-1 w-full bg-[#202124] rounded-none overflow-hidden border border-[#3c4043]">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-[#fde293]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Buyer Accepted View — shown when a runner accepts the order
function BuyerAcceptedView({ order, onCancel }: { order: any; onCancel: () => void }) {
  // Calculate remaining free-cancel time from the actual accepted_at timestamp
  const getRemaining = () => {
    if (!order?.accepted_at) return 0; // No timestamp = timer expired
    const elapsed = Math.floor((Date.now() - new Date(order.accepted_at).getTime()) / 1000);
    return Math.max(0, 45 - elapsed);
  };

  const [cancelTimer, setCancelTimer] = useState(getRemaining);
  const [canCancelFree, setCanCancelFree] = useState(getRemaining() > 0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);

  useEffect(() => {
    const remaining = getRemaining();
    if (remaining <= 0) {
      setCanCancelFree(false);
      setCancelTimer(0);
      return;
    }
    setCancelTimer(remaining);
    setCanCancelFree(true);

    const interval = setInterval(() => {
      const r = getRemaining();
      setCancelTimer(r);
      if (r <= 0) {
        setCanCancelFree(false);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [order?.accepted_at]);

  const runnerName = order?.runner_name || order?.runner_id?.split('@')[0] || 'Runner';
  const totalPrice = order?.total_price || 0;

  const handleLateCancel = () => {
    setShowStrikeWarning(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#292a2d] border border-[#81c995] rounded-xl p-8 text-left shadow-[0_0_40px_rgba(129,201,149,0.1)] relative"
    >
      {/* Late cancel X button (always visible after timer) */}
      {!canCancelFree && (
        <button 
          onClick={handleLateCancel}
          className="absolute top-4 right-4 text-[#9aa0a6] hover:text-[#ea4335] transition-colors"
          title="Cancel order (with strike)"
        >
          <X size={20} />
        </button>
      )}

      {/* Strike Warning Modal */}
      {showStrikeWarning && (
        <div className="absolute inset-0 bg-black/70 rounded-xl flex items-center justify-center z-10 p-6">
          <div className="bg-[#292a2d] border border-[#ea4335]/50 rounded-lg p-6 text-center max-w-sm">
            <div className="w-12 h-12 bg-[#ea4335]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={24} className="text-[#ea4335]" />
            </div>
            <h4 className="text-white font-bold text-lg mb-2">⚠️ Account Strike Warning</h4>
            <p className="text-[#9aa0a6] text-sm mb-4">
              Cancelling after the free window will add a <strong className="text-[#ea4335]">strike</strong> to your account. 
              Repeated strikes may result in a <strong className="text-[#ea4335]">permanent ban</strong>.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowStrikeWarning(false)}
                className="flex-1 border border-[#5f6368] text-[#e8eaed] py-2 rounded-md text-sm font-medium hover:bg-[#3c4043] transition-colors"
              >
                Keep Order
              </button>
              <button 
                onClick={() => { setShowStrikeWarning(false); onCancel(); }}
                className="flex-1 bg-[#ea4335] text-white py-2 rounded-md text-sm font-bold hover:bg-[#d93025] transition-colors"
              >
                Cancel Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-[#81c995]/20 rounded-full flex items-center justify-center border border-[#81c995]">
          <CheckCircle2 size={28} className="text-[#81c995]" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-medium text-white">Order Accepted by {runnerName}</h3>
          <p className="text-[#9aa0a6] text-sm">Your runner is preparing to print your documents.</p>
        </div>
      </div>

      {/* Payment Amount — Large & Prominent */}
      <div className="bg-[#202124] border border-[#fde293]/30 rounded-xl p-6 mb-5">
        <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-2">Total Amount to Pay</p>
        <p className="text-5xl font-bold text-[#fde293] mb-4">₹{totalPrice}</p>
        
        {/* Payment Options */}
        <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-3">Payment Method</p>
        <div className="space-y-2">
          {/* On Delivery — active */}
          <div className="flex items-center gap-3 bg-[#292a2d] border border-[#81c995]/50 rounded-lg p-3.5 cursor-default">
            <div className="w-5 h-5 rounded-full border-2 border-[#81c995] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#81c995]" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">💵 Pay on Delivery</p>
              <p className="text-[#9aa0a6] text-xs">Cash or UPI when your runner delivers</p>
            </div>
            <span className="bg-[#81c995]/20 text-[#81c995] text-[10px] uppercase font-bold px-2 py-0.5 rounded">Active</span>
          </div>

          {/* Prepaid — coming soon */}
          <div className="flex items-center gap-3 bg-[#292a2d] border border-[#3c4043] rounded-lg p-3.5 opacity-50 cursor-not-allowed">
            <div className="w-5 h-5 rounded-full border-2 border-[#5f6368]" />
            <div className="flex-1">
              <p className="text-[#9aa0a6] text-sm font-medium">💳 Prepaid (Online)</p>
              <p className="text-[#5f6368] text-xs">Pay online before delivery</p>
            </div>
            <span className="bg-[#3c4043] text-[#9aa0a6] text-[10px] uppercase font-bold px-2 py-0.5 rounded">Soon</span>
          </div>
        </div>
        <p className="text-[#9aa0a6]/60 text-[11px] mt-3 italic text-center">🔒 Prepaid deliveries will be made available soon.</p>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-4">
          <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-1">Runner</p>
          <p className="text-white font-medium text-sm">{runnerName}</p>
        </div>
        <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-4">
          <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-1">Delivery Location</p>
          <p className="text-white font-medium text-sm">{order?.delivery_location || 'Campus'}</p>
        </div>
      </div>

      {/* Document Stack */}
      <div className="mb-6">
        <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-3">Document Stack</p>
        <div className="space-y-2">
          {order?.file_metadata?.map((file: any, i: number) => (
            <div key={i} className="flex justify-between items-center bg-[#202124] p-3 rounded border border-[#3c4043]">
              <div>
                <p className="text-sm font-medium text-[#e8eaed]">{file.name}</p>
                <p className="text-xs text-[#9aa0a6]">{file.pages} pages • {file.colorMode === 'bw' ? 'B&W' : 'Color'} • {file.copies || 1} Copies</p>
              </div>
              {file.url && (
                <button onClick={() => window.open(file.url, '_blank')} className="text-[#8ab4f8] hover:text-[#aecbfa] text-sm font-medium flex items-center gap-1">
                  <Eye size={14} /> View
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Buyer Confirm Delivery — Defense against Runner Runaway */}
      {!canCancelFree && (
        <div className="mb-4">
          <p className="text-[#9aa0a6] text-xs mb-2 text-center">Already received your printout?</p>
          <button
            onClick={async () => {
              if (!confirm("Confirm you received your printout? This will close the order and cannot be undone.")) return;
              try {
                const res = await fetch("/api/orders/confirm-delivery", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ order_id: order.id }),
                });
                if (res.ok) {
                  alert("✅ Delivery confirmed! Order closed.");
                  window.location.reload();
                } else {
                  const err = await res.json();
                  alert(`Error: ${err.error}`);
                }
              } catch (e) {
                alert("Failed to confirm delivery. Please try again.");
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#81c995] hover:bg-[#6ab882] text-[#202124] font-bold py-3 rounded-lg transition-colors text-sm"
          >
            <CheckCircle2 size={18} /> I Received My Printout
          </button>
        </div>
      )}

      {/* Cancel Button with Timer */}
      {canCancelFree && (
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-2 w-full text-[#ea4335] hover:bg-[#ea4335]/10 transition-colors font-medium border border-[#ea4335]/30 rounded-lg py-3"
        >
          <X size={16} />
          Cancel Order ({cancelTimer}s)
        </button>
      )}
    </motion.div>
  );
}

// Runner Active Job — accepted job with cancel timer, document stack, and status controls
function RunnerActiveJob({ order, onUpdateStatus, onHandshake, onCancel }: { 
  order: any; 
  onUpdateStatus: (id: string, status: string) => void; 
  onHandshake: (order: any) => void;
  onCancel: (id: string) => void;
}) {
  // Calculate remaining free-cancel time from the actual accepted_at timestamp
  const getRemaining = () => {
    if (order.status !== 'accepted') return 0;
    if (!order?.accepted_at) return 0;
    const elapsed = Math.floor((Date.now() - new Date(order.accepted_at).getTime()) / 1000);
    return Math.max(0, 45 - elapsed);
  };

  const [cancelTimer, setCancelTimer] = useState(getRemaining);
  const [canCancelFree, setCanCancelFree] = useState(getRemaining() > 0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);

  // 45-second free cancel window (only for freshly accepted jobs)
  useEffect(() => {
    if (order.status !== 'accepted') {
      setCanCancelFree(false);
      setCancelTimer(0);
      return;
    }
    const remaining = getRemaining();
    if (remaining <= 0) {
      setCanCancelFree(false);
      setCancelTimer(0);
      return;
    }
    setCancelTimer(remaining);
    setCanCancelFree(true);

    const interval = setInterval(() => {
      const r = getRemaining();
      setCancelTimer(r);
      if (r <= 0) {
        setCanCancelFree(false);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [order.status, order?.accepted_at]);

  const BASE_BW = 2;
  const BASE_COLOR = 5;
  let runnerCharge = Number(order.total_price) || 0;
  let baseCost = 0;
  let isBaseRate = true;

  if (order.file_metadata) {
    for (const file of order.file_metadata) {
      const baseRate = file.colorMode === 'color' ? BASE_COLOR : BASE_BW;
      const copies = file.copies || 1;
      baseCost += file.pages * baseRate * copies;
    }
  }

  if (runnerCharge > baseCost) isBaseRate = false;
  const platformFee = isBaseRate ? 0 : Math.round(baseCost * 0.10);
  const netProfit = runnerCharge - baseCost - platformFee;

  return (
    <div className="p-5 bg-[#292a2d] border border-[#3c4043] rounded-lg flex flex-col hover:border-[#5f6368] transition-colors relative">
      {/* Late cancel X button (visible after 45s timer or during printing/ready) */}
      {!canCancelFree && (
        <button 
          onClick={() => setShowStrikeWarning(true)}
          className="absolute top-4 right-4 text-[#9aa0a6] hover:text-[#ea4335] transition-colors"
          title="Cancel job (with strike)"
        >
          <X size={18} />
        </button>
      )}

      {/* Strike Warning Overlay */}
      {showStrikeWarning && (
        <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center z-10 p-4">
          <div className="bg-[#292a2d] border border-[#ea4335]/50 rounded-lg p-5 text-center max-w-xs">
            <div className="w-12 h-12 bg-[#ea4335]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={24} className="text-[#ea4335]" />
            </div>
            <h4 className="text-white font-bold text-base mb-2">⚠️ Account Strike Warning</h4>
            <p className="text-[#9aa0a6] text-xs mb-4">
              Cancelling after the free window adds a <strong className="text-[#ea4335]">strike</strong> to your account. 
              Repeated strikes may cause a <strong className="text-[#ea4335]">permanent ban</strong>.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowStrikeWarning(false)}
                className="flex-1 border border-[#5f6368] text-[#e8eaed] py-2 rounded text-xs font-medium hover:bg-[#3c4043] transition-colors"
              >
                Keep Job
              </button>
              <button 
                onClick={() => { setShowStrikeWarning(false); onCancel(order.id); }}
                className="flex-1 bg-[#ea4335] text-white py-2 rounded text-xs font-bold hover:bg-[#d93025] transition-colors"
              >
                Drop Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="border border-[#3c4043] bg-[#202124] text-[#81c995] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
              {order.status === 'accepted' ? 'ACCEPTED' : order.status === 'printing' ? 'PRINTING' : 'READY'}
            </span>
            <span className="border border-[#3c4043] bg-[#202124] text-[#9aa0a6] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">{order.page_count} Pages</span>
          </div>
          <h3 className="font-medium text-[#e8eaed] text-base">{order.file_metadata?.[0]?.name || "Document"} {order.file_metadata?.length > 1 && `(+${order.file_metadata.length - 1} more)`}</h3>
          <p className="text-sm text-[#9aa0a6] mt-1">📍 {order.delivery_location || "Unknown Location"}</p>
        </div>
        <div className="text-right">
          <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-1">You Earn</p>
          <p className={`text-xl font-bold ${netProfit > 0 ? 'text-[#81c995]' : 'text-[#fde293]'}`}>₹{netProfit}</p>
          <p className="text-[10px] text-[#9aa0a6]">₹{runnerCharge} - ₹{baseCost} cost{platformFee > 0 ? ` - ₹${platformFee} fee` : ''}</p>
        </div>
      </div>

      {/* Document Stack */}
      <div className="w-full mt-4 space-y-2 border-t border-[#3c4043] pt-4">
        <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-2">Documents to Print</p>
        {order.file_metadata?.map((file: any, i: number) => (
          <div key={i} className="flex justify-between items-center text-sm bg-[#202124] p-3 rounded border border-[#3c4043]">
            <div>
              <p className="text-[#e8eaed] font-medium">{file.name}</p>
              <p className="text-xs text-[#9aa0a6]">{file.pages} pages • {file.colorMode === 'bw' ? 'B&W' : 'Color'} • {file.copies || 1} Copies</p>
            </div>
            {file.url && (
              <button onClick={() => window.open(file.url, '_blank')} className="text-[#8ab4f8] hover:text-[#aecbfa] flex items-center gap-1 text-xs font-medium">
                <Eye size={14} /> View PDF
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Status Actions */}
      <div className="w-full mt-4 space-y-2">
        {order.status === 'accepted' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'printing')}
            className="bg-[#8ab4f8] text-[#202124] w-full py-2.5 rounded-md font-medium text-sm hover:bg-[#aecbfa] transition-colors"
          >
            🖨️ Start Printing
          </button>
        )}
        {order.status === 'printing' && (
          <button
            onClick={() => onUpdateStatus(order.id, 'ready')}
            className="bg-[#fde293] text-[#202124] w-full py-2.5 rounded-md font-medium text-sm hover:bg-[#ffe599] transition-colors"
          >
            ✅ Mark as Print Ready
          </button>
        )}
        {order.status === 'ready' && (
          <button
            onClick={() => onHandshake(order)}
            className="bg-[#81c995] text-[#202124] w-full py-2.5 rounded-md font-bold text-sm hover:bg-[#92dab6] transition-colors shadow-lg"
          >
            🤝 Complete Handshake — Collect ₹{runnerCharge}
          </button>
        )}

        {/* Free cancel during 45s window */}
        {canCancelFree && order.status === 'accepted' && (
          <button
            onClick={() => onCancel(order.id)}
            className="flex items-center justify-center gap-2 w-full text-[#ea4335] hover:bg-[#ea4335]/10 transition-colors font-medium border border-[#ea4335]/30 rounded-md py-2 text-sm"
          >
            <X size={14} />
            Cancel Job ({cancelTimer}s)
          </button>
        )}
      </div>
    </div>
  );
}
