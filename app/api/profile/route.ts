import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch profile for the signed-in user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("username", session.user.email)
      .single();

    if (error && error.code === "PGRST116") {
      // No row found — return empty profile so the client knows to create one
      return NextResponse.json({ profile: null });
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create or update profile for the signed-in user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const email = session.user.email;

    // Build the payload from provided fields
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.full_name !== undefined) payload.full_name = body.full_name;
    if (body.department !== undefined) payload.department = body.department;
    if (body.whatsapp_no !== undefined) payload.whatsapp_no = body.whatsapp_no;
    if (body.avatar_url !== undefined) payload.avatar_url = body.avatar_url;
    if (body.is_runner_active !== undefined) payload.is_runner_active = body.is_runner_active;
    if (body.bw_rate !== undefined) payload.bw_rate = body.bw_rate;
    if (body.color_rate !== undefined) payload.color_rate = body.color_rate;
    if (body.balance !== undefined) payload.balance = body.balance;
    if (body.dues !== undefined) payload.dues = body.dues;
    if (body.bonus !== undefined) payload.bonus = body.bonus;
    if (body.notifications_enabled !== undefined) payload.notifications_enabled = body.notifications_enabled;

    // First, try UPDATE (profile should already exist from signIn callback)
    const { data: updated, error: updateError, count } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("username", email)
      .select()
      .single();

    if (updated) {
      return NextResponse.json({ profile: updated });
    }

    // Profile doesn't exist — need to create it
    // The profiles.id column has a FK to auth.users, which doesn't work with NextAuth.
    // We omit `id` and let the DB default (gen_random_uuid()) handle it.
    // If this fails with FK error, user needs to run the SQL fix (see fix_fk.sql).
    const insertPayload: Record<string, any> = {
      username: email,
      full_name: body.full_name || session.user.name || "",
      avatar_url: body.avatar_url || session.user.image || "",
      department: body.department || "",
      whatsapp_no: body.whatsapp_no || "",
      is_runner_active: body.is_runner_active || false,
      balance: body.balance !== undefined ? body.balance : 0,
      dues: body.dues !== undefined ? body.dues : 0,
      bonus: body.bonus !== undefined ? body.bonus : 25, // ₹25 signup bonus
      bw_rate: body.bw_rate || 2,
      color_rate: body.color_rate || 5,
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      // If FK constraint error, provide helpful message
      if (insertError.message.includes('profiles_id_fkey')) {
        console.error("FK constraint error — user must run fix_fk.sql in Supabase SQL Editor");
        return NextResponse.json({ 
          error: "Database needs a one-time fix. Go to Supabase Dashboard → SQL Editor and run the contents of fix_fk.sql" 
        }, { status: 500 });
      }
      console.error("Profile insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ profile: inserted });
  } catch (err: any) {
    console.error("Profile API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
