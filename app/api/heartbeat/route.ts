import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — lightweight heartbeat: sets last_seen_at = now() for the signed-in user
// Called every ~15s from the dashboard to track real-time presence
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    await supabaseAdmin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("username", session.user.email);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
