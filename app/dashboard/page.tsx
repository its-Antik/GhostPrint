"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { User, ShoppingBag, Truck, BarChart3, Settings, CheckCircle2, ShieldCheck, Info, Search, MapPin, Zap, Star, Eye, X, Check, AlertTriangle, Flag, Download, FileText, ChevronDown, ChevronUp } from "lucide-react";
import Onboarding from "@/components/Onboarding";
import RunnerSetup from "@/components/RunnerSetup";
import RateCard from "@/components/RateCard";
import UploadManager from "@/components/UploadManager";
import DebtDashboard from "@/components/DebtDashboard";
import PushNotificationManager from "@/components/PushNotificationManager";
import PagenChat from "@/components/PagenChat";
import PagenPingProvider from "@/components/PagenPing";
import NotificationBell from "@/components/NotificationBell";
import { supabase } from "@/lib/supabase";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import { useSmartRealtime } from "@/hooks/useSmartRealtime";
import { useNotifications } from "@/hooks/useNotifications";
import { showPagenPing } from "@/components/PagenPing";
import { generateShortId, downloadInvoice, type InvoiceData } from "@/lib/invoice";

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
  const [strikeCount, setStrikeCount] = useState(0);
  const [accountDisabled, setAccountDisabled] = useState(false);
  const [userAvgRating, setUserAvgRating] = useState(0);
  const [userTotalRatings, setUserTotalRatings] = useState(0);
  const [netDuesForRunner, setNetDuesForRunner] = useState(0);
  const [runnersOnline, setRunnersOnline] = useState<number | null>(null);
  const router = useRouter();

  // Poll live runners count every 5 seconds when in buyer mode
  useEffect(() => {
    if (mode !== 'buyer' || !session?.user?.email) {
      setRunnersOnline(null);
      return;
    }

    const fetchRunners = async () => {
      try {
        const res = await fetch('/api/runners-online');
        if (res.ok) {
          const data = await res.json();
          setRunnersOnline(data.count ?? 0);
        }
      } catch {
        // Silent fail
      }
    };

    fetchRunners();
    const interval = setInterval(fetchRunners, 5_000);
    return () => clearInterval(interval);
  }, [mode, session?.user?.email]);

  // Fetch profile data on mount (strikes, rating, dues)
  useEffect(() => {
    if (!session?.user?.email) return;
    const fetchProfileData = async () => {
      try {
        const [profileRes, strikeRes, ratingRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/strikes'),
          fetch(`/api/ratings?user_email=${encodeURIComponent(session.user!.email!)}`),
        ]);
        const profileJson = await profileRes.json();
        const strikeJson = await strikeRes.json();
        const ratingJson = await ratingRes.json();

        if (profileJson.profile) {
          const dues = Number(profileJson.profile.dues) || 0;
          const bonus = Number(profileJson.profile.bonus) || 25;
          const netDues = Math.max(0, dues - bonus);
          setNetDuesForRunner(netDues);
          
          const isDisabled = strikeJson.account_disabled || netDues > 50;
          setAccountDisabled(isDisabled);
          if (isDisabled) {
            setMode('profile');
          }
        }
        setStrikeCount(strikeJson.strike_count || 0);
        setUserAvgRating(ratingJson.avg_rating || 0);
        setUserTotalRatings(ratingJson.total_ratings || 0);
      } catch (err) {
        console.error('Failed to fetch profile data:', err);
      }
    };
    fetchProfileData();
  }, [session?.user?.email]);

  // ===== PRESENCE HEARTBEAT =====
  // Sends a lightweight POST /api/heartbeat every 15 seconds to stamp last_seen_at
  // This powers the real-time "runners online" count for buyers
  useEffect(() => {
    if (!session?.user?.email) return;

    const sendHeartbeat = () => {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    };

    // Fire immediately on mount
    sendHeartbeat();

    // Then every 15 seconds
    const interval = setInterval(sendHeartbeat, 15_000);

    // Pause when tab is hidden, resume + immediate beat when visible
    const handleVisibility = () => {
      if (!document.hidden) sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session?.user?.email]);

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
      if (latestNotif?.title?.includes('Pagen Gig')) {
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
  // MULTI-TENANT: Only fires for orders from the user's own campus
  const userDomain = session?.user?.email?.split('@')[1]?.toLowerCase() || '';

  useEffect(() => {
    if (!session?.user?.email) return;

    const channel = supabase
      .channel('order_dot_watcher')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload: any) => {
          const newOrder = payload.new;
          // TENANT CHECK: Only react to orders from the same campus
          if (newOrder.college_domain && newOrder.college_domain !== userDomain) return;
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
  }, [session?.user?.email, mode, runnerTab, userDomain]);

  // Wrap setMode to clear dots when switching tabs
  const handleModeSwitch = useCallback((newMode: "buyer" | "runner" | "profile") => {
    // Enforce account block
    if (newMode !== 'profile' && (accountDisabled || netDuesForRunner > 50)) {
      alert("Please go to profile and settle your account to continue.");
      return;
    }

    setMode(newMode);
    if (newMode === 'runner') setTabDots(prev => ({ ...prev, runner: false }));
    if (newMode === 'buyer') setTabDots(prev => ({ ...prev, buyer: false }));
  }, [accountDisabled, netDuesForRunner]);

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
      // SELF-EXCLUSION (defense-in-depth): filter out own orders so buyer can't claim as runner
      if (searchingJson.orders) {
        const filtered = searchingJson.orders.filter((o: any) => o.buyer_id !== session.user!.email);
        setAvailableOrders(filtered);
      }

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
  // MULTI-TENANT: Uses domain-scoped channel name for isolation
  useSmartRealtime(`runner_orders_${userDomain}`, {
    table: 'orders',
    event: '*',
    filter: userDomain ? `college_domain=eq.${userDomain}` : undefined,
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

    if (accountDisabled) {
      alert("Your account is disabled due to strikes. Please pay the strike fine in your Profile to reactivate.");
      return;
    }

    if (netDuesForRunner >= 50) {
      alert(`You have ₹${netDuesForRunner} in net dues. Please clear your dues in the Wallet section before accepting jobs.`);
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
      // Re-fetch current order status to prevent cancelling an already-accepted order
      try {
        const checkRes = await fetch(`/api/orders?status=searching,accepted,printing,ready,delivered,cancelled&buyer_id=${encodeURIComponent(session?.user?.email || '')}`);
        const checkJson = await checkRes.json();
        const freshOrder = checkJson.orders?.find((o: any) => o.id === currentOrder.id);
        if (freshOrder && freshOrder.status !== 'searching') {
          // Order was already accepted — update UI immediately instead of cancelling
          setCurrentOrder(freshOrder);
          if (freshOrder.total_price) setEstimatedPrice(freshOrder.total_price);
          setOrderState('idle');
          setBuyerTab('dashboard');
          setTabDots(prev => ({ ...prev, buyerOrders: true }));
          showPagenPing(
            "🎉 Runner Found!",
            "A runner has already accepted your order. Check the Orders tab.",
            "info"
          );
          return;
        }
      } catch (e) {
        // If check fails, proceed with cancel attempt
      }
      await updateOrderStatus(currentOrder.id, 'cancelled');
    }
    setOrderState('cancelled');
  };

  // SAFETY MODE: Warn buyer to stay on tab during search (but don't auto-cancel)
  const orderStateRef = useRef(orderState);
  orderStateRef.current = orderState;

  useEffect(() => {
    if (orderState !== 'finding') return;

    // Show recommendation toast when search starts
    showPagenPing(
      "🔒 Safety Mode Active",
      "It's recommended to stay on this tab while we search for a runner.",
      "info"
    );

    // Warn before closing/refreshing
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (orderStateRef.current === 'finding') {
        e.preventDefault();
        e.returnValue = "Your order search is active. Leaving may interrupt it.";
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [orderState]);

  const handleOrderSubmit = async (files: any[], totalPages: number, totalCost: number, deliveryLocation: string, printSpecs?: { sides: string; finishing: string; additionalRequests: string }) => {
    try {
      if (status !== "authenticated" || !session?.user) {
        router.push("/auth/signin");
        return;
      }

      // Pre-validate file sizes before starting (50MB Telegram limit)
      const MAX_FILE_SIZE = 50 * 1024 * 1024;
      const oversized = files.filter(f => f.file.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        alert(`These files are too large (max 50MB):\n${oversized.map(f => `• ${f.name} (${(f.file.size / 1024 / 1024).toFixed(1)}MB)`).join('\n')}\n\nPlease remove them and try again.`);
        return;
      }

      setEstimatedPrice(totalCost);
      setOrderState('finding');

      // 1. Upload files to Telegram via bot for unlimited storage
      const fileMetadata = [];
      let uploadFailed = false;

      for (const f of files) {
        const formData = new FormData();
        formData.append("file", f.file);

        // Helper: upload with timeout and single retry
        const attemptUpload = async (attempt: number): Promise<any> => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 150_000); // 2.5 min timeout

          try {
            const response = await fetch("/api/telegram-upload", {
              method: "POST",
              body: formData,
              signal: controller.signal,
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({ error: "Upload failed" }));
              throw new Error(errData.error || `Upload failed (HTTP ${response.status})`);
            }

            return await response.json();
          } catch (err: any) {
            if (err.name === "AbortError") {
              throw new Error("Upload timed out — your connection may be slow. Please try again.");
            }
            // Retry once on transient network errors
            if (attempt < 1 && (err.message === "fetch failed" || err.message === "Failed to fetch")) {
              console.warn(`Upload attempt ${attempt + 1} failed for ${f.name}, retrying...`);
              return attemptUpload(attempt + 1);
            }
            throw err;
          } finally {
            clearTimeout(timeout);
          }
        };

        try {
          const data = await attemptUpload(0);
          fileMetadata.push({
            name: f.name,
            pages: f.pages,
            copies: f.copies || 1,
            url: data.url,           // viewable file URL
            file_id: data.file_id,   // Telegram file_id for re-fetching
            colorMode: f.colorMode
          });
        } catch (uploadErr: any) {
          console.error("Upload error for", f.name, uploadErr);
          uploadFailed = true;
          showPagenPing(
            "⚠️ Upload Failed",
            `"${f.name}" couldn't be uploaded: ${uploadErr.message}. The order will proceed without this file.`,
            "system"
          );
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

      // If ALL files failed to upload, abort the order
      if (fileMetadata.every(f => !f.url)) {
        showPagenPing(
          "❌ Upload Failed",
          "None of the files could be uploaded. Please check your internet connection and try again.",
          "system"
        );
        setOrderState('upload');
        return;
      }

      // 2. Create order via server API route (bypasses RLS)
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_pages: totalPages,
          total_cost: totalCost,
          file_metadata: fileMetadata,
          delivery_location: deliveryLocation,
          print_specs: printSpecs || null,
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
              showPagenPing(
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
      // Polling at 2s for faster buyer-side sync to prevent stale cancel states
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
              showPagenPing(
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
      }, 2000);

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
      <PagenPingProvider />
      <MaintenanceOverlay />
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
              <img src="/Logo.jpg?v=2" alt="Pagen" className="w-full h-full object-cover rounded-md" />
            </div>
            <span className="font-bold tracking-tight">Pagen</span>
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
              handleModeSwitch("runner");
            }}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${mode === 'runner' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-[#9aa0a6] hover:bg-white/5'}`}
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
              handleModeSwitch("profile");
            }}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${mode === 'profile' ? 'bg-[#8ab4f8] text-[#202124]' : 'text-[#9aa0a6] hover:bg-white/5'}`}
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
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[#9aa0a6] text-sm">Need something printed today?</p>
                    {runnersOnline !== null && (
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${runnersOnline > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${runnersOnline > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        </span>
                        <span className={`text-xs font-medium ${runnersOnline > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {runnersOnline > 0 
                            ? <>{runnersOnline} online</>
                            : 'No runners online'
                          }
                        </span>
                      </div>
                    )}
                  </div>
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
                    setBuyerTab("dashboard");
                    setTrackingOrder(null);
                  }} 
                  className={`text-sm font-medium transition-colors pb-3 -mb-[13px] border-b-2 ${buyerTab === 'dashboard' ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#9aa0a6] border-transparent hover:text-white'}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => {
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
                        <PagenChat
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
                          {trackingOrder.status === 'printing' ? 'Your runner is currently printing the files.' : trackingOrder.status === 'ready' ? 'Meet the runner and share your OTP to collect.' : 'Thank you for using Pagen!'}
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
                          <div className="bg-[#fde293]/10 border border-[#fde293]/30 rounded-lg px-4 py-2.5 mb-6 flex items-start gap-2">
                            <Info size={14} className="text-[#fde293] mt-0.5 shrink-0" />
                            <p className="text-[#fde293]/90 text-xs leading-relaxed">
                              <strong>Safety Tip:</strong> It is recommended to share the pickup OTP only after you have received your printouts and verified them.
                            </p>
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

                          {/* Print Specifications */}
                          {trackingOrder.print_specs && (
                            <div className="mt-4">
                              <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-2">Print Specs</p>
                              <div className="flex flex-wrap gap-2 mb-2">
                                <span className="text-xs font-semibold px-2.5 py-1 rounded border border-[#8ab4f8]/30 bg-[#8ab4f8]/10 text-[#8ab4f8]">
                                  {trackingOrder.print_specs.sides === 'double' ? '📄 Double-Sided' : '📄 Single-Sided'}
                                </span>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded border border-[#81c995]/30 bg-[#81c995]/10 text-[#81c995]">
                                  {trackingOrder.print_specs.finishing === 'stapled' ? '📎 Stapled' : '📃 Loose Sheets'}
                                </span>
                              </div>
                              {trackingOrder.print_specs.additionalRequests && (
                                <p className="text-xs text-[#fde293] bg-[#fde293]/10 border border-[#fde293]/20 rounded px-3 py-2">
                                  💬 {trackingOrder.print_specs.additionalRequests}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                      {trackingOrder.status === 'delivered' && session?.user?.email && (
                        <RatingAndReportWidget
                          orderId={trackingOrder.id}
                          currentUserEmail={session.user.email}
                          otherUserEmail={trackingOrder.runner_id}
                          currentUserRole="buyer"
                        />
                      )}
                      {trackingOrder.id && session?.user?.email && trackingOrder.status !== 'delivered' && (
                        <PagenChat
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
                     <h2 className="text-xl font-medium text-white">Pagen File Manager</h2>
                   </div>
                   
                   <UploadManager 
                     runnersOnline={runnersOnline}
                     onContinue={(files, totalPages, totalCost, deliveryLocation, printSpecs) => {
                       handleOrderSubmit(files, totalPages, totalCost, deliveryLocation, printSpecs);
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
                    {currentOrder?.print_specs && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#3c4043]">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#8ab4f8]/30 bg-[#8ab4f8]/10 text-[#8ab4f8]">
                          {currentOrder.print_specs.sides === 'double' ? 'Double-Sided' : 'Single-Sided'}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#81c995]/30 bg-[#81c995]/10 text-[#81c995]">
                          {currentOrder.print_specs.finishing === 'stapled' ? 'Stapled' : 'Loose Sheets'}
                        </span>
                      </div>
                    )}
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
                        <h3 className="text-lg font-bold text-white mb-2">Pagen Status</h3>
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          <p className="text-emerald-400 font-medium">Active & Visible</p>
                        </div>
                        <p className="text-xs text-[#9aa0a6] mt-2">You are currently appearing in the Pagen Slot algorithm for nearby buyers.</p>
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
                            Pagen charges a <strong className="text-white">10% commission</strong> on orders where your rate exceeds the base price. No fee if you charge base rate ({'\u20B9'}2 B&W / {'\u20B9'}5 Color).
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
                          <button 
                            onClick={() => handleModeSwitch("profile")}
                            className="w-full mt-3 bg-[#3c4043] text-white font-bold py-3 rounded-xl hover:bg-[#5f6368] transition-colors border border-[#fde293]/30"
                          >
                            Go to Profile to clear dues
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
                              <PagenChat
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
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm text-[#9aa0a6]">{order.delivery_location || "Anywhere on Campus"}</p>
                                    <InlineRatingBadge email={order.buyer_id} />
                                  </div>
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

                             {/* Print Specifications */}
                             {order.print_specs && (
                               <div className="w-full mt-2 border-t border-[#3c4043] pt-2 space-y-1">
                                 <div className="flex flex-wrap gap-2">
                                   <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#8ab4f8]/30 bg-[#8ab4f8]/10 text-[#8ab4f8]">
                                     {order.print_specs.sides === 'double' ? 'Double-Sided' : 'Single-Sided'}
                                   </span>
                                   <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#81c995]/30 bg-[#81c995]/10 text-[#81c995]">
                                     {order.print_specs.finishing === 'stapled' ? 'Stapled' : 'Loose Sheets'}
                                   </span>
                                 </div>
                                 {order.print_specs.additionalRequests && (
                                   <p className="text-xs text-[#fde293] bg-[#fde293]/10 border border-[#fde293]/20 rounded px-2.5 py-1.5 mt-1">
                                     💬 {order.print_specs.additionalRequests}
                                   </p>
                                 )}
                               </div>
                             )}
                             
                             <div className="w-full mt-4 flex items-center gap-3">
                               <button 
                                 onClick={() => setAvailableOrders(prev => prev.filter(o => o.id !== order.id))}
                                 className="flex-1 flex items-center justify-center gap-2 border border-[#ea4335]/50 hover:bg-[#ea4335]/10 text-[#ea4335] transition-colors rounded py-2 text-sm font-medium"
                               >
                                 <X size={16} /> Ignore
                               </button>
                               {accountDisabled ? (
                                   <button 
                                     disabled
                                     className="flex-[2] flex items-center justify-center gap-2 bg-[#ea4335]/20 text-[#ea4335] rounded py-2 text-sm font-bold cursor-not-allowed border border-[#ea4335]/30"
                                     title="Account disabled — pay strike fine to reactivate"
                                   >
                                     ⛔ Account Disabled
                                   </button>
                                 ) : netDuesForRunner >= 50 ? (
                                   <button 
                                     disabled
                                     className="flex-[2] flex items-center justify-center gap-2 bg-[#3c4043] text-[#5f6368] rounded py-2 text-sm font-bold cursor-not-allowed"
                                     title="Clear dues to accept jobs"
                                   >
                                     🔒 Clear ₹{netDuesForRunner} Dues First
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
                          const shortId = order.short_id || generateShortId(order.id);
                          
                          return (
                            <OrderDetailCard
                              key={order.id}
                              order={order}
                              role={role}
                              statusColors={statusColors}
                              dateStr={dateStr}
                              shortId={shortId}
                              currentUserEmail={session?.user?.email || ''}
                            />
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

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const date = new Date(order.created_at);
        const dateStr = `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        const shortId = order.short_id || generateShortId(order.id);
        const statusColors: Record<string, string> = {
          delivered: 'text-[#81c995] border-[#81c995]/30',
          cancelled: 'text-[#ea4335] border-[#ea4335]/30',
          accepted: 'text-[#8ab4f8] border-[#8ab4f8]/30',
          printing: 'text-[#fde293] border-[#fde293]/30',
          ready: 'text-[#fde293] border-[#fde293]/30',
          searching: 'text-[#9aa0a6] border-[#9aa0a6]/30',
        };
        
        return (
          <OrderDetailCard
            key={order.id}
            order={order}
            role="Buyer"
            statusColors={statusColors}
            dateStr={dateStr}
            shortId={shortId}
            currentUserEmail={email}
            onResumeOrder={onResumeOrder}
          />
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
            <div className="flex flex-col items-center gap-3 py-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3 text-[#81c995] font-medium">
                <CheckCircle2 size={48} className="animate-pulse" />
                <p className="text-xl mt-2 tracking-tight">Job Complete! 🎉</p>
              </motion.div>
              {order?.buyer_id && order?.runner_id && (
                <RatingAndReportWidget
                  orderId={order.id}
                  currentUserEmail={order.runner_id}
                  otherUserEmail={order.buyer_id}
                  currentUserRole="runner"
                />
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function PagenCreditWidget({ balance = -20 }: { balance?: number }) {
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
            <p className="text-xs text-[#9aa0a6] uppercase tracking-wider">Pagen Credit</p>
            <div className="relative group/tooltip cursor-help">
              <Info size={14} className="text-[#5f6368] hover:text-[#9aa0a6] transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded bg-[#202124] border border-[#5f6368] text-xs text-[#e8eaed] opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all shadow-md z-50 text-center">
                Pagen Credits allow you to take jobs. You only pay back after you earn cash.
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
  const [runnerRating, setRunnerRating] = useState<{avg: number, count: number}>({avg: 0, count: 0});

  useEffect(() => {
    if (!order?.runner_id) return;
    fetch(`/api/ratings?user_email=${encodeURIComponent(order.runner_id)}`)
      .then(r => r.json())
      .then(d => setRunnerRating({avg: d.avg_rating || 0, count: d.total_ratings || 0}))
      .catch(() => {});
  }, [order?.runner_id]);

  const handleLateCancel = () => {
    setShowStrikeWarning(true);
  };

  const executeLateCancel = async () => {
    setShowStrikeWarning(false);
    // Record the strike via API
    try {
      await fetch('/api/strikes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_strike' }),
      });
    } catch (e) {
      console.error('Failed to add strike:', e);
    }
    onCancel();
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
                onClick={executeLateCancel}
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
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-medium text-white">Order Accepted by {runnerName}</h3>
            {runnerRating.count > 0 && (
              <span className="flex items-center gap-1 bg-[#fde293]/10 border border-[#fde293]/30 px-2 py-0.5 rounded text-xs">
                <Star size={12} className="text-[#fde293] fill-[#fde293]" />
                <span className="text-[#fde293] font-bold">{runnerRating.avg.toFixed(1)}</span>
                <span className="text-[#9aa0a6]">({runnerRating.count})</span>
              </span>
            )}
          </div>
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

        {/* Print Specifications */}
        {order?.print_specs && (
          <div className="mt-4">
            <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-2">Print Specs</p>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded border border-[#8ab4f8]/30 bg-[#8ab4f8]/10 text-[#8ab4f8]">
                {order.print_specs.sides === 'double' ? '📄 Double-Sided' : '📄 Single-Sided'}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded border border-[#81c995]/30 bg-[#81c995]/10 text-[#81c995]">
                {order.print_specs.finishing === 'stapled' ? '📎 Stapled' : '📃 Loose Sheets'}
              </span>
            </div>
            {order.print_specs.additionalRequests && (
              <p className="text-xs text-[#fde293] bg-[#fde293]/10 border border-[#fde293]/20 rounded px-3 py-2">
                💬 {order.print_specs.additionalRequests}
              </p>
            )}
          </div>
        )}
      </div>

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
                onClick={async () => { 
                  setShowStrikeWarning(false); 
                  try {
                    await fetch('/api/strikes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'add_strike' }),
                    });
                  } catch (e) { console.error('Failed to add strike:', e); }
                  onCancel(order.id); 
                }}
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

      {/* Print Specifications */}
      {order.print_specs && (
        <div className="w-full mt-3 border-t border-[#3c4043] pt-3">
          <p className="text-[#9aa0a6] text-xs uppercase tracking-wider mb-2">Print Specs</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#8ab4f8]/30 bg-[#8ab4f8]/10 text-[#8ab4f8]">
              {order.print_specs.sides === 'double' ? 'Double-Sided' : 'Single-Sided'}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#81c995]/30 bg-[#81c995]/10 text-[#81c995]">
              {order.print_specs.finishing === 'stapled' ? 'Stapled' : 'Loose Sheets'}
            </span>
          </div>
          {order.print_specs.additionalRequests && (
            <p className="text-xs text-[#fde293] bg-[#fde293]/10 border border-[#fde293]/20 rounded px-2.5 py-1.5">
              💬 {order.print_specs.additionalRequests}
            </p>
          )}
        </div>
      )}
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

// Star Rating Input — interactive 5-star picker
function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            size={28}
            className={`transition-colors ${
              (hover || value) >= star
                ? 'text-[#fde293] fill-[#fde293]'
                : 'text-[#5f6368]'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// Rating & Report Widget — shown after delivery for both buyer and runner
function RatingAndReportWidget({ 
  orderId, 
  currentUserEmail, 
  otherUserEmail, 
  currentUserRole 
}: { 
  orderId: string; 
  currentUserEmail: string; 
  otherUserEmail: string;
  currentUserRole: 'buyer' | 'runner';
}) {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  useEffect(() => {
    // Check if already rated
    fetch(`/api/ratings?order_id=${orderId}`)
      .then(r => r.json())
      .then(data => {
        const myRating = data.ratings?.find((r: any) => r.rater_email === currentUserEmail);
        if (myRating) {
          setExistingRating(myRating.stars);
          setRating(myRating.stars);
          setSubmitted(true);
        }
      })
      .catch(() => {});
  }, [orderId, currentUserEmail]);

  const submitRating = async () => {
    if (rating === 0) return;
    setLoading(true);
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          ratee_email: otherUserEmail,
          rater_role: currentUserRole,
          stars: rating,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Rating failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async () => {
    if (!reportText.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          reported_email: otherUserEmail,
          feedback: reportText.trim(),
        }),
      });
      setReportSubmitted(true);
    } catch (err) {
      console.error('Report failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const otherRole = currentUserRole === 'buyer' ? 'Runner' : 'Buyer';
  const otherName = otherUserEmail?.split('@')[0] || otherRole;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#292a2d] border border-[#3c4043] rounded-xl p-6 mt-4"
    >
      {!submitted ? (
        <div className="text-center">
          <h4 className="text-white font-medium text-lg mb-1">Rate {otherName}</h4>
          <p className="text-[#9aa0a6] text-xs mb-4">How was your experience with this {otherRole.toLowerCase()}?</p>
          <div className="flex justify-center mb-4">
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
          <button
            onClick={submitRating}
            disabled={rating === 0 || loading}
            className={`px-8 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              rating > 0
                ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                : 'bg-[#3c4043] text-[#5f6368] cursor-not-allowed'
            }`}
          >
            {loading ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="flex justify-center mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={24}
                className={s <= rating ? 'text-[#fde293] fill-[#fde293]' : 'text-[#5f6368]'}
              />
            ))}
          </div>
          <p className="text-[#81c995] text-sm font-medium">✓ Rating submitted — Thank you!</p>
        </div>
      )}

      {/* Report Section */}
      <div className="mt-4 pt-4 border-t border-[#3c4043]">
        {!showReport && !reportSubmitted ? (
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 text-[#ea4335]/70 hover:text-[#ea4335] text-xs font-medium transition-colors mx-auto"
          >
            <Flag size={12} /> Report {otherName}
          </button>
        ) : reportSubmitted ? (
          <p className="text-[#9aa0a6] text-xs text-center">✓ Report submitted. We'll review it shortly.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-[#9aa0a6] text-xs font-medium">Describe the issue with {otherName}:</p>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Tell us what happened..."
              className="w-full bg-[#202124] border border-[#5f6368] rounded-lg px-4 py-3 text-sm text-white focus:border-[#ea4335] outline-none transition-colors placeholder:text-[#5f6368] resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 border border-[#5f6368] text-[#9aa0a6] py-2 rounded-lg text-xs font-medium hover:bg-[#3c4043] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={!reportText.trim() || loading}
                className="flex-1 bg-[#ea4335] text-white py-2 rounded-lg text-xs font-bold hover:bg-[#d93025] transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Submit Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Inline Rating Badge — small star+number shown in gig cards
function InlineRatingBadge({ email }: { email: string }) {
  const [data, setData] = useState<{ avg: number; count: number } | null>(null);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/ratings?user_email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => {
        if (d.total_ratings > 0) {
          setData({ avg: d.avg_rating, count: d.total_ratings });
        }
      })
      .catch(() => {});
  }, [email]);

  if (!data) return null;

  return (
    <span className="flex items-center gap-1 text-xs">
      <Star size={10} className="text-[#fde293] fill-[#fde293]" />
      <span className="text-[#fde293] font-medium">{data.avg.toFixed(1)}</span>
    </span>
  );
}

// OrderDetailCard — expandable order card with full details and invoice download
function OrderDetailCard({ 
  order, 
  role, 
  statusColors, 
  dateStr, 
  shortId,
  currentUserEmail,
  onResumeOrder,
}: { 
  order: any; 
  role: string; 
  statusColors: Record<string, string>; 
  dateStr: string; 
  shortId: string;
  currentUserEmail: string;
  onResumeOrder?: (order: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const isRunner = order.runner_id === currentUserEmail;
  const isBuyer = order.buyer_id === currentUserEmail;
  const buyerName = order.buyer_id?.split('@')[0] || 'Buyer';
  const runnerName = order.runner_name || order.runner_id?.split('@')[0] || 'Unassigned';

  // Calculate runner earnings
  const BASE_BW = 2;
  const BASE_COLOR = 5;
  let baseCost = 0;
  if (order.file_metadata) {
    for (const file of order.file_metadata) {
      const baseRate = file.colorMode === 'color' ? BASE_COLOR : BASE_BW;
      const copies = file.copies || 1;
      baseCost += (file.pages || 0) * baseRate * copies;
    }
  }
  const totalPrice = Number(order.total_price) || 0;
  const isBaseRate = totalPrice <= baseCost;
  const platformFee = isBaseRate ? 0 : Math.round(baseCost * 0.10);
  const netEarnings = totalPrice - baseCost - platformFee;

  const handleDownloadInvoice = () => {
    const date = new Date(order.created_at);
    const invoiceData: InvoiceData = {
      orderId: order.id,
      shortId: shortId,
      date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: order.status,
      buyerName: buyerName,
      buyerEmail: order.buyer_id || '',
      runnerName: runnerName,
      runnerEmail: order.runner_id || '',
      deliveryLocation: order.delivery_location || 'Campus',
      files: (order.file_metadata || []).map((f: any) => ({
        name: f.name || 'Document',
        pages: f.pages || 0,
        colorMode: f.colorMode || 'bw',
        copies: f.copies || 1,
      })),
      totalPages: order.page_count || 0,
      totalPrice: totalPrice,
      baseCost: baseCost,
      platformFee: platformFee,
      netEarnings: netEarnings,
      viewerRole: isRunner ? 'runner' : 'buyer',
    };
    downloadInvoice(invoiceData);
  };

  return (
    <div className="bg-[#292a2d] border border-[#3c4043] rounded-lg hover:border-[#5f6368] transition-colors overflow-hidden">
      {/* Collapsed Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-[#202124] ${statusColors[order.status] || 'text-[#9aa0a6] border-[#3c4043]'}`}>
              {order.status}
            </span>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-[#202124] ${role === 'Runner' ? 'text-[#8ab4f8] border-[#8ab4f8]/30' : 'text-[#fde293] border-[#fde293]/30'}`}>
              {role}
            </span>
            <span className="text-[10px] font-mono text-[#9aa0a6] tracking-wider">{shortId}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#e8eaed] truncate">
                {order.file_metadata?.[0]?.name || 'Document'} 
                {order.file_metadata?.length > 1 && ` (+${order.file_metadata.length - 1} more)`}
              </p>
              <p className="text-xs text-[#9aa0a6] mt-0.5">
                📍 {order.delivery_location || 'Campus'} • {order.page_count || '—'} pages • {dateStr}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-3">
              <p className="text-lg font-bold text-[#e8eaed]">₹{totalPrice}</p>
              {expanded ? <ChevronUp size={16} className="text-[#9aa0a6]" /> : <ChevronDown size={16} className="text-[#9aa0a6]" />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-[#3c4043]">
              {/* Order ID */}
              <div className="pt-4 flex items-center gap-3">
                <div className="bg-[#202124] border border-[#3c4043] rounded-lg px-4 py-2 flex items-center gap-2">
                  <FileText size={14} className="text-[#8ab4f8]" />
                  <div>
                    <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider">Order ID</p>
                    <p className="text-sm font-mono font-bold text-[#8ab4f8] tracking-wider">{shortId}</p>
                  </div>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-3">
                  <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider mb-1">
                    {isRunner ? 'Buyer' : 'You (Buyer)'}
                  </p>
                  <p className="text-sm font-medium text-white">{isRunner ? buyerName : buyerName}</p>
                  <p className="text-[11px] text-[#9aa0a6] truncate">{order.buyer_id}</p>
                </div>
                <div className="bg-[#202124] border border-[#3c4043] rounded-lg p-3">
                  <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider mb-1">
                    {isBuyer ? 'Runner' : 'You (Runner)'}
                  </p>
                  <p className="text-sm font-medium text-white">{runnerName}</p>
                  <p className="text-[11px] text-[#9aa0a6] truncate">{order.runner_id || 'Not assigned'}</p>
                </div>
              </div>

              {/* Document Stack */}
              <div>
                <p className="text-[10px] text-[#9aa0a6] uppercase tracking-wider mb-2">Documents ({order.file_metadata?.length || 0})</p>
                <div className="space-y-1.5">
                  {order.file_metadata?.map((file: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-[#202124] px-3 py-2.5 rounded border border-[#3c4043] text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={12} className="text-[#9aa0a6] shrink-0" />
                        <span className="text-[#e8eaed] font-medium truncate">{file.name}</span>
                      </div>
                      <span className="text-[#9aa0a6] shrink-0 ml-2">
                        {file.pages}pg • {file.colorMode === 'bw' ? 'B&W' : 'Color'} • ×{file.copies || 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Runner Earnings Breakdown */}
              {isRunner && order.status === 'delivered' && (
                <div className="bg-[#81c995]/10 border border-[#81c995]/30 rounded-lg p-4">
                  <p className="text-[10px] text-[#81c995] uppercase tracking-wider font-bold mb-3">Earnings Breakdown</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#9aa0a6]">Total Collected</span>
                      <span className="text-white font-medium">₹{totalPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9aa0a6]">Base Print Cost</span>
                      <span className="text-white">- ₹{baseCost}</span>
                    </div>
                    {platformFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#9aa0a6]">Platform Fee (10%)</span>
                        <span className="text-white">- ₹{platformFee}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-[#81c995]/30">
                      <span className="text-[#81c995] font-bold">Net Earnings</span>
                      <span className="text-[#81c995] font-bold text-sm">₹{netEarnings}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Download Invoice */}
                {order.status === 'delivered' && (
                  <button
                    onClick={handleDownloadInvoice}
                    className="flex items-center gap-2 bg-[#202124] border border-[#5f6368] hover:border-[#8ab4f8] text-[#8ab4f8] px-4 py-2.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Download size={14} /> Download Invoice
                  </button>
                )}

                {/* Track active order */}
                {['searching', 'accepted', 'printing', 'ready'].includes(order.status) && onResumeOrder && (
                  <button
                    onClick={() => onResumeOrder(order)}
                    className="flex items-center gap-2 bg-[#8ab4f8]/10 border border-[#8ab4f8]/30 text-[#8ab4f8] px-4 py-2.5 rounded-lg text-xs font-medium hover:bg-[#8ab4f8]/20 transition-colors"
                  >
                    <Eye size={14} /> Track Order
                  </button>
                )}

                {/* File links */}
                {order.file_metadata?.filter((f: any) => f.url).map((file: any, i: number) => (
                  <button 
                    key={i}
                    onClick={() => window.open(file.url, '_blank')} 
                    className="flex items-center gap-1.5 bg-[#202124] border border-[#3c4043] text-[#8ab4f8] hover:text-[#aecbfa] px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Eye size={12} /> {file.name}
                  </button>
                ))}
              </div>

              {/* Rating for delivered orders */}
              {order.status === 'delivered' && (
                <RatingAndReportWidget
                  orderId={order.id}
                  currentUserEmail={currentUserEmail}
                  otherUserEmail={isRunner ? order.buyer_id : order.runner_id}
                  currentUserRole={isRunner ? 'runner' : 'buyer'}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
