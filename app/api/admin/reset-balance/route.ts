import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;

// POST — reset a runner's balance after they clear their dues
// Body: { runner_email: string, new_balance?: number }
// Only admin can call this
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin can reset balances
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { runner_email, new_balance } = body;

    if (!runner_email) {
      return NextResponse.json({ error: "Missing runner_email" }, { status: 400 });
    }

    // Reset balance to 0 (or optional new_balance value)
    const resetBalance = new_balance !== undefined ? new_balance : 0;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ balance: resetBalance, updated_at: new Date().toISOString() })
      .eq("username", runner_email)
      .select()
      .single();

    if (error) {
      console.error("Balance reset error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Balance for ${runner_email} reset to ₹${resetBalance}`,
      profile: data 
    });
  } catch (err: any) {
    console.error("Reset balance error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — list all restricted runners (balance <= -50) — admin only
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("username, full_name, balance, updated_at")
      .lte("balance", -50)
      .order("balance", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ restricted_runners: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
