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

    // WEB PUSH: Notify all active runners
    try {
      const { data: runners } = await supabaseAdmin
        .from("profiles")
        .select("push_subscription")
        .eq("is_runner", true)
        .not("push_subscription", "is", null);

      if (runners && runners.length > 0) {
        const payload = JSON.stringify({
          title: "New Ghost Gig! 👻",
          body: `${total_pages} Pages to print. Claim it fast!`,
          icon: "/Logo.jpg",
          badge: "/Logo.jpg"
        });

        const pushPromises = runners.map((runner) => 
          webPush.sendNotification(runner.push_subscription, payload).catch((e) => {
             console.error("Failed to push to a runner:", e);
             // Note: In production, remove invalid subscriptions here
          })
        );
        await Promise.all(pushPromises);
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

    // SECURITY: Enforce ownership
    // 1. If querying only 'searching' status → runners need to see all available gigs (no ownership filter)
    // 2. If querying by runner_id → must match the signed-in user
    // 3. If querying by buyer_id → must match the signed-in user
    // 4. Any other query → must be buyer or runner of the order
    const isSearchingOnly = statusFilter === 'searching';

    if (isSearchingOnly) {
      // Runners browsing available gigs — no ownership filter needed
      // (these are public orders waiting to be claimed)
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
