import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
const ADMIN_EMAILS = [ADMIN_EMAIL, "antik13sarkar@gmail.com"].filter(Boolean);

// Configure Web Push with VAPID keys
webPush.setVapidDetails(
  `mailto:${ADMIN_EMAIL || 'admin@pagen.co'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

const MAX_NOTIFICATIONS_PER_USER = 10;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { target_email, title, message, type = "system", metadata = {}, send_push = false, give_bonus = 0 } = body;

    if (!target_email || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Give Bonus (if requested)
    if (give_bonus > 0 && target_email !== "all") {
      const trimmedEmail = target_email.trim();
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('balance, username')
        .ilike('username', trimmedEmail);
      
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        await supabaseAdmin
          .from('profiles')
          .update({ balance: Number(profile.balance) + Number(give_bonus) })
          .eq('username', profile.username);
      }
    }

    // 2. Determine recipients
    let recipients: { username: string; push_subscription?: any }[] = [];
    if (target_email === "all") {
      // Global broadcast — all users
      const { data: profiles, error } = await supabaseAdmin.from('profiles').select('username, push_subscription');
      if (error) console.error("Error fetching all profiles:", error);
      if (profiles) recipients = profiles;
    } else if (target_email.startsWith("all@")) {
      // MULTI-TENANT: Domain-scoped broadcast — e.g., "all@heritageit.edu.in"
      const domain = target_email.split("@")[1];
      const { data: profiles, error } = await supabaseAdmin
         .from('profiles')
         .select('username, push_subscription')
         .eq('college_domain', domain);
      if (error) console.error("Error fetching campus profiles:", error);
      if (profiles) recipients = profiles;
    } else {
      // Single user lookup — case-insensitive to handle casing mismatches
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('username, push_subscription')
        .ilike('username', target_email.trim());
      if (error) console.error("Error fetching profile:", error);
      if (profiles && profiles.length > 0) recipients = profiles;
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No matching users found" }, { status: 404 });
    }

    // 3. Send notifications
    let pushSuccessCount = 0;
    let pushFailCount = 0;

    const allPromises = recipients.flatMap((user) => {
      const promises: Promise<any>[] = [];

      // A. Insert In-App Notification
      promises.push(
        (async () => {
          await supabaseAdmin.from("notifications").insert({
            user_email: user.username,
            title,
            message,
            type,
            metadata,
          });

          // Prune old notifications
          const { data: allNotifs } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("user_email", user.username)
            .order("created_at", { ascending: false });

          if (allNotifs && allNotifs.length > MAX_NOTIFICATIONS_PER_USER) {
            const idsToDelete = allNotifs.slice(MAX_NOTIFICATIONS_PER_USER).map((n) => n.id);
            await supabaseAdmin.from("notifications").delete().in("id", idsToDelete);
          }
        })()
      );

      // B. Send Native Web Push
      if (send_push && user.push_subscription) {
        const pushPayload = JSON.stringify({
          title,
          body: message,
          icon: "/Logo.jpg?v=2",
          badge: "/Logo.jpg?v=2",
          tag: `admin-${Date.now()}`,
          url: "/dashboard"
        });
        promises.push(
          webPush.sendNotification(user.push_subscription, pushPayload)
            .then(() => { pushSuccessCount++; })
            .catch(async (e) => {
              pushFailCount++;
              console.error(`Push failed for ${user.username}:`, e.statusCode || e.message);
              // If subscription is expired/invalid (410 Gone), clean it up
              if (e.statusCode === 410 || e.statusCode === 404) {
                console.log(`Cleaning up expired subscription for ${user.username}`);
                await supabaseAdmin
                  .from('profiles')
                  .update({ push_subscription: null })
                  .eq('username', user.username);
              }
            })
        );
      }

      return promises;
    });

    await Promise.all(allPromises);

    const pushInfo = send_push 
      ? ` Push: ${pushSuccessCount} delivered, ${pushFailCount} failed.`
      : '';

    return NextResponse.json({ 
      success: true, 
      message: `Notification sent to ${recipients.length} user(s).${pushInfo}`,
      notified_count: recipients.length,
      push_success: pushSuccessCount,
      push_failed: pushFailCount,
    });

  } catch (err: any) {
    console.error("Admin Notify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
