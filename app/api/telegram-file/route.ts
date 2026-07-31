import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Server-side Supabase client to verify ownership
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch a file from Telegram and stream it to the browser
// SECURED: Only the buyer (uploader) or the runner (who accepted the order) can access
// Query params: file_id (required), name (optional, for Content-Disposition)
export async function GET(req: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized — sign in first" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("file_id");
    const fileName = searchParams.get("name") || "document.pdf";

    if (!fileId) {
      return NextResponse.json({ error: "Missing file_id" }, { status: 400 });
    }

    if (!BOT_TOKEN) {
      return NextResponse.json({ error: "Telegram bot not configured" }, { status: 500 });
    }

    // 2. Authorization check — verify the user owns or has access to an order containing this file_id
    const userEmail = session.user.email;

    // Search orders where this file_id appears in file_metadata AND the user is either buyer or runner
    const { data: orders, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, runner_id, file_metadata")
      .or(`buyer_id.eq.${userEmail},runner_id.eq.${userEmail}`);

    if (orderError) {
      console.error("File access verification error:", orderError);
      return NextResponse.json({ error: "Failed to verify file access" }, { status: 500 });
    }

    // Check if any of the user's orders contain this file_id
    const hasAccess = orders?.some((order: any) => {
      if (!order.file_metadata) return false;
      return order.file_metadata.some((file: any) => {
        // The file URL contains the file_id as a query param
        if (file.url && file.url.includes(fileId)) return true;
        if (file.file_id === fileId) return true;
        return false;
      });
    });

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied — you don't have permission to view this file" },
        { status: 403 }
      );
    }

    // 3. Fetch from Telegram (user is authorized)
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const getFileData = await getFileRes.json();

    if (!getFileData.ok || !getFileData.result.file_path) {
      return NextResponse.json(
        { error: "Failed to locate file on Telegram" },
        { status: 404 }
      );
    }

    // 4. Download and stream the file
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${getFileData.result.file_path}`;
    const fileRes = await fetch(downloadUrl);

    if (!fileRes.ok) {
      return NextResponse.json(
        { error: "Failed to download file from Telegram" },
        { status: 502 }
      );
    }

    const fileBuffer = await fileRes.arrayBuffer();
    const contentType = fileName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600", // Private cache — not shared
      },
    });
  } catch (err: any) {
    console.error("Telegram file proxy error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
