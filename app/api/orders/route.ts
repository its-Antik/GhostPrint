import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

// Server-side Supabase client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configure Web Push with VAPID keys
webPush.setVapidDetails(
  `mailto:${process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@ghostprint.com'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

// Helper: Insert a notification into the notifications table
// This triggers Supabase Realtime → useNotifications hook → GhostPing toast
// Auto-prunes old notifications beyond 10 per user
const MAX_NOTIFICATIONS_PER_USER = 10;

async function insertNotification(
  userEmail: string,
  title: string,
  message: string,
  type: string = "order",
  metadata: Record<string, any> = {}
) {
  try {
    // 1. Insert the new notification
    await supabaseAdmin.from("notifications").insert({
      user_email: userEmail,
      title,
      message,
      type,
      metadata,
    });

    // 2. Auto-prune: keep only the latest 10 per user
    // Fetch IDs of notifications beyond the limit (oldest first)
    const { data: allNotifs } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (allNotifs && allNotifs.length > MAX_NOTIFICATIONS_PER_USER) {
      const idsToDelete = allNotifs
        .slice(MAX_NOTIFICATIONS_PER_USER)
        .map((n) => n.id);

      await supabaseAdmin
        .from("notifications")
        .delete()
        .in("id", idsToDelete);
    }
  } catch (err) {
    console.error("Failed to insert notification:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated via NextAuth
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { total_pages, total_cost, file_metadata, delivery_location } = body;

    if (!total_pages || !total_cost || !delivery_location) {
      return NextResponse.json({ error: "Missing required fields including delivery_location" }, { status: 400 });
    }

    // Get college_domain from the buyer's profile for correct tenant tagging
    // This ensures admin/non-campus accounts use their assigned campus domain
    let buyerDomain = session.user.email.split('@')[1]?.toLowerCase() || '';
    try {
      const { data: buyerProfile } = await supabaseAdmin
        .from('profiles')
        .select('college_domain')
        .eq('username', session.user.email)
        .single();
      if (buyerProfile?.college_domain) {
        buyerDomain = buyerProfile.college_domain;
      }
    } catch (_) {
      // Fallback to email-derived domain
    }

    // Generate random 4-digit OTP at order creation
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Create order using service role (bypasses RLS)
    const { data: newOrder, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        buyer_id: session.user.email,
        status: "searching",
        total_price: total_cost,
        page_count: total_pages,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        file_metadata: file_metadata || [],
        delivery_location: delivery_location,
        pickup_code: otp,
        college_domain: buyerDomain,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message, details: insertError },
        { status: 500 }
      );
    }

    // NOTIFY ACTIVE RUNNERS FROM SAME CAMPUS: Web Push + In-App
    try {
      // Only notify runners from the same college domain (tenant isolation)
      let runnerQuery = supabaseAdmin
        .from("profiles")
        .select("username, push_subscription")
        .eq("is_runner_active", true);

      if (buyerDomain) {
        runnerQuery = runnerQuery.eq("college_domain", buyerDomain);
      }

      const { data: activeRunners } = await runnerQuery;

      if (activeRunners && activeRunners.length > 0) {
        const pushPayload = JSON.stringify({
          title: "New Ghost Gig! 👻",
          body: `${total_pages} Pages to print. Claim it fast!`,
          icon: "/Logo.jpg",
          badge: "/Logo.jpg"
        });

        const allPromises = activeRunners.flatMap((runner) => {
          const promises: Promise<any>[] = [];

          // 1. Web Push (if they have a valid subscription)
          if (runner.push_subscription) {
            promises.push(
              webPush.sendNotification(runner.push_subscription, pushPayload).catch((e) => {
                console.error("Failed to push to runner:", runner.username, e.statusCode || e.message);
              })
            );
          }

          // 2. In-app notification (always — this powers the bell icon + GhostPing toast)
          // Skip notifying the buyer themselves if they happen to be an active runner
          if (runner.username !== session.user!.email) {
            promises.push(
              insertNotification(
                runner.username,
                "New Ghost Gig! 👻",
                `${total_pages} pages to print at ${delivery_location}. Claim it now!`,
                "order",
                { order_id: newOrder.id }
              )
            );
          }

          return promises;
        });

        await Promise.all(allPromises);
      }
    } catch (pushErr) {
      console.error("Push notification logic failed:", pushErr);
    }

    return NextResponse.json({ order: newOrder });
  } catch (err: any) {
    console.error("Order creation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — fetch orders (bypasses RLS using service role)
// Query params: status (comma-separated), runner_id, buyer_id
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const runnerId = searchParams.get('runner_id');
    const buyerId = searchParams.get('buyer_id');
    const userEmail = session.user.email;

    let query = supabaseAdmin.from('orders').select('*');

    if (statusFilter) {
      const statuses = statusFilter.split(',');
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else {
        query = query.in('status', statuses);
      }
    }

    // MULTI-TENANT: Look up the user's college_domain from their profile
    // This ensures admin accounts (e.g., gmail.com) correctly match their assigned campus
    let userDomain = userEmail.split('@')[1]?.toLowerCase() || '';
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('college_domain')
        .eq('username', userEmail)
        .single();
      if (userProfile?.college_domain) {
        userDomain = userProfile.college_domain;
      }
    } catch (_) {
      // Fallback to email-derived domain if profile lookup fails
    }

    // SECURITY: Enforce ownership
    // 1. If querying only 'searching' status → runners see gigs FROM THEIR OWN CAMPUS only
    //    ALSO excludes the user's own orders (buyer can't see their own gig as a runner)
    // 2. If querying by runner_id → must match the signed-in user
    // 3. If querying by buyer_id → must match the signed-in user
    // 4. Any other query → must be buyer or runner of the order
    const isSearchingOnly = statusFilter === 'searching';

    if (isSearchingOnly) {
      // TENANT ISOLATION: Only show gigs from the runner's own campus
      if (userDomain) {
        query = query.eq('college_domain', userDomain);
      }
      // SELF-EXCLUSION: A buyer must never see their own order in the runner's gig list
      query = query.neq('buyer_id', userEmail);
    } else if (runnerId) {
      // Enforce: you can only query YOUR OWN runner orders
      if (runnerId !== userEmail) {
        return NextResponse.json({ error: "Access denied — cannot view other runner's orders" }, { status: 403 });
      }
      query = query.eq('runner_id', runnerId);
    } else if (buyerId) {
      // Enforce: you can only query YOUR OWN buyer orders
      if (buyerId !== userEmail) {
        return NextResponse.json({ error: "Access denied — cannot view other buyer's orders" }, { status: 403 });
      }
      query = query.eq('buyer_id', buyerId);
    } else {
      // No specific filter → return only orders where user is buyer or runner
      query = query.or(`buyer_id.eq.${userEmail},runner_id.eq.${userEmail}`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data });
  } catch (err: any) {
    console.error("Orders GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — update order (e.g., add file_metadata, runner claims)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, ...updates } = body;

    if (!order_id) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    // If runner is claiming the job, recalculate price based on runner's rates
    if (updates.status === 'accepted' && updates.runner_id) {
      // SELF-CLAIM GUARD: Prevent a buyer from claiming their own order
      const { data: orderCheck } = await supabaseAdmin
        .from('orders')
        .select('buyer_id')
        .eq('id', order_id)
        .single();
      if (orderCheck && orderCheck.buyer_id === session.user.email) {
        return NextResponse.json(
          { error: "You cannot claim your own order." },
          { status: 403 }
        );
      }

      // Fetch runner's rates
      const { data: runnerProfile } = await supabaseAdmin
        .from('profiles')
        .select('bw_rate, color_rate, full_name, username')
        .eq('username', updates.runner_id)
        .single();

      // Fetch the current order to get file_metadata
      const { data: currentOrder } = await supabaseAdmin
        .from('orders')
        .select('file_metadata')
        .eq('id', order_id)
        .single();

      if (runnerProfile && currentOrder?.file_metadata) {
        const bwRate = runnerProfile.bw_rate || 2;
        const colorRate = runnerProfile.color_rate || 5;
        
        let calculatedPrice = 0;
        for (const file of currentOrder.file_metadata) {
          const rate = file.colorMode === 'color' ? colorRate : bwRate;
          const copies = file.copies || 1;
          calculatedPrice += file.pages * rate * copies;
        }

        updates.total_price = calculatedPrice;
        updates.runner_name = runnerProfile.full_name || runnerProfile.username?.split('@')[0] || 'Runner';
      }

      // Store the accepted timestamp for the 45s free-cancel window
      updates.accepted_at = new Date().toISOString();
    }

    // BUILD THE UPDATE QUERY
    let updateQuery = supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", order_id);

    // RACE CONDITION GUARD: When a runner claims a job, add atomic conditions.
    // The UPDATE will only succeed if the order is STILL in 'searching' status
    // AND no runner has been assigned yet. If Runner B arrives 1ms after Runner A,
    // the row will already have status='accepted' and runner_id set, so this
    // UPDATE will match 0 rows → we detect it and return 409 Conflict.
    if (updates.status === 'accepted' && updates.runner_id) {
      updateQuery = updateQuery
        .eq('status', 'searching')   // Must still be searching
        .is('runner_id', null);       // Must not have a runner yet
    }

    const { data, error, count } = await updateQuery
      .select()
      .single();

    // DOUBLE-BOOKING DETECTION
    if (updates.status === 'accepted' && updates.runner_id) {
      if (error && error.code === 'PGRST116') {
        // PGRST116 = "JSON object requested, multiple (or no) rows returned"
        // This means the WHERE clause matched 0 rows → job already taken
        return NextResponse.json(
          { error: "This job has already been claimed by another runner." },
          { status: 409 }
        );
      }
    }

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ===== IN-APP NOTIFICATIONS ON STATUS CHANGES =====
    try {
      const buyerEmail = data.buyer_id;
      const runnerEmail = data.runner_id;
      const runnerName = data.runner_name || runnerEmail?.split('@')[0] || 'Runner';
      const buyerName = buyerEmail?.split('@')[0] || 'Buyer';
      const pages = data.page_count || 0;

      if (updates.status === 'accepted' && buyerEmail) {
        // Notify buyer: "Your order was accepted!"
        await insertNotification(
          buyerEmail,
          `${runnerName} accepted your order!`,
          `Your ${pages}-page print request has been claimed. They'll start printing soon.`,
          "order",
          { order_id: data.id, action: "order_accepted" }
        );
      } else if (updates.status === 'printing' && buyerEmail) {
        // Notify buyer: "Runner started printing"
        await insertNotification(
          buyerEmail,
          "🖨️ Printing in progress!",
          `${runnerName} is printing your ${pages} pages right now.`,
          "order",
          { order_id: data.id, action: "printing_started" }
        );
      } else if (updates.status === 'ready' && buyerEmail) {
        // Notify buyer: "Ready for pickup!"
        await insertNotification(
          buyerEmail,
          "✅ Your prints are ready!",
          `${runnerName} has finished printing. Meet them at ${data.delivery_location || 'campus'} — share your OTP to collect.`,
          "order",
          { order_id: data.id, action: "prints_ready" }
        );
      } else if (updates.status === 'delivered') {
        // Notify buyer: "Delivered!"
        if (buyerEmail) {
          await insertNotification(
            buyerEmail,
            "📦 Job Delivered!",
            `Your print order has been delivered. Thanks for using GhostPrint!`,
            "order",
            { order_id: data.id, action: "delivered" }
          );
        }
        // Notify runner: "Job completed + earnings"
        if (runnerEmail) {
          await insertNotification(
            runnerEmail,
            "💰 Job Complete!",
            `You delivered ${pages} pages to ${buyerName}. Earnings have been recorded.`,
            "order",
            { order_id: data.id, action: "delivered" }
          );
        }
      } else if (updates.status === 'cancelled') {
        // ===== SMART CANCELLATION NOTIFICATIONS =====
        // Determine WHO cancelled by comparing session email to order roles
        const currentUser = session?.user?.email;
        const isBuyerCancelling = currentUser === buyerEmail;
        const isRunnerCancelling = currentUser === runnerEmail;

        // Determine if within the 45-second free cancellation window
        const isFreeCancellation = (() => {
          if (!data.accepted_at) return true; // No runner yet = always free
          const elapsed = Date.now() - new Date(data.accepted_at).getTime();
          return elapsed <= 45_000; // 45 seconds
        })();

        if (isBuyerCancelling) {
          // ---- BUYER CANCELLED ----

          if (isFreeCancellation) {
            // Buyer: Confirm their own cancellation (neutral tone)
            await insertNotification(
              buyerEmail,
              "🔔 Order Cancelled",
              `You cancelled your ${pages}-page print request.`,
              "info",
              { order_id: data.id, action: "self_cancelled" }
            );
            // Runner (if assigned): Inform them the buyer cancelled
            if (runnerEmail) {
              await insertNotification(
                runnerEmail,
                "📋 Order Cancelled by Buyer",
                `${buyerName} cancelled their ${pages}-page order within the free window. No action needed on your end.`,
                "info",
                { order_id: data.id, action: "buyer_cancelled_free" }
              );
            }
          } else {
            // LATE CANCEL — buyer cancelled after the free window
            // Buyer: Warning about repeated late cancellations
            await insertNotification(
              buyerEmail,
              "⚠️ Order Cancelled (Late)",
              `You cancelled your order after the free cancellation window. Repeated late cancellations may result in account restrictions. Please avoid cancelling after a runner has started working on your order.`,
              "system",
              { order_id: data.id, action: "self_cancelled_late" }
            );
            // Runner: Reassure them that action will be taken
            if (runnerEmail) {
              await insertNotification(
                runnerEmail,
                "📋 Buyer Cancelled After Acceptance",
                `${buyerName} cancelled their ${pages}-page order after the free window. We understand this is frustrating — our system tracks late cancellations and takes steps to prevent this from happening again.`,
                "system",
                { order_id: data.id, action: "buyer_cancelled_late" }
              );
            }
          }

        } else if (isRunnerCancelling) {
          // ---- RUNNER CANCELLED ----

          if (isFreeCancellation) {
            // Runner: Confirm their own cancellation (neutral tone)
            await insertNotification(
              runnerEmail,
              "🔔 Job Dropped",
              `You dropped the ${pages}-page job from ${buyerName}. No penalty applied.`,
              "info",
              { order_id: data.id, action: "self_dropped" }
            );
            // Buyer: Inform them the runner dropped and we're finding another
            if (buyerEmail) {
              await insertNotification(
                buyerEmail,
                "📋 Runner Dropped Your Order",
                `Your runner dropped your ${pages}-page request. Don't worry — your order is back in the queue and available for other runners to pick up.`,
                "info",
                { order_id: data.id, action: "runner_dropped_free" }
              );
            }
          } else {
            // LATE CANCEL — runner dropped after the free window
            // Runner: Warning about repeated late drops
            await insertNotification(
              runnerEmail,
              "⚠️ Job Dropped (Late)",
              `You dropped this job after the free cancellation window. Repeated late drops will add strikes to your account and may result in a permanent ban. Please only accept jobs you can fulfill.`,
              "system",
              { order_id: data.id, action: "self_dropped_late" }
            );
            // Buyer: Reassure them
            if (buyerEmail) {
              await insertNotification(
                buyerEmail,
                "📋 Runner Dropped Your Order",
                `Your runner dropped your ${pages}-page order after accepting it. We apologize for the inconvenience — your order is back in the queue, and our system takes action against runners who do this repeatedly.`,
                "system",
                { order_id: data.id, action: "runner_dropped_late" }
              );
            }
          }

        } else {
          // Edge case: cancelled by system/admin or unknown user
          if (buyerEmail) {
            await insertNotification(
              buyerEmail,
              "🔔 Order Cancelled",
              `Your ${pages}-page print order has been cancelled.`,
              "system",
              { order_id: data.id, action: "system_cancelled" }
            );
          }
          if (runnerEmail) {
            await insertNotification(
              runnerEmail,
              "🔔 Job Cancelled",
              `The ${pages}-page job has been cancelled.`,
              "system",
              { order_id: data.id, action: "system_cancelled" }
            );
          }
        }
      }
    } catch (notifErr) {
      console.error("Notification insert failed (non-blocking):", notifErr);
    }

    // GHOST CREDIT BALANCE LOGIC:
    // If the order was just delivered, charge the runner the platform commission (Debt)
    if (updates.status === 'delivered' && data.runner_id) {
      const BASE_BW = 2;
      const BASE_COLOR = 5;
      let baseCost = 0;
      
      if (data.file_metadata) {
        for (const file of data.file_metadata) {
          const baseRate = file.colorMode === 'color' ? BASE_COLOR : BASE_BW;
          const copies = file.copies || 1;
          baseCost += file.pages * baseRate * copies;
        }
      }

      // No fee if runner charged at base rate
      const runnerCharge = Number(data.total_price) || 0;
      const isBaseRate = runnerCharge <= baseCost;
      const commission = isBaseRate ? 0 : Math.round(baseCost * 0.10);
      
      if (commission > 0) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('balance')
          .eq('username', data.runner_id)
          .single();
          
        if (profile) {
          await supabaseAdmin
            .from('profiles')
            .update({ balance: Number(profile.balance) - commission })
            .eq('username', data.runner_id);
        }
      }
    }

    return NextResponse.json({ order: data });
  } catch (err: any) {
    console.error("Order update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
