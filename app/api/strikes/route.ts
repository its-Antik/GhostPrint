import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — add a strike to a user or pay fine
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "add_strike") {
      // Add a strike to the current user (called from late cancellation)
      const userEmail = session.user.email;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("strike_count")
        .eq("username", userEmail)
        .single();

      const currentStrikes = (profile?.strike_count || 0) + 1;
      const shouldDisable = currentStrikes >= 3;

      await supabaseAdmin
        .from("profiles")
        .update({
          strike_count: currentStrikes,
          account_disabled: shouldDisable,
        })
        .eq("username", userEmail);

      return NextResponse.json({
        strike_count: currentStrikes,
        account_disabled: shouldDisable,
      });
    }

    if (action === "pay_fine") {
      // Reset strikes and re-enable account after paying ₹100 fine
      const userEmail = session.user.email;

      await supabaseAdmin
        .from("profiles")
        .update({
          strike_count: 0,
          account_disabled: false,
        })
        .eq("username", userEmail);

      return NextResponse.json({ success: true, strike_count: 0, account_disabled: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Strike API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — get strike info for current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("strike_count, account_disabled")
      .eq("username", session.user.email)
      .single();

    return NextResponse.json({
      strike_count: profile?.strike_count || 0,
      account_disabled: profile?.account_disabled || false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
