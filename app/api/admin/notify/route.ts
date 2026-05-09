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

// Configure Web Push with VAPID keys
webPush.setVapidDetails(
  `mailto:${ADMIN_EMAIL || 'admin@ghostprint.com'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

const MAX_NOTIFICATIONS_PER_USER = 10;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { target_email, title, message, type = "system", metadata = {}, send_push = false, give_bonus = 0 } = body;

    if (!target_email || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Give Bonus (if requested)
    if (give_bonus > 0 && target_email !== "all") {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('balance')
        .eq('username', target_email)
        .single();
      
      if (profile) {
        await supabaseAdmin
          .from('profiles')
          .update({ balance: Number(profile.balance) + Number(give_bonus) })
          .eq('username', target_email);
      }
    }

    // 2. Determine recipients
    let recipients = [];
    if (target_email === "all") {
      const { data: profiles, error } = await supabaseAdmin.from('profiles').select('username');
      if (error) console.error("Error fetching all profiles:", error);
      if (profiles) recipients = profiles;
    } else {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('username', target_email)
        .single();
      if (error) console.error("Error fetching profile:", error);
      if (profile) recipients = [profile];
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No matching users found" }, { status: 404 });
    }

    // 3. Send notifications
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
          icon: "/Logo.jpg",
          badge: "/Logo.jpg"
        });
        promises.push(
          webPush.sendNotification(user.push_subscription, pushPayload).catch((e) => {
            console.error(`Push failed for ${user.username}:`, e.statusCode || e.message);
          })
        );
      }

      return promises;
    });

    await Promise.all(allPromises);

    return NextResponse.json({ 
      success: true, 
      message: `Notification sent to ${recipients.length} user(s).`,
      notified_count: recipients.length
    });

  } catch (err: any) {
    console.error("Admin Notify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
