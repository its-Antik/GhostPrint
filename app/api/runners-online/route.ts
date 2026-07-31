import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — returns the count of students currently online on the same campus
// "Online" = last_seen_at within the last 2 minutes (heartbeat-based presence)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Determine the user's campus domain (from profile first, then email fallback)
    let userDomain = userEmail.split('@')[1]?.toLowerCase() || '';
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('college_domain')
        .eq('username', userEmail)
        .single();
      if (userProfile?.college_domain) {
        userDomain = userProfile.college_domain;
      }
    } catch (_) {
      // Fallback to email-derived domain
    }

    // "Online" = heartbeat within the last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    // Count online users on the same campus (excluding the current user)
    let query = supabaseAdmin
      .from('profiles')
      .select('username', { count: 'exact', head: true })
      .gte('last_seen_at', twoMinutesAgo)
      .neq('username', userEmail);

    if (userDomain) {
      query = query.eq('college_domain', userDomain);
    }

    const { count, error } = await query;

    if (error) {
      console.error("Runners online count error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (err: any) {
    console.error("Runners online API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
