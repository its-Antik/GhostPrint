import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — Buyer confirms they received their printout
// This is the safety net: if the runner refuses to enter the OTP,
// the buyer can close the loop themselves, which still triggers the platform fee.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    // Verify the caller is the BUYER of this order
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== session.user.email) {
      return NextResponse.json({ error: "Only the buyer can confirm delivery" }, { status: 403 });
    }

    // Only allow confirmation if order is in an active state
    if (!["accepted", "printing", "ready"].includes(order.status)) {
      return NextResponse.json({ error: `Cannot confirm delivery for status: ${order.status}` }, { status: 400 });
    }

    // Mark as delivered
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // CHARGE THE PLATFORM FEE (same logic as the OTP completion path)
    if (updated.runner_id) {
      const BASE_BW = 2;
      const BASE_COLOR = 5;
      let baseCost = 0;

      if (updated.file_metadata) {
        for (const file of updated.file_metadata) {
          const baseRate = file.colorMode === "color" ? BASE_COLOR : BASE_BW;
          const copies = file.copies || 1;
          baseCost += file.pages * baseRate * copies;
        }
      }

      const runnerCharge = Number(updated.total_price) || 0;
      const isBaseRate = runnerCharge <= baseCost;
      const commission = isBaseRate ? 0 : Math.round(baseCost * 0.10);

      if (commission > 0) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("balance")
          .eq("username", updated.runner_id)
          .single();

        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({ balance: Number(profile.balance) - commission })
            .eq("username", updated.runner_id);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Delivery confirmed. Platform fee charged.",
      order: updated 
    });
  } catch (err: any) {
    console.error("Confirm delivery error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
