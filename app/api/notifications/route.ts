import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch notifications for the signed-in user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email;

    // Fetch recent notifications (last 10 — we auto-prune beyond this)
    const { data: notifications, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_email", email)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Notifications fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count unread
    const unreadCount = (notifications || []).filter((n: any) => !n.is_read).length;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (err: any) {
    console.error("Notifications GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const email = session.user.email;

    if (body.action === "mark_all_read") {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_email", email)
        .eq("is_read", false);

      if (error) {
        console.error("Mark read error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Mark single notification as read
    if (body.notification_id) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", body.notification_id)
        .eq("user_email", email);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Notifications PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
