import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch chat messages for an order
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    // Verify the user is buyer or runner of this order
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("buyer_id, runner_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const userEmail = session.user.email;
    if (order.buyer_id !== userEmail && order.runner_id !== userEmail) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — send a chat message
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { order_id, text, is_quick_card } = await req.json();

    if (!order_id || !text) {
      return NextResponse.json({ error: "Missing order_id or text" }, { status: 400 });
    }

    // Verify the user is buyer or runner of this order
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("buyer_id, runner_id, status")
      .eq("id", order_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const userEmail = session.user.email;
    if (order.buyer_id !== userEmail && order.runner_id !== userEmail) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Don't allow chat on completed orders
    if (order.status === "delivered" || order.status === "cancelled") {
      return NextResponse.json({ error: "Order is already closed" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        order_id,
        sender_id: userEmail,
        sender_name: session.user.name || userEmail.split("@")[0],
        text: text.substring(0, 500), // Max 500 chars per message
        is_quick_card: is_quick_card || false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
