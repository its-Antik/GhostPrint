import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — submit a report
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, reported_email, feedback } = body;

    if (!order_id || !reported_email || !feedback?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify order exists and user is part of it
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("buyer_id, runner_id")
      .eq("id", order_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const userEmail = session.user.email;
    if (userEmail !== order.buyer_id && userEmail !== order.runner_id) {
      return NextResponse.json({ error: "You are not part of this order" }, { status: 403 });
    }

    // Insert report (upsert to prevent duplicates)
    const { error: reportError } = await supabaseAdmin
      .from("reports")
      .upsert({
        order_id,
        reporter_email: userEmail,
        reported_email,
        feedback: feedback.trim(),
      }, { onConflict: "order_id,reporter_email" });

    if (reportError) {
      console.error("Report insert error:", reportError);
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Report API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
