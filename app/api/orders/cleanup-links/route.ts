import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/orders/cleanup-links
 * Server-side cleanup: Nullifies file URLs in orders older than 24 hours.
 * This is the backend counterpart to the frontend 24h expiry check.
 * 
 * Can be called by:
 * - A cron job (e.g., Vercel Cron, external scheduler)
 * - An admin manually via curl
 * 
 * Protected by a secret token to prevent unauthorized access.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth: accept Vercel Cron header OR a manual Bearer token
    const cronSecret = req.headers.get("x-vercel-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    const expectedSecret = process.env.CRON_SECRET || process.env.CLEANUP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!cronSecret || cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const TWENTY_FOUR_HOURS_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch orders older than 24 hours that still have file URLs in metadata
    const { data: oldOrders, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, file_metadata, created_at")
      .lt("created_at", TWENTY_FOUR_HOURS_AGO)
      .not("file_metadata", "is", null);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    let cleaned = 0;

    for (const order of (oldOrders || [])) {
      if (!order.file_metadata || !Array.isArray(order.file_metadata)) continue;

      // Check if any file still has a url
      const hasUrls = order.file_metadata.some((f: any) => f.url);
      if (!hasUrls) continue;

      // Strip url and file_id from each file entry
      const cleanedMetadata = order.file_metadata.map((f: any) => ({
        ...f,
        url: null,
        file_id: null,
      }));

      await supabaseAdmin
        .from("orders")
        .update({ file_metadata: cleanedMetadata })
        .eq("id", order.id);

      cleaned++;
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned file links from ${cleaned} orders older than 24 hours.`,
      total_checked: oldOrders?.length || 0,
      total_cleaned: cleaned,
    });
  } catch (err: any) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
