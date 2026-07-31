import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;

/**
 * GET /api/system — Check if the system is active
 * Public endpoint (no auth needed) — used by the frontend to show maintenance overlay
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("global_settings")
      .select("value")
      .eq("key", "is_system_active")
      .single();

    if (error || !data) {
      // If table doesn't exist yet, assume system is active
      return NextResponse.json({ active: true });
    }

    return NextResponse.json({
      active: data.value?.active ?? true,
      message: data.value?.message || "The Grid is undergoing scheduled maintenance.",
      estimated_uptime: data.value?.estimated_uptime || "Unknown",
    });
  } catch {
    // Failsafe: if anything breaks, don't lock users out
    return NextResponse.json({ active: true });
  }
}

/**
 * PATCH /api/system — Toggle system active/inactive (Admin only)
 * Body: { active: boolean, message?: string, estimated_uptime?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized — admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { active, message, estimated_uptime } = body;

    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "Missing 'active' boolean" }, { status: 400 });
    }

    const value = {
      active,
      message: message || "The Grid is undergoing scheduled maintenance.",
      estimated_uptime: estimated_uptime || "4 hours",
    };

    const { error } = await supabaseAdmin
      .from("global_settings")
      .upsert({ key: "is_system_active", value, updated_at: new Date().toISOString() });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send Telegram alert
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_SUPPORT_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID;
    if (botToken && chatId) {
      const emoji = active ? "🟢" : "🔴";
      const text = `${emoji} *System ${active ? "ONLINE" : "OFFLINE"}*\n\n${active ? "The Grid is back online." : `Reason: ${value.message}\nEstimated uptime: ${value.estimated_uptime}`}`;
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, ...value });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
