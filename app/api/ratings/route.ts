import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — submit a rating
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, ratee_email, rater_role, stars } = body;

    if (!order_id || !ratee_email || !rater_role || !stars) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (stars < 1 || stars > 5) {
      return NextResponse.json({ error: "Stars must be between 1 and 5" }, { status: 400 });
    }

    // Verify order exists and user is part of it
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("buyer_id, runner_id, status")
      .eq("id", order_id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "delivered") {
      return NextResponse.json({ error: "Can only rate delivered orders" }, { status: 400 });
    }

    const userEmail = session.user.email;
    if (userEmail !== order.buyer_id && userEmail !== order.runner_id) {
      return NextResponse.json({ error: "You are not part of this order" }, { status: 403 });
    }

    // Insert rating (upsert to prevent duplicates)
    const { error: ratingError } = await supabaseAdmin
      .from("ratings")
      .upsert({
        order_id,
        rater_email: userEmail,
        ratee_email,
        rater_role,
        stars,
      }, { onConflict: "order_id,rater_email" });

    if (ratingError) {
      console.error("Rating insert error:", ratingError);
      return NextResponse.json({ error: ratingError.message }, { status: 500 });
    }

    // Recalculate average rating for the ratee
    const { data: allRatings } = await supabaseAdmin
      .from("ratings")
      .select("stars")
      .eq("ratee_email", ratee_email);

    if (allRatings && allRatings.length > 0) {
      const totalStars = allRatings.reduce((sum, r) => sum + r.stars, 0);
      const avgRating = totalStars / allRatings.length;

      await supabaseAdmin
        .from("profiles")
        .update({
          avg_rating: Math.round(avgRating * 100) / 100,
          total_ratings: allRatings.length,
        })
        .eq("username", ratee_email);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Rating API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — fetch rating for an order (check if user already rated)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const userEmail = searchParams.get("user_email");

    if (orderId) {
      // Get ratings for a specific order
      const { data, error } = await supabaseAdmin
        .from("ratings")
        .select("*")
        .eq("order_id", orderId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ratings: data || [] });
    }

    if (userEmail) {
      // Get avg rating for a user
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("avg_rating, total_ratings")
        .eq("username", userEmail)
        .single();

      return NextResponse.json({
        avg_rating: profile?.avg_rating || 0,
        total_ratings: profile?.total_ratings || 0,
      });
    }

    return NextResponse.json({ error: "Provide order_id or user_email" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
